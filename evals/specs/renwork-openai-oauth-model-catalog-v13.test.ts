import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V13 publishes ChatGPT OAuth models into ordinary RenWork chat with RenCredit settlement", async ({ evidence }) => {
  const [catalog, catalogRuntime, desktopProxy, denRuntime] = await Promise.all([
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../deploy/cloud-api-server/src/server.ts", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
  ]);

  expect(catalog).toContain('id: "openai"');
  expect(catalog).toContain('protocol: "opencode"');
  expect(catalog).toContain('sku: "renwork-openai-gpt-5-6"');
  expect(catalog).toContain('upstreamModelId: "gpt-5.6"');
  expect(catalog).toContain('sku: "renwork-openai-gpt-5-5"');
  expect(catalog).toContain('upstreamModelId: "gpt-5.5"');
  expect(catalog).toContain('source: "local"');
  expect(catalog).toContain('credentialRef: null');
  expect(catalogRuntime).toContain("mergeMissingDefaultCatalogEntries");
  expect(catalogRuntime).toContain("migrateLegacyOpenAIOAuthProvider");
  expect(catalogRuntime).toContain("OPENAI_OAUTH_PROVIDER_POLICY_MIGRATION");
  expect(catalogRuntime).toContain("appliedCatalogMigrations");
  expect(desktopProxy).toContain("rewriteMeteredModel");
  expect(desktopProxy).toContain("input.metering.settle");
  expect(denRuntime).toContain("reservedMicroCredits");
  expect(denRuntime).toContain("route.upstreamModelId");

  evidence.fact(
    "ChatGPT OAuth models are ordinary chat choices",
    "The catalog publishes stable RenWork SKUs for GPT-5.6 and GPT-5.5 that resolve to OpenCode's local OpenAI provider without carrying an OAuth token in cloud state.",
    true,
  );
  evidence.fact(
    "Existing production catalogs receive a non-destructive one-time migration",
    "The catalog runtime records the V13 migration separately and adds only missing providers and models, preserving super-admin rows and later intentional deletions.",
    true,
  );
  evidence.fact(
    "Ordinary chat remains inside the RenCredit gate",
    "The desktop reserves before rewriting the synthetic RenWork SKU to the local OpenAI route, then settles reported token usage through Den.",
    true,
  );
});
