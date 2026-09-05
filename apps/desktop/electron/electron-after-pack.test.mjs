import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isServer2016CloudBuild, normalizeArchivePath } = require("../scripts/electron-after-pack.cjs");

test("afterPack removes sidecars only from the immutable Server 2016 cloud build", () => {
  assert.equal(isServer2016CloudBuild({
    packager: { config: { extraMetadata: { openworkDistribution: "server2016-cloud" } } },
  }), true);
  assert.equal(isServer2016CloudBuild({
    packager: { config: { extraMetadata: { openworkDistribution: "public" } } },
  }), false);
});

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
