import { z } from "zod"
import type { RenWorkAdminModel, RenWorkPublicModelCatalog } from "@openwork/rencredit-metering"

const MAX_MICROCREDITS = 9_000_000_000_000_000

export const organizationModelPolicyInputSchema = z.object({
  allowedModelSkus: z.array(z.string().trim().min(1).max(160)).max(500).nullable(),
  defaultModelSku: z.string().trim().min(1).max(160).nullable(),
  dailyBudgetMicroCredits: z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  monthlyBudgetMicroCredits: z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  memberMonthlyBudgetMicroCredits: z.record(
    z.string().trim().min(1).max(160),
    z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  ),
}).strict().superRefine((policy, ctx) => {
  if (
    policy.defaultModelSku &&
    policy.allowedModelSkus &&
    !policy.allowedModelSkus.includes(policy.defaultModelSku)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["defaultModelSku"],
      message: "The default model must be included in the organization allowlist.",
    })
  }
})

export type OrganizationModelPolicy = z.infer<typeof organizationModelPolicyInputSchema>

export const DEFAULT_ORGANIZATION_MODEL_POLICY: OrganizationModelPolicy = {
  allowedModelSkus: null,
  defaultModelSku: null,
  dailyBudgetMicroCredits: null,
  monthlyBudgetMicroCredits: null,
  memberMonthlyBudgetMicroCredits: {},
}

const MAX_MODEL_MULTIPLIER_BPS = 1_000_000

export const organizationModelPricingPolicyInputSchema = z.object({
  modelMultiplierOverridesBps: z.record(
    z.string().trim().min(1).max(160),
    z.number().int().positive().max(MAX_MODEL_MULTIPLIER_BPS),
  ),
}).strict()

const organizationModelPricingAuditEntrySchema = z.object({
  actorUserId: z.string().min(1).max(160),
  organizationId: z.string().min(1).max(160),
  modelSku: z.string().min(1).max(160),
  previousMultiplierBps: z.number().int().positive().nullable(),
  nextMultiplierBps: z.number().int().positive().nullable(),
  changedAt: z.string().datetime(),
  policyVersion: z.number().int().positive(),
})

const organizationModelPricingPolicySchema = organizationModelPricingPolicyInputSchema.extend({
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime().nullable(),
  updatedByUserId: z.string().min(1).max(160).nullable(),
  auditTrail: z.array(organizationModelPricingAuditEntrySchema).max(500),
})

export type OrganizationModelPricingPolicyInput = z.infer<typeof organizationModelPricingPolicyInputSchema>
export type OrganizationModelPricingPolicy = z.infer<typeof organizationModelPricingPolicySchema>

export const DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY: OrganizationModelPricingPolicy = {
  modelMultiplierOverridesBps: {},
  version: 0,
  updatedAt: null,
  updatedByUserId: null,
  auditTrail: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseMetadata(input: Record<string, unknown> | string | null | undefined): Record<string, unknown> {
  if (!input) return {}
  if (typeof input !== "string") return isRecord(input) ? input : {}
  try {
    const parsed = JSON.parse(input) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function readOrganizationModelPolicy(
  metadata: Record<string, unknown> | string | null | undefined,
): OrganizationModelPolicy {
  const parsed = parseMetadata(metadata)
  const candidate = organizationModelPolicyInputSchema.safeParse(parsed.renworkModelPolicy)
  return candidate.success ? candidate.data : DEFAULT_ORGANIZATION_MODEL_POLICY
}

export function writeOrganizationModelPolicy(
  metadata: Record<string, unknown> | string | null | undefined,
  policy: OrganizationModelPolicy,
) {
  const parsed = parseMetadata(metadata)
  return {
    ...parsed,
    renworkModelPolicy: policy,
  }
}

export function readOrganizationModelPricingPolicy(
  metadata: Record<string, unknown> | string | null | undefined,
): OrganizationModelPricingPolicy {
  const parsed = parseMetadata(metadata)
  const candidate = organizationModelPricingPolicySchema.safeParse(parsed.renworkModelPricingPolicy)
  return candidate.success ? candidate.data : DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY
}

export function updateOrganizationModelPricingPolicy(input: {
  metadata: Record<string, unknown> | string | null | undefined
  organizationId: string
  actorUserId: string
  pricing: OrganizationModelPricingPolicyInput
  changedAt?: Date
}) {
  const metadata = parseMetadata(input.metadata)
  const current = readOrganizationModelPricingPolicy(metadata)
  const skus = new Set([
    ...Object.keys(current.modelMultiplierOverridesBps),
    ...Object.keys(input.pricing.modelMultiplierOverridesBps),
  ])
  const changes = [...skus].filter(
    (sku) => current.modelMultiplierOverridesBps[sku] !== input.pricing.modelMultiplierOverridesBps[sku],
  )
  if (changes.length === 0) return { metadata, policy: current }

  const version = current.version + 1
  const changedAt = (input.changedAt ?? new Date()).toISOString()
  const auditTrail = [
    ...current.auditTrail,
    ...changes.map((modelSku) => ({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      modelSku,
      previousMultiplierBps: current.modelMultiplierOverridesBps[modelSku] ?? null,
      nextMultiplierBps: input.pricing.modelMultiplierOverridesBps[modelSku] ?? null,
      changedAt,
      policyVersion: version,
    })),
  ].slice(-500)
  const policy: OrganizationModelPricingPolicy = {
    modelMultiplierOverridesBps: { ...input.pricing.modelMultiplierOverridesBps },
    version,
    updatedAt: changedAt,
    updatedByUserId: input.actorUserId,
    auditTrail,
  }
  return { metadata: { ...metadata, renworkModelPricingPolicy: policy }, policy }
}

export function applyOrganizationPricingToAdminModel(
  model: RenWorkAdminModel,
  pricing: OrganizationModelPricingPolicy,
): RenWorkAdminModel {
  const override = pricing.modelMultiplierOverridesBps[model.sku]
  if (override === undefined) return model
  return {
    ...model,
    displayMultiplierBps: override,
    priceMultiplierBps: override,
    promotion: null,
  }
}

export function effectivePlatformPriceMultiplierBps(model: RenWorkAdminModel, now = new Date()) {
  if (!model.promotion) return model.priceMultiplierBps
  const startsAt = Date.parse(model.promotion.startsAt)
  const endsAt = Date.parse(model.promotion.endsAt)
  const active = Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && startsAt <= now.getTime() && now.getTime() < endsAt
  return active
    ? Math.ceil(model.priceMultiplierBps * model.promotion.multiplierBps / 10_000)
    : model.priceMultiplierBps
}

export function applyOrganizationPricingToPublicCatalog(
  catalog: RenWorkPublicModelCatalog,
  pricing: OrganizationModelPricingPolicy,
): RenWorkPublicModelCatalog {
  return {
    ...catalog,
    version: `${catalog.version}:org-pricing-${pricing.version}`,
    models: catalog.models.map((model) => {
      const override = pricing.modelMultiplierOverridesBps[model.sku]
      return override === undefined ? model : {
        ...model,
        displayMultiplierBps: override,
        effectiveDisplayMultiplierBps: override,
        promotionLabel: null,
        promotionEndsAt: null,
      }
    }),
  }
}

export function organizationPricingEvidence(model: RenWorkAdminModel, pricing: OrganizationModelPricingPolicy) {
  const override = pricing.modelMultiplierOverridesBps[model.sku] ?? null
  const platformMultiplier = effectivePlatformPriceMultiplierBps(model)
  return {
    platformPriceMultiplierBps: platformMultiplier,
    organizationMultiplierOverrideBps: override,
    effectivePriceMultiplierBps: override ?? platformMultiplier,
    pricingPolicyVersion: pricing.version,
  }
}

export function resolveMemberMonthlyBudget(
  policy: OrganizationModelPolicy,
  memberId: string | null | undefined,
) {
  if (!memberId) return null
  return policy.memberMonthlyBudgetMicroCredits[memberId] ?? null
}
