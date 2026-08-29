import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { normalizeArchivePath } = require("../scripts/electron-after-pack.cjs");

test("afterPack normalizes Windows ASAR paths before dependency verification", () => {
  assert.equal(
    normalizeArchivePath("\\node_modules\\@hono\\node-server\\package.json"),
    "/node_modules/@hono/node-server/package.json",
  );
  assert.equal(
    normalizeArchivePath("/node_modules/@hono/node-server/package.json"),
    "/node_modules/@hono/node-server/package.json",
  );
});
