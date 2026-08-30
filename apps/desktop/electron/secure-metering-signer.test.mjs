import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createDesktopMeteringSignerProvider } from "./secure-metering-signer.mjs";

function fakeSafeStorage() {
  return {
    isAsyncEncryptionAvailable: async () => true,
    getSelectedStorageBackend: () => "keychain",
    encryptStringAsync: async (value) => Buffer.from(`protected:${value}`),
    decryptStringAsync: async (value) => ({
      result: value.toString().slice("protected:".length),
      shouldReEncrypt: false,
    }),
  };
}

test("metering identity persists and signs verifiable receipts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "renwork-metering-signer-"));
  const filePath = path.join(root, "identity.bin");
  const storage = fakeSafeStorage();
  const first = await createDesktopMeteringSignerProvider({ filePath, loadSafeStorage: () => storage })();
  const payload = JSON.stringify({ reservationId: "rsv_1" });
  const signature = await first.sign(payload);
  assert.equal(verify(null, Buffer.from(payload), createPublicKey(first.publicKeyPem), Buffer.from(signature, "base64")), true);
  assert.match((await readFile(filePath)).toString(), /^protected:/);

  const restarted = await createDesktopMeteringSignerProvider({ filePath, loadSafeStorage: () => storage })();
  assert.equal(restarted.deviceId, first.deviceId);
  assert.equal(restarted.publicKeyPem, first.publicKeyPem);
});
