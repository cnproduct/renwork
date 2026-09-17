import { expect, test } from "bun:test"
import {
  isChinaWeekdayPeak,
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

test("selects China weekday peak rates at reservation time", () => {
  const scheduled = subscriptionCliPolicySchema.parse({
    ...policy,
    models: [{
      ...policy.models[0],
      pricingSchedule: "deepseek_flash_cn",
      peakRates: { ...policy.models[0]!.rates, inputMicroCreditsPerMillion: 57_971_014 },
    }],
  })
  const metadata = writeSubscriptionCliPolicy({}, scheduled)
  const resolve = (now: string) => subscriptionCliModelForMember({
    organizationSlug: "weijian", metadata, memberId: "om_weijian_member",
    modelSku: "renwork-google-gemini-pro", now: new Date(now),
  })?.model.rates.inputMicroCreditsPerMillion
  expect(isChinaWeekdayPeak(new Date("2026-09-17T00:59:59Z"))).toBe(false)
  expect(resolve("2026-09-17T00:59:59Z")).toBe(1_000_000) // Thursday 08:59 CST
  expect(resolve("2026-09-17T01:00:00Z")).toBe(57_971_014) // Thursday 09:00 CST
  expect(resolve("2026-09-17T04:00:00Z")).toBe(1_000_000) // Thursday 12:00 CST
  expect(resolve("2026-09-17T06:00:00Z")).toBe(57_971_014) // Thursday 14:00 CST
  expect(resolve("2026-09-17T10:00:00Z")).toBe(1_000_000) // Thursday 18:00 CST
  expect(resolve("2026-09-19T01:00:00Z")).toBe(1_000_000) // Saturday 09:00 CST
  expect(subscriptionCliPolicySchema.safeParse({
    ...policy, models: [{ ...policy.models[0], pricingSchedule: "deepseek_flash_cn" }],
  }).success).toBe(false)
})
