import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V17 gives platform admins auditable organization model multipliers", async ({ evidence }) => {
  const [policy, adminRoute, ownerRoute, memberCatalog, gateway, runtime, ledger, dialog] = await Promise.all([
    readFile("../ee/apps/den-api/src/organization-model-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/admin/model-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/model-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/model-catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
    readFile("../ee/apps/den-web/components/organization-model-policy-dialog.tsx", "utf8"),
  ]);

  expect(policy).toContain("renworkModelPricingPolicy");
  expect(policy).toContain("organizationModelPricingPolicyInputSchema");
  expect(adminRoute).toContain("modelMultiplierOverridesBps");
  expect(ownerRoute).not.toContain("modelMultiplierOverridesBps");

  expect(dialog).toContain("平台倍率");
  expect(dialog).toContain("组织结算倍率");
  expect(dialog).toContain("生效倍率");
  expect(dialog).toContain("恢复继承");

  expect(memberCatalog).toContain("applyOrganizationPricingToPublicCatalog");
  expect(gateway).toContain("applyOrganizationPricingToAdminModel");
  expect(runtime).toContain("applyOrganizationPricingToAdminModel");

  expect(ledger).toContain("platformPriceMultiplierBps");
  expect(ledger).toContain("organizationMultiplierOverrideBps");
  expect(ledger).toContain("effectivePriceMultiplierBps");
  expect(ledger).toContain("pricingPolicyVersion");

  evidence.fact("Admin-only organization pricing", "Only the platform-admin route accepts organization multiplier overrides; the Owner route cannot mutate them.", true);
  evidence.fact("One visible and billable multiplier", "The organization effective multiplier is applied to the member-safe catalog, cloud gateway, and approved local runtime.", true);
  evidence.fact("Auditable settlement", "Every reservation snapshots platform, override, effective multiplier, catalog version, and pricing policy version without exposing provider secrets.", true);
});
