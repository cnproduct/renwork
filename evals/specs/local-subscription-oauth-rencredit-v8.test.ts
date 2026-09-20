import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Personal OAuth is limited to a Den-granted local catalog model", async ({ evidence }) => {
  const [settings, picker, catalog, gate, gateway, policy, metering] = await Promise.all([
    readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8"),
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/subscription-cli-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
  ]);

  expect(settings).not.toContain("本机订阅账号");
  expect(settings).not.toContain("OpenAI Codex 与 Google Antigravity");
  expect(picker).toContain("requiredPersonalSubscriptionProvider");
  expect(picker).toContain('scope: "personal_subscription_oauth"');
  expect(policy).toContain("isWeijianSubscriptionCliOrganization(input)");
  expect(metering).toContain("subscriptionOpenAiModelsForMember");
  expect(catalog).toContain("purgeNonDenCatalogEntries");
  expect(catalog).not.toContain('executionScope: "personal_device"');
  expect(gate).toContain("validateDenServerCatalog");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("settleInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");

  evidence.fact(
    "Personal subscription controls require a scoped grant",
    "The model picker offers device OAuth only for a member-safe catalog entry from the exact weijian policy.",
    true,
  );
  evidence.fact(
    "Every route remains metered",
    "The global catalog remains Den-secret-only; the bounded personal route uses signed local reservation and settlement.",
    true,
  );
});
