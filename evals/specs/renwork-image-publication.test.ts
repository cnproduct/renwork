import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("EE artifacts publish to fresh RenWork GHCR packages without mutating legacy packages", async ({ evidence }) => {
  const workflow = await readFile(
    resolve(repoRoot, ".github/workflows/publish-ee-images.yml"),
    "utf8",
  );
  const values = await readFile(
    resolve(repoRoot, "packaging/helm/openwork-ee/values.yaml"),
    "utf8",
  );

  for (const image of [
    "renwork-den-api",
    "renwork-den-web",
    "renwork-den-gateway",
    "renwork-inference",
  ]) {
    expect(workflow).toContain(`- image: ${image}`);
  }

  expect(workflow).not.toMatch(/- image: openwork-(?:den-api|den-web|den-gateway|inference)$/m);
  expect(workflow).toContain(
    "org.opencontainers.image.source=https://github.com/${{ github.repository }}",
  );

  for (const image of [
    "renwork-den-api",
    "renwork-den-web",
    "renwork-inference",
  ]) {
    expect(values).toContain(`repository: ghcr.io/cnproduct/${image}`);
  }

  evidence.fact(
    "RenWork owns the new image publication path",
    "All four EE images publish under fresh renwork-* package names, while Helm defaults consume the three deployable chart images from cnproduct.",
    true,
  );
  evidence.fact(
    "Legacy package writes are disabled",
    "The workflow has no openwork-* matrix target, so existing legacy tags and digests remain untouched for compatibility readers.",
    true,
  );
});
