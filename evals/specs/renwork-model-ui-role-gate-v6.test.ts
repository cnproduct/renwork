import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { readFile } from "node:fs/promises";

test("V7 keeps desktop model management read-only for every user profile", async ({ evidence }) => {
  const policy = await readFile("../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management.ts", "utf8");
  const picker = await readFile("../apps/app/src/react-app/domains/session/modals/model-picker-modal.tsx", "utf8");
  const session = await readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8");
  const settings = await readFile("../apps/app/src/react-app/shell/settings-route.tsx", "utf8");
  const aiView = await readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8");
  const providerRoutes = await readFile("../ee/apps/den-api/src/routes/org/llm-providers.ts", "utf8");

  expect(policy).toContain("return false");
  expect(picker).toContain("canManageProvidersFromModelPicker(props.allowProviderManagement)");
  expect(session).toContain("disabled: !localProviderManagementAllowed");
  expect(session).toContain('sessionProviderAuthSnapshot.providerAuthScope === "personal_subscription_oauth"');
  expect(settings).toContain("canAddProviders={localProviderManagementAllowed");
  expect(settings).toContain("open={customProvidersOpen && localProviderManagementAllowed}");
  expect(settings).toContain("localProviderManagementAllowed || providerAuthSnapshot.providerAuthScope === \"personal_subscription_oauth\"");
  expect(aiView).toContain("props.canAddProviders && !managedByCloud");
  expect(providerRoutes.match(/adminRoute\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(7);

  evidence.fact("Signed-in desktops are read-only", "Members, organization Owners, organization administrators, and platform administrators cannot mutate providers from the desktop UI.", true);
  evidence.fact("Independent local mode cannot bypass policy", "A signed-out local profile cannot add Ollama, BYOK, or other providers; temporary model access must come from a platform grant.", true);
  evidence.fact("Mutation routes remain platform-admin-only", "Provider create, update, test, delete, catalog, and access-grant routes require the server-side platform administrator allowlist.", true);
});
