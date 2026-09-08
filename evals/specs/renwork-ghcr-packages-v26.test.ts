import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V26 publishes RenWork-owned cloud images and deploys them by default", async ({
  evidence,
}) => {
  const [workflow, values] = await Promise.all([
    readFile("../.github/workflows/publish-ee-images.yml", "utf8"),
    readFile("../packaging/helm/openwork-ee/values.yaml", "utf8"),
  ]);

  for (const packageName of [
    "renwork-den-api",
    "renwork-den-web",
    "renwork-den-gateway",
    "renwork-inference",
  ]) {
    expect(workflow).toContain(`package: ${packageName}`);
  }
  expect(workflow).toContain(
    "${{ env.REGISTRY }}/${{ github.repository_owner }}/${{ matrix.package }}",
  );
  expect(values).toContain("repository: ghcr.io/cnproduct/renwork-den-api");
  expect(values).toContain("repository: ghcr.io/cnproduct/renwork-den-web");
  expect(values).toContain("repository: ghcr.io/cnproduct/renwork-inference");

  evidence.fact(
    "RenWork owns the production image namespace",
    "The publishing workflow writes the four cloud services to new RenWork-branded GHCR packages instead of legacy packages whose Actions permissions cannot be granted to this repository.",
    true,
  );
  evidence.fact(
    "The Helm defaults consume the same release namespace",
    "Den API, Den Web, and inference default to the cnproduct RenWork packages, so publishing and deployment no longer point at different owners.",
    true,
  );
});
