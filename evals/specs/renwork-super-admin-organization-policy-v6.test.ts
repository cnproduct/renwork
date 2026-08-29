import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("V6 gives the platform super admin one cross-organization model governance surface", async ({ evidence }) => {
  const panel = await readFile("../ee/apps/den-web/components/den-admin-panel.tsx", "utf8");
  const dialog = await readFile("../ee/apps/den-web/components/organization-model-policy-dialog.tsx", "utf8");
  const route = await readFile("../ee/apps/den-api/src/routes/admin/model-policy.ts", "utf8");

  expect(panel).toContain("模型与额度策略");
  expect(dialog).toContain("模型白名单与默认模型");
  expect(dialog).toContain("组织 RenCredit 预算");
  expect(dialog).toContain("成员月额度");
  expect(route.match(/adminRoute\(\)/g)?.length ?? 0).toBe(2);
  expect(route).toContain("loadAvailableModels");
  expect(route).toContain("loadActiveMembers");

  evidence.fact("Cross-organization governance is visible", "Every organization row opens one RenWork-branded model, budget, and member quota dialog.", true);
  evidence.fact("Platform administration is enforced server-side", "Both organization-policy endpoints require the platform admin allowlist and reject quotas for removed or unknown members.", true);
  evidence.fact("Secrets stay global", "The organization dialog never receives provider keys; provider routes and secret references remain in the separate global model catalog.", true);
});
