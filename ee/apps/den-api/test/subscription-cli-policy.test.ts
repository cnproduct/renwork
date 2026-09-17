import { expect, test } from "bun:test"
import {
  readSubscriptionCliPolicy,
  subscriptionCliAccessForMember,
  subscriptionCliModelForMember,
  subscriptionCliPolicySchema,
  writeSubscriptionCliPolicy,
} from "../src/subscription-cli-policy.js"

const policy = subscriptionCliPolicySchema.parse({
  enabled: true,
  expiresAt: "2027-01-01T00:00:00.000Z",
  allowedMemberIds: ["om_weijian_member"],
  models: [{
    sku: "renwork-google-gemini-pro",
    runtime: "antigravity",
    upstreamModelId: "gemini-3.1-pro-high",
    displayName: "Gemini Pro",
    multiplierBps: 10_000,
    rates: {
      inputMicroCreditsPerMillion: 1_000_000,
      outputMicroCreditsPerMillion: 3_000_000,
      reasoningMicroCreditsPerMillion: 3_000_000,
      cacheReadMicroCreditsPerMillion: 200_000,
      cacheWriteMicroCreditsPerMillion: 1_250_000,
    },
  }],
})

test("only an active weijian member resolves a metered personal CLI route", () => {
  const metadata = writeSubscriptionCliPolicy({ unrelated: true }, policy)
  expect(metadata.unrelated).toBe(true)
  expect(readSubscriptionCliPolicy(metadata)).toEqual(policy)
  const base = { metadata, memberId: "om_weijian_member", modelSku: "renwork-google-gemini-pro", now: new Date("2026-09-17T00:00:00.000Z") }
  const granted = subscriptionCliModelForMember({ ...base, organizationSlug: "weijian" })
  expect(granted?.provider.protocol).toBe("antigravity_cli")
  expect(granted?.provider.credentialStore).toBe("device_vault")
  expect(granted?.model.routes[0]?.source).toBe("local")
  expect(subscriptionCliModelForMember({ ...base, organizationSlug: "other" })).toBeNull()
  expect(subscriptionCliModelForMember({ ...base, organizationSlug: "weijian", memberId: "om_other" })).toBeNull()
  expect(subscriptionCliModelForMember({ ...base, organizationSlug: "weijian", modelSku: "renwork-code" })).toBeNull()
  expect(subscriptionCliModelForMember({ ...base, organizationSlug: "weijian", now: new Date("2027-01-01T00:00:00.000Z") })).toBeNull()
  expect(subscriptionCliAccessForMember({ organizationSlug: "other", metadata, memberId: "om_weijian_member" })).toBeNull()
})

test("rejects a mismatched SKU or unmetered model", () => {
  expect(subscriptionCliPolicySchema.safeParse({ ...policy, models: [{ ...policy.models[0], sku: "renwork-codex-gpt" }] }).success).toBe(false)
  expect(subscriptionCliPolicySchema.safeParse({ ...policy, models: [{ ...policy.models[0], rates: Object.fromEntries(Object.keys(policy.models[0]!.rates).map((key) => [key, 0])) }] }).success).toBe(false)
})
