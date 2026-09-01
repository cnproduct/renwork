import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createSecretVaultPasswordAuth } from "./secret-vault-auth.mjs";

describe("RenWork secret vault fallback password", () => {
  it("stores only a salted verifier and validates without persisting the password", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "renwork-secret-auth-"));
    const filePath = path.join(root, "auth.json");
    try {
      const auth = createSecretVaultPasswordAuth({ filePath });
      assert.equal(await auth.isConfigured(), false);
      await auth.configure("correct horse battery staple");
      assert.equal(await auth.verify("correct horse battery staple"), true);
      assert.equal(await auth.verify("wrong password"), false);
      assert.equal((await readFile(filePath, "utf8")).includes("correct horse"), false);
      if (process.platform !== "win32") assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects weak passwords and cannot silently replace an existing verifier", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "renwork-secret-auth-"));
    const auth = createSecretVaultPasswordAuth({ filePath: path.join(root, "auth.json") });
    try {
      await assert.rejects(auth.configure("short"), /at least 10/);
      await auth.configure("first strong password");
      await assert.rejects(auth.configure("second strong password"), /already configured/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
