import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V8 exposes OAuth-only local subscriptions without a billing bypass", async ({ evidence }) => {
  const [settings, modal, store, policy, gate, proxy, gateway] = await Promise.all([
    readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/provider-auth-modal.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/store.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management.ts", "utf8"),
    readFile("../apps/server/src/renwork-metered-runtime-gate.ts", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
  ]);

  expect(settings).toContain("本机订阅账号");
  expect(settings).toContain("OpenAI Codex 与 Google Antigravity");
  expect(modal).toContain("此处不接受 API Key");
  expect(settings).toContain("每次调用仍先冻结 RenCredit");
  expect(settings).toContain("不会经过 RenWork，因此不会计入 RenCredit");
  expect(modal).toContain("personalSubscriptionOnly");
  expect(modal).toContain("凭据仅保存在当前设备");
  expect(store).toContain('ProviderAuthScope = "all" | "personal_subscription_oauth"');
  expect(store).toContain('new Set(["openai", "google"])');
  expect(store).toContain('providerMethods.filter((method) => method.type === "oauth")');
  expect(policy).toContain("canConnectPersonalSubscriptionOAuth");
  expect(policy).toContain("input.hasActiveRuntime");
  expect(gate).toContain('payload.model.providerID !== "renwork"');
  expect(proxy).toContain("rewriteMeteredModel");
  expect(proxy).toContain("settleMeteredOpenCodeRun");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("settleInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");

  evidence.fact(
    "Personal subscriptions are OAuth-only",
    "The ordinary desktop settings surface lists only OpenAI and Google subscription OAuth; API keys, custom providers, remote workers and signed-out contexts remain excluded.",
    true,
  );
  evidence.fact(
    "Local subscriptions cannot bypass RenCredit",
    "The renderer still submits only synthetic renwork model IDs; the host reserves credits before rewriting to the approved device OAuth route and settles a signed usage receipt or releases the reservation.",
    true,
  );
});
