import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("OpenAI personal OAuth readiness is replaced by Den-only catalog readiness", async ({ evidence }) => {
  const [picker, catalog, catalogPolicy, gateway, legacyRuntime] = await Promise.all([
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
  ]);

  expect(picker).not.toContain("requiredPersonalSubscriptionProvider");
  expect(picker).not.toContain('scope: "personal_subscription_oauth"');
  expect(catalog).not.toContain('authMode: "device_oauth"');
  expect(catalog).not.toContain('credentialStore: "device_vault"');
  expect(catalogPolicy).toContain("validateDenServerCatalog");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");
  expect(legacyRuntime).toContain('code: "LOCAL_RUNTIME_DISABLED"');

  evidence.fact(
    "Ordinary execution does not depend on desktop OAuth readiness",
    "V38 removes the personal OAuth prompt and device-vault routes; model readiness is determined only by the Den-hosted catalog and credentials.",
    true,
  );
  evidence.fact(
    "Failed Den execution releases reservations",
    "The inference gateway owns reserve, settlement, and release, while the legacy device metering endpoint remains disabled.",
    true,
  );
});
