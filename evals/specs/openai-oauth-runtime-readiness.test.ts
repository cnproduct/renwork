import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("OpenAI personal OAuth readiness stays local and tenant scoped", async ({ evidence }) => {
  const [picker, catalog, catalogPolicy, gateway, legacyRuntime, policy, host] = await Promise.all([
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/subscription-cli-policy.ts", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
  ]);

  expect(picker).toContain("requiredPersonalSubscriptionProvider");
  expect(picker).toContain('scope: "personal_subscription_oauth"');
  expect(catalog).not.toContain('authMode: "device_oauth"');
  expect(catalog).not.toContain('credentialStore: "device_vault"');
  expect(catalogPolicy).toContain("validateDenServerCatalog");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");
  expect(legacyRuntime).toContain('code: "LOCAL_RUNTIME_DISABLED"');
  expect(legacyRuntime).toContain("subscriptionOpenAiModelsForMember");
  expect(policy).toContain("isWeijianSubscriptionCliOrganization(input)");
  expect(host).toContain("assertMeteredLocalModelReady");

  evidence.fact(
    "Personal OAuth is checked on the member device",
    "The exact weijian exception verifies the local OpenAI connection before the trusted host runs a GPT model.",
    true,
  );
  evidence.fact(
    "Failure releases RenCredit",
    "The cloud gateway retains its own reserve and release path, and ungranted device metering remains disabled.",
    true,
  );
});
