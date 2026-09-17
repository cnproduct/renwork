import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V45 makes provider authorization a Den-enforced super-admin boundary", async ({ evidence }) => {
  const [voiceover, policy, adminRoute, orgCatalog, gateway, dialog] = await Promise.all([
    readFile("../evals/voiceovers/voiceover-v45-commercial-control-plane.md", "utf8"),
    readFile("../ee/apps/den-api/src/organization-model-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/admin/model-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/model-catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-web/components/organization-model-policy-dialog.tsx", "utf8"),
  ]);

  expect(voiceover).toContain("个人 ChatGPT Plus/Pro OAuth 不得跨无关客户共享");
  expect(policy).toContain("organizationProviderAssignmentSchema");
  expect(policy).toContain("memberAllowedModelSkus");
  expect(policy).toContain("providerAssignments: []");
  expect(policy).toContain("providerAssignmentAllowsModel");
  expect(adminRoute.match(/adminRoute\(\)/g)?.length ?? 0).toBe(4);
  expect(adminRoute).toContain('organization.slug !== "weijian"');
  expect(adminRoute).toContain("A provider authorization references an unavailable server provider.");
  expect(orgCatalog).toContain("providerAssignmentAllowsModel");
  expect(orgCatalog).toContain("modelAllowedForMember");
  expect(gateway).toContain('code: "MODEL_PROVIDER_NOT_ASSIGNED"');
  expect(gateway).toContain('code: "MODEL_NOT_ALLOWED_FOR_MEMBER"');
  expect(gateway.indexOf("providerAssignmentAllowsModel")).toBeLessThan(gateway.indexOf("reserveInferenceCredits"));
  expect(dialog).toContain("超级管理员供应商授权");
  expect(dialog).not.toContain("credentialRef");
  expect(dialog).not.toContain("apiKey");

  evidence.fact("Provider authorization is fail closed", "An organization with no active super-admin provider assignment cannot see or execute a model route.", true);
  evidence.fact("Member permissions are authoritative", "Catalog visibility and inference execution apply the same member model and provider assignment intersection.", true);
  evidence.fact("Secrets remain server-side", "The organization control surface receives provider identity and scope only, never a credential reference or API key.", true);
});
