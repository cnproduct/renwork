import { generateKeyPairSync, randomUUID, sign as signBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

async function replaceProtectedFile(filePath, encrypted) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, encrypted, { mode: 0o600 });
    await chmod(temporary, 0o600).catch(() => undefined);
    await rename(temporary, filePath);
    await chmod(filePath, 0o600).catch(() => undefined);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function parseIdentity(encoded) {
  const value = JSON.parse(encoded);
  if (
    !value
    || typeof value !== "object"
    || typeof value.deviceId !== "string"
    || !value.deviceId.trim()
    || typeof value.publicKeyPem !== "string"
    || !value.publicKeyPem.includes("BEGIN PUBLIC KEY")
    || typeof value.privateKeyPem !== "string"
    || !value.privateKeyPem.includes("BEGIN PRIVATE KEY")
  ) {
    throw new Error("The protected RenWork metering identity is invalid.");
  }
  return value;
}

/**
 * Stores the per-install Ed25519 identity behind Electron safeStorage. Only
 * the embedded main process can sign content-free RenCredit receipts.
 */
export function createDesktopMeteringSignerProvider({
  filePath,
  loadSafeStorage,
  platform = process.platform,
}) {
  let pending = null;

  async function loadIdentity() {
    const safeStorage = loadSafeStorage();
    if (!safeStorage || !(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error("Operating-system secure storage is unavailable for RenWork metering.");
    }
    if (platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text") {
      throw new Error("A secure Linux password store is required for RenWork metering.");
    }

    try {
      const encrypted = await readFile(filePath);
      const decrypted = await safeStorage.decryptStringAsync(encrypted);
      const identity = parseIdentity(decrypted.result);
      if (decrypted.shouldReEncrypt) {
        await replaceProtectedFile(filePath, await safeStorage.encryptStringAsync(decrypted.result));
      }
      return identity;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { format: "pem", type: "spki" },
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
    });
    const identity = {
      deviceId: `renwork-desktop-${randomUUID()}`,
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
    };
    const encoded = JSON.stringify(identity);
    await replaceProtectedFile(filePath, await safeStorage.encryptStringAsync(encoded));
    return identity;
  }

  return async () => {
    pending ??= loadIdentity();
    try {
      const identity = await pending;
      return {
        deviceId: identity.deviceId,
        publicKeyPem: identity.publicKeyPem,
        sign: async (payload) => signBytes(null, Buffer.from(payload, "utf8"), identity.privateKeyPem).toString("base64"),
      };
    } catch (error) {
      pending = null;
      throw error;
    }
  };
}
