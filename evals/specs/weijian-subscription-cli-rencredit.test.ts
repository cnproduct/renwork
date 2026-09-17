import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { antigravityPersonalAccountMode, codexPersonalAccountMode, parseAntigravityResultEvent, parseCodexExecEvent } from "../../apps/server/src/renwork-cli-runtime";
import { subscriptionCliModelForMember, subscriptionCliPolicySchema, writeSubscriptionCliPolicy } from "../../ee/apps/den-api/src/subscription-cli-policy";

test("weijian CLI authorization keeps organization and reported usage boundaries", async ({ evidence }) => {
  const policy = subscriptionCliPolicySchema.parse({
    enabled: true,
    expiresAt: "2027-01-01T00:00:00.000Z",
    allowedMemberIds: ["om_weijian_member"],
    models: [{
      sku: "renwork-google-gemini-pro", runtime: "antigravity", upstreamModelId: "gemini-3.1-pro-high",
      displayName: "Gemini Pro", multiplierBps: 10_000,
      rates: {
        inputMicroCreditsPerMillion: 1_000_000, outputMicroCreditsPerMillion: 3_000_000,
        reasoningMicroCreditsPerMillion: 3_000_000, cacheReadMicroCreditsPerMillion: 200_000,
        cacheWriteMicroCreditsPerMillion: 1_250_000,
      },
    }],
  });
  const metadata = writeSubscriptionCliPolicy({}, policy);
  const request = { metadata, memberId: "om_weijian_member", modelSku: "renwork-google-gemini-pro", now: new Date("2026-09-17T00:00:00Z") };
  expect(subscriptionCliModelForMember({ ...request, organizationSlug: "weijian" })?.provider.protocol).toBe("antigravity_cli");
  expect(subscriptionCliModelForMember({ ...request, organizationSlug: "another-org" })).toBeNull();
  expect(subscriptionCliModelForMember({ ...request, organizationSlug: "weijian", memberId: "om_other" })).toBeNull();
  expect(subscriptionCliModelForMember({ ...request, organizationSlug: "weijian", now: new Date("2027-01-01T00:00:00Z") })).toBeNull();

  const parsed = parseAntigravityResultEvent({ event: "result", result: {
    conversation_id: "run_1", status: "SUCCESS", response: "done",
    usage: { input_tokens: 100, output_tokens: 40, thinking_tokens: 15, cache_read_tokens: 60, total_tokens: 140 },
  } });
  expect(parsed.usage).toEqual({ inputTokens: 40, outputTokens: 25, reasoningTokens: 15, cacheReadTokens: 60, cacheWriteTokens: 0 });
  expect(parseAntigravityResultEvent({ event: "result", result: { status: "SUCCESS", response: "done" } }).failed).toBe("ANTIGRAVITY_USAGE_EVENT_MISSING");
  const codex = parseCodexExecEvent({ type: "turn.completed", usage: {
    input_tokens: 100, cached_input_tokens: 30, cache_write_input_tokens: 10,
    output_tokens: 40, reasoning_output_tokens: 15,
  } });
  expect(codex.usage).toEqual({ inputTokens: 60, outputTokens: 25, reasoningTokens: 15, cacheReadTokens: 30, cacheWriteTokens: 10 });
  expect(antigravityPersonalAccountMode({}, {})).toBe(true);
  expect(antigravityPersonalAccountMode({ modelProvider: "gemini" }, {})).toBe(false);
  expect(codexPersonalAccountMode("Logged in using ChatGPT", {})).toBe(true);
  expect(codexPersonalAccountMode("Logged in using an API key", {})).toBe(false);

  evidence.fact("CLI pilot is restricted to an authorized weijian member", "The same policy denies another organization, member, and expired grant.", true);
  evidence.fact("Antigravity terminal usage is normalized for RenCredit", "The reported input and output totals are split from cache and thinking tokens before settlement; missing usage fails closed.", true);
  evidence.fact("Codex terminal usage is normalized for RenCredit", "Input and output totals are split from cache and reasoning tokens before settlement.", true);
  evidence.fact("Google API-key mode is excluded from the personal subscription pilot", "Antigravity settings with modelProvider gemini fail the account-mode guard before a reservation.", true);
  evidence.fact("OpenAI API-key mode is excluded from the personal subscription pilot", "Codex must report ChatGPT login and have no API credential or alternate base URL override.", true);
});
