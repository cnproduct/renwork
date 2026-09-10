import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V11 approved-device Codex route is superseded by the V38 Den-only boundary", async ({ evidence }) => {
  const [catalog, catalogPolicy, denRuntime] = await Promise.all([
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
  ]);

  expect(catalog).not.toContain('sku: "renwork-codex"');
  expect(catalog).not.toContain('protocol: "codex_cli"');
  expect(catalog).not.toContain('credentialStore: "device_vault"');
  expect(catalog).not.toContain('executionScope: "personal_device"');
  expect(catalog).toContain("purgeNonDenCatalogEntries");
  expect(catalogPolicy).toContain("validateDenServerCatalog");
  expect(catalogPolicy).toContain("Den server secret");
  expect(denRuntime).toContain('app.all("/api/v1/metered-runtime/*"');
  expect(denRuntime).toContain('code: "LOCAL_RUNTIME_DISABLED"');

  evidence.fact(
    "Approved-device Codex billing is no longer a published route",
    "V38 removes the historical device-vault Codex SKU so an ordinary client cannot execute a personal OAuth route outside Den.",
    true,
  );
  evidence.fact(
    "Den-only catalog validation is authoritative",
    "Published models must resolve through server-side Den secrets and the legacy metered-runtime surface is disabled.",
    true,
  );
});
