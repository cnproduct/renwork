import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { ensureRenworkCliWrapper } from "./renwork-cli-wrapper.mjs";

test("creates a local RenWork CLI launcher without embedding runtime credentials", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "renwork-cli-wrapper-"));
  try {
    const directory = await ensureRenworkCliWrapper({ userDataPath: root, executablePath: "/Applications/RenWork.app/Contents/MacOS/RenWork" });
    const launcher = await readFile(path.join(directory, process.platform === "win32" ? "renwork.cmd" : "renwork"), "utf8");
    const runner = await readFile(path.join(directory, "runner.mjs"), "utf8");
    assert.match(launcher, /ELECTRON_RUN_AS_NODE=1/);
    assert.match(runner, /RENWORK_SERVER_TOKEN/);
    assert.doesNotMatch(launcher, /Bearer\s+[A-Za-z0-9_-]+/);
    assert.doesNotMatch(runner, /sk-[A-Za-z0-9]/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
