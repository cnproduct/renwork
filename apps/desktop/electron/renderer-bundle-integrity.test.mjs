import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { verifyRendererBundle } from "../scripts/verify-renderer-bundle.mjs";

async function rendererFixture(indexHtml) {
  const root = await mkdtemp(path.join(tmpdir(), "renwork-renderer-integrity-"));
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(path.join(root, "index.html"), indexHtml);
  await writeFile(path.join(root, "assets", "app.js"), "console.log('ok');\n");
  await writeFile(path.join(root, "assets", "app.css"), "body {}\n");
  return root;
}

describe("packaged renderer integrity", () => {
  it("accepts relative Vite resources that exist inside app-dist", async () => {
    const root = await rendererFixture(
      '<link rel="stylesheet" href="./assets/app.css"><script type="module" src="./assets/app.js"></script>',
    );
    const result = await verifyRendererBundle(root);
    assert.equal(result.ok, true);
    assert.deepEqual(result.resources, ["./assets/app.css", "./assets/app.js"]);
  });

  it("rejects root-absolute resources that resolve to file:///assets", async () => {
    const root = await rendererFixture(
      '<link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script>',
    );
    await assert.rejects(
      verifyRendererBundle(root),
      /file:\/\/-unsafe absolute resources: \/assets\/app\.css, \/assets\/app\.js/,
    );
  });

  it("rejects missing bundled resources", async () => {
    const root = await rendererFixture('<script type="module" src="./assets/missing.js"></script>');
    await assert.rejects(verifyRendererBundle(root), /ENOENT/);
  });
});
