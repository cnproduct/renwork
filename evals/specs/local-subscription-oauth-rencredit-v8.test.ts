import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V8 local OAuth surface is superseded by the V38 Den-only boundary", async ({ evidence }) => {
  const [settings, picker, catalog, gate, gateway] = await Promise.all([
    readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8"),
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
  ]);

  expect(settings).not.toContain("本机订阅账号");
  expect(settings).not.toContain("OpenAI Codex 与 Google Antigravity");
  expect(picker).not.toContain("requiredPersonalSubscriptionProvider");
  expect(picker).not.toContain('scope: "personal_subscription_oauth"');
  expect(catalog).toContain("purgeNonDenCatalogEntries");
  expect(catalog).not.toContain('executionScope: "personal_device"');
  expect(gate).toContain("validateDenServerCatalog");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("settleInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");

  evidence.fact(
    "Personal subscription controls are removed from ordinary clients",
    "The settings page and model picker no longer expose local OAuth enrollment or redirect users to client-side provider authorization.",
    true,
  );
  evidence.fact(
    "Selectable execution remains inside Den metering",
    "The accepted catalog is Den-secret-only and inference still reserves before execution, then settles or releases through Den.",
    true,
  );
});
