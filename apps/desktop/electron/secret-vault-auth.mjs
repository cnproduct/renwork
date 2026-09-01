import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const VERSION = 1;

async function replaceVerifier(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(payload)}\n`, { mode: 0o600, flag: "wx" });
    await chmod(temporary, 0o600).catch(() => undefined);
    await rename(temporary, filePath);
    await chmod(filePath, 0o600).catch(() => undefined);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function derive(password, salt) {
  return scryptSync(password.normalize("NFKC"), salt, 32);
}

export function createSecretVaultPasswordAuth({ filePath }) {
  async function readVerifier() {
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8"));
      if (parsed?.version !== VERSION || typeof parsed.salt !== "string" || typeof parsed.hash !== "string") {
        throw new Error("The RenWork secret vault password record is invalid.");
      }
      return parsed;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  return {
    async isConfigured() {
      return (await readVerifier()) !== null;
    },
    async configure(password) {
      if (typeof password !== "string" || password.length < 10) {
        throw new Error("The RenWork secret vault password must contain at least 10 characters.");
      }
      if (await readVerifier()) {
        throw new Error("The RenWork secret vault password is already configured.");
      }
      const salt = randomBytes(16);
      const hash = derive(password, salt);
      await replaceVerifier(filePath, {
        version: VERSION,
        salt: salt.toString("base64"),
        hash: hash.toString("base64"),
      });
    },
    async verify(password) {
      const verifier = await readVerifier();
      if (!verifier || typeof password !== "string") return false;
      const expected = Buffer.from(verifier.hash, "base64");
      const actual = derive(password, Buffer.from(verifier.salt, "base64"));
      return expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual);
    },
  };
}
