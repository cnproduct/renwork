import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V13 client OAuth catalog is superseded by the V38 Den-only catalog", async ({ evidence }) => {
  const [catalog, catalogRuntime, catalogPolicy, inference] = await Promise.all([
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../deploy/cloud-api-server/src/server.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/inference.ts", "utf8"),
  ]);

  expect(catalog).not.toContain('id: "openai"');
  expect(catalog).not.toContain('sku: "renwork-openai-gpt-5-6"');
  expect(catalog).not.toContain('sku: "renwork-openai-gpt-5-5"');
  expect(catalog).not.toContain('credentialRef: null');
  expect(catalog).toContain("DEN_SERVER_CATALOG_PURGE_MIGRATION");
  expect(catalogRuntime).toContain("purgeNonDenCatalogEntries");
  expect(catalogRuntime).toContain("DEN_SERVER_CATALOG_PURGE_MIGRATION");
  expect(catalogRuntime).toContain("appliedCatalogMigrations");
  expect(catalogPolicy).toContain("validateDenServerCatalog");
  expect(inference).toContain("validateDenServerCatalog(parsed.data)");

  evidence.fact(
    "Client OAuth models are removed from the published catalog",
    "V38 purges the historical OpenAI personal-device provider and SKUs instead of delivering OAuth state to ordinary clients.",
    true,
  );
  evidence.fact(
    "Existing catalogs receive an idempotent Den-only migration",
    "The catalog runtime records the V38 purge marker and validates the migrated catalog before serving it.",
    true,
  );
  evidence.fact(
    "Inference rejects catalogs that reintroduce a bypass",
    "The Den inference loader applies the strict server-secret catalog validator before resolving any route.",
    true,
  );
});
