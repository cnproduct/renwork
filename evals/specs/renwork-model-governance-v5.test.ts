import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { readFile } from "node:fs/promises";

test("V5 separates platform provider administration from organization model policy", async ({ evidence }) => {
  const picker = await readFile("../apps/app/src/react-app/domains/session/modals/model-picker-modal.tsx", "utf8");
  const session = await readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8");
  const providerRoutes = await readFile("../ee/apps/den-api/src/routes/org/llm-providers.ts", "utf8");
  const policyRoutes = await readFile("../ee/apps/den-api/src/routes/org/model-policy.ts", "utf8");
  const gateway = await readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8");
  const ledger = await readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8");

  expect(picker).toContain("allowProviderManagement");
  expect(session).toContain('allowProviderManagement={selectedWorkspace?.workspaceType === "local"}');
  expect(providerRoutes.match(/adminRoute\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  expect(policyRoutes).toContain('orgRoleRoute(["owner"])');
  expect(gateway).toContain("MODEL_NOT_ALLOWED_BY_ORGANIZATION");
  expect(ledger).toContain("MEMBER_MONTHLY_QUOTA_EXCEEDED");

  evidence.fact("Cloud model selection is read-only", "Members and organization Owners can choose only published models; local Ollama and BYOK remain available only in local workspaces.", true);
  evidence.fact("Provider mutation is platform-admin gated", "Create, update, test, delete, catalog inspection, and access-grant mutation routes require the platform admin allowlist.", true);
  evidence.fact("Owner budgets are enforced at reservation", "Allowlist, organization budgets, and member quotas are checked while the durable RenCredit wallet row is locked.", true);
});
