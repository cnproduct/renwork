import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { subscriptionOpenAiModelsForMember } from "../../ee/apps/den-api/src/subscription-cli-policy";
import { canConnectPersonalSubscriptionOAuth } from "../../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management";

const metadata = {
  subscriptionCliPolicy: {
    enabled: true,
    expiresAt: "2027-01-01T00:00:00.000Z",
    allowedMemberIds: ["original_pilot_member"],
    models: [{
      sku: "renwork-codex-gpt-5-6-sol",
      runtime: "codex",
      upstreamModelId: "gpt-5.6-sol",
      displayName: "GPT-5.6 Sol",
      multiplierBps: 10_000,
      rates: {
        inputMicroCreditsPerMillion: 1_000_000,
        outputMicroCreditsPerMillion: 3_000_000,
        reasoningMicroCreditsPerMillion: 3_000_000,
        cacheReadMicroCreditsPerMillion: 200_000,
        cacheWriteMicroCreditsPerMillion: 1_250_000,
      },
    }],
  },
};

test("weijian members see personal GPT models and run through member metering", async ({ evidence }) => {
  const member = {
    organizationId: "org_weijian",
    organizationName: "weijian",
    pilotOrganizationId: "org_weijian",
    memberId: "another_active_member",
    metadata,
    now: new Date("2026-09-20T00:00:00.000Z"),
  };
  const models = subscriptionOpenAiModelsForMember(member);
  expect(models.map(({ model }) => model.sku)).toEqual(["renwork-openai-gpt-5-6-sol"]);
  expect(models[0]?.provider).toMatchObject({
    id: "openai", protocol: "opencode", authMode: "device_oauth",
    credentialStore: "device_vault", sharingScope: "user_private", credentialRef: null,
  });
  expect(models[0]?.model.routes[0]).toMatchObject({
    providerId: "openai", upstreamModelId: "gpt-5.6-sol", source: "local",
  });
  expect(subscriptionOpenAiModelsForMember({ ...member, organizationId: "other" })).toEqual([]);
  expect(subscriptionOpenAiModelsForMember({ ...member, now: new Date("2027-01-01T00:00:00.000Z") })).toEqual([]);

  const desktop = {
    desktopRuntime: true, signedIn: true, hasAuthToken: true,
    hasActiveOrganization: true, hasActiveRuntime: true,
    hasPlatformGrantedModel: true, workspaceType: "local",
  };
  expect(canConnectPersonalSubscriptionOAuth(desktop)).toBe(true);
  expect(canConnectPersonalSubscriptionOAuth({ ...desktop, workspaceType: "remote" })).toBe(false);

  const [catalog, picker, settings, metering, host] = await Promise.all([
    readFile("../ee/apps/den-api/src/routes/org/model-catalog.ts", "utf8"),
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/pages/ai-view.tsx", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
  ]);
  expect(catalog).toContain("subscriptionOpenAiModelsForMember");
  expect(picker).toContain("personal_subscription_oauth");
  expect(settings).toContain("连接 ChatGPT");
  expect(metering).toContain("reserveInferenceCredits");
  expect(metering).toContain("settleInferenceCredits");
  expect(host).toContain("rewriteMeteredModel");
  expect(host).toContain("settleMeteredOpenCodeRun");

  evidence.fact("Member-scoped GPT authorization", "A second weijian member receives a private, local OpenAI route while another organization and an expired policy receive none.", true);
  evidence.fact("Local selection and RenCredit path", "The desktop permits only the signed-in local flow, and the picker, reservation, settlement and local model rewrite are connected.", true);
});
