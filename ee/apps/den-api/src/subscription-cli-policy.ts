import { z } from "zod"
import type { RenWorkAdminModel, RenWorkAdminProvider } from "@openwork/rencredit-metering"

const rate = z.number().int().min(0).max(1_000_000_000)
const ratesSchema = z.object({
  inputMicroCreditsPerMillion: rate,
  outputMicroCreditsPerMillion: rate,
  reasoningMicroCreditsPerMillion: rate,
  cacheReadMicroCreditsPerMillion: rate,
  cacheWriteMicroCreditsPerMillion: rate,
})
const modelSchema = z.object({
  sku: z.string().trim().regex(/^renwork-(codex|google)-[a-z0-9-]{1,120}$/),
  runtime: z.enum(["codex", "antigravity"]),
  upstreamModelId: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(160),
  rates: ratesSchema,
  peakRates: ratesSchema.optional(),
  pricingSchedule: z.literal("deepseek_flash_cn").optional(),
  multiplierBps: z.number().int().min(1).max(100_000),
}).superRefine((model, ctx) => {
  const prefix = model.runtime === "codex" ? "renwork-codex-" : "renwork-google-"
  if (!model.sku.startsWith(prefix)) ctx.addIssue({ code: "custom", path: ["sku"], message: "The SKU must match its CLI runtime." })
  if (Object.values(model.rates).every((value) => value === 0)) {
    ctx.addIssue({ code: "custom", path: ["rates"], message: "A metered model needs a nonzero rate." })
  }
  if (Boolean(model.peakRates) !== Boolean(model.pricingSchedule)) {
    ctx.addIssue({ code: "custom", path: ["peakRates"], message: "Peak rates require the China weekday pricing schedule." })
  }
})

export const subscriptionCliPolicySchema = z.object({
  enabled: z.boolean(),
  expiresAt: z.string().datetime(),
  allowedMemberIds: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  models: z.array(modelSchema).min(1).max(30),
}).superRefine((policy, ctx) => {
  const skus = new Set<string>()
  for (const [index, model] of policy.models.entries()) {
    if (skus.has(model.sku)) ctx.addIssue({ code: "custom", path: ["models", index, "sku"], message: "Model SKUs must be unique." })
    skus.add(model.sku)
  }
})

export type SubscriptionCliPolicy = z.infer<typeof subscriptionCliPolicySchema>

/** DeepSeek Flash's China schedule: weekdays 09:00-12:00 and 14:00-18:00. */
export function isChinaWeekdayPeak(now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now)
  const weekday = parts.find((part) => part.type === "weekday")?.value
  const hour = Number(parts.find((part) => part.type === "hour")?.value)
  return weekday !== "Sat" && weekday !== "Sun"
    && (hour >= 9 && hour < 12 || hour >= 14 && hour < 18)
}

function metadataRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value ?? {}
}

export function readSubscriptionCliPolicy(metadata: Record<string, unknown> | null | undefined): SubscriptionCliPolicy | null {
  const parsed = subscriptionCliPolicySchema.safeParse(metadata?.subscriptionCliPolicy)
  return parsed.success ? parsed.data : null
}

export function writeSubscriptionCliPolicy(metadata: Record<string, unknown> | null | undefined, policy: SubscriptionCliPolicy) {
  return { ...metadataRecord(metadata), subscriptionCliPolicy: policy }
}

export function subscriptionCliAccessForMember(input: {
  organizationSlug: string
  metadata: Record<string, unknown> | null | undefined
  memberId: string
  now?: Date
}): SubscriptionCliPolicy | null {
  if (input.organizationSlug !== "weijian") return null
  const policy = readSubscriptionCliPolicy(input.metadata)
  if (!policy?.enabled || Date.parse(policy.expiresAt) <= (input.now ?? new Date()).getTime()) return null
  return policy.allowedMemberIds.includes(input.memberId) ? policy : null
}

export function subscriptionCliModelForMember(input: {
  organizationSlug: string
  metadata: Record<string, unknown> | null | undefined
  memberId: string
  modelSku: string
  now?: Date
}): { model: RenWorkAdminModel; provider: RenWorkAdminProvider } | null {
  const policy = subscriptionCliAccessForMember(input)
  if (!policy) return null
  const configured = policy.models.find((model) => model.sku === input.modelSku)
  if (!configured) return null
  const rates = configured.pricingSchedule === "deepseek_flash_cn"
    && configured.peakRates && isChinaWeekdayPeak(input.now ?? new Date())
    ? configured.peakRates : configured.rates
  const providerId = configured.runtime === "codex" ? "codex-personal" : "antigravity-personal"
  const protocol = configured.runtime === "codex" ? "codex_cli" : "antigravity_cli"
  const provider: RenWorkAdminProvider = {
    id: providerId,
    displayName: configured.runtime === "codex" ? "OpenAI Codex CLI" : "Google Antigravity CLI",
    kind: "runtime",
    protocol,
    baseUrl: null,
    credentialRef: null,
    authMode: "device_oauth",
    credentialStore: "device_vault",
    executionScope: "personal_device",
    sharingScope: "user_private",
    deviceOAuthPolicy: { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 },
    enabled: true,
    health: "unknown",
  }
  const model: RenWorkAdminModel = {
    sku: configured.sku,
    displayName: configured.displayName,
    description: "在成员自己的设备上通过已登录的官方 CLI 运行，并以 RenCredit 结算。",
    tier: "professional",
    status: "published",
    autoEligible: false,
    contextWindow: null,
    tags: ["personal-device", configured.runtime],
    sortOrder: 0,
    displayMultiplierBps: configured.multiplierBps,
    priceMultiplierBps: configured.multiplierBps,
    rates,
    promotion: null,
    allowedPlanIds: ["free", "team", "enterprise"],
    routes: [{ id: `route-${configured.sku}`, providerId, upstreamModelId: configured.upstreamModelId, priority: 0, enabled: true, source: "local" }],
  }
  return { model, provider }
}
