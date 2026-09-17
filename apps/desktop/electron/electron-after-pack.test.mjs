import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { isDenOnlyBuild, isServer2016CloudBuild, normalizeArchivePath, targetTriple } = require("../scripts/electron-after-pack.cjs");

test("afterPack maps electron-builder numeric architecture values to sidecar targets", () => {
  assert.equal(targetTriple("darwin", 3), "aarch64-apple-darwin");
  assert.equal(targetTriple("darwin", 1), "x86_64-apple-darwin");
  assert.equal(targetTriple("linux", 3), "aarch64-unknown-linux-gnu");
  assert.equal(targetTriple("win32", 1), "x86_64-pc-windows-msvc");
});

test("afterPack removes sidecars only from the immutable Server 2016 cloud build", () => {
  assert.equal(isServer2016CloudBuild({
    packager: { config: { extraMetadata: { openworkDistribution: "server2016-cloud" } } },
  }), true);
  assert.equal(isServer2016CloudBuild({
    packager: { config: { extraMetadata: { openworkDistribution: "public" } } },
  }), false);
});

test("afterPack strips local runtime sidecars from every Den-only distribution", () => {
  for (const openworkDistribution of ["public", "cloud", "enterprise", "server2016-cloud"]) {
    assert.equal(isDenOnlyBuild({
      packager: { config: { extraMetadata: { openworkDistribution } } },
    }), true);
  }
  assert.equal(isDenOnlyBuild({
    packager: { config: { extraMetadata: { openworkDistribution: "standalone" } } },
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
