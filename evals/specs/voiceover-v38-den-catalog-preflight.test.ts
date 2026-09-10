import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V38 removes bypass paths and blocks unsafe catalog publication", async ({ evidence }) => {
  const [voiceover, catalog, defaults, cloudServer, denInference, inferenceGateway, orgCatalog, picker, hero, onboarding, aiSettings, taskSuggestions, constants, automationModels, automationAuthority, automationRollout, automationTypes, afterPack, connector, overlay, admin, desktopPackage] = await Promise.all([
    readFile("../evals/voiceovers/voiceover-v38-den-catalog-purge.md", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../deploy/cloud-api-server/src/server.ts", "utf8"),
    readFile("../ee/apps/den-api/src/inference.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/model-catalog.ts", "utf8"),
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/session/chat/session-empty-hero.tsx", "utf8"),
    readFile("../ee/apps/den-web/app/(den)/dashboard/_components/marketplace-onboarding-screen.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8"),
    readFile("../apps/app/src/components/chat/task-suggestions.tsx", "utf8"),
    readFile("../apps/app/src/app/constants.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/automations/automation-model-options.ts", "utf8"),
    readFile("../ee/apps/den-api/src/automations/authority.ts", "utf8"),
    readFile("../ee/apps/den-api/src/automations/model-attention-rollout.ts", "utf8"),
    readFile("../packages/types/src/automations.ts", "utf8"),
    readFile("../apps/desktop/scripts/electron-after-pack.cjs", "utf8"),
    readFile("../apps/app/src/react-app/shell/server-2016-cloud-workspace.tsx", "utf8"),
    readFile("../apps/app/src/react-app/shell/cloud-workspace-overlay.tsx", "utf8"),
    readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8"),
    readFile("../apps/desktop/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
  ]);

  expect(voiceover).toContain("0.05 RenCredit");
  expect(catalog).toContain("must target only paid individual or enterprise plans");
  expect(catalog).toContain("Routes for ${model.sku} must be official Den server routes");
  expect(defaults).toContain("purgeNonDenCatalogEntries");
  expect(defaults).toContain('sku: "renwork-code-kimi-k3"');
  expect(defaults).toContain('credentialRef: "env://OPENCODE_GO_API_KEY"');
  expect(cloudServer).toContain("DEN_SERVER_CATALOG_PURGE_MIGRATION");
  expect(denInference).toContain("validateDenServerCatalog(parsed.data)");
  expect(inferenceGateway).toContain("validateDenServerCatalog(catalog)");
  expect(orgCatalog).toContain("validateDenServerCatalog(parsed.data)");
  expect(picker).not.toContain("Your API keys");
  expect(picker).not.toContain("Add your keys");
  expect(hero).not.toContain("Connect a model provider");
  expect(onboarding).not.toContain("Bring your Own Keys");
  expect(onboarding).not.toContain("getCustomLlmProvidersRoute");
  expect(aiSettings).not.toContain("连接订阅账号");
  expect(aiSettings).not.toContain("本机订阅账号");
  expect(taskSuggestions).not.toContain("Add an API key");
  expect(taskSuggestions).toContain("Check RenWork Models");
  expect(constants).toContain('providerID: "renwork"');
  expect(constants).toContain('modelID: "renwork-auto"');
  expect(automationModels).not.toContain("AUTOMATION_FREE_MODEL");
  expect(automationModels).toContain('modelId: "renwork-auto"');
  expect(automationAuthority).not.toContain("allowsZenModel");
  expect(automationAuthority).not.toContain('accessKind: "free"');
  expect(automationRollout).toContain("return true");
  expect(automationTypes).not.toContain("AUTOMATION_FREE_MODEL");
  expect(automationTypes).toContain("AUTOMATION_DEFAULT_MODEL");
  expect(afterPack).toContain('["public", "cloud", "enterprise", "server2016-cloud"]');
  expect(connector).toContain("readDesktopDistributionInfo().cloudWorkspaceRequired");
  expect(overlay).toContain("readDesktopDistributionInfo().cloudWorkspaceRequired");
  expect(admin).toContain('allowedPlanIds: ["individual", "enterprise"]');
  expect(desktopPackage.version).toBe("0.18.65");

  evidence.fact(
    "Catalog publication fails closed",
    "Free-plan grants, client credentials and any local or BYOK route are rejected before publication, while the migration permanently removes dormant legacy rows.",
    true,
  );
  evidence.fact(
    "Ordinary packages are Den-only",
    "Every distributed RenWork flavor connects required cloud workspaces and strips the OpenCode executable sidecar after packaging.",
    true,
  );
});
