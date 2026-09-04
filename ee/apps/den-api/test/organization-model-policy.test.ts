import { describe, expect, test } from "bun:test"
import { calculateRenCreditMicroCharge, type RenWorkAdminModel } from "@openwork/rencredit-metering"
import {
  DEFAULT_ORGANIZATION_MODEL_POLICY,
  DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY,
  applyOrganizationPricingToAdminModel,
  applyOrganizationPricingToPublicCatalog,
  organizationModelPricingPolicyInputSchema,
  organizationModelPolicyInputSchema,
  readOrganizationModelPricingPolicy,
  readOrganizationModelPolicy,
  resolveMemberMonthlyBudget,
  writeOrganizationModelPolicy,
  updateOrganizationModelPricingPolicy,
} from "../src/organization-model-policy"

describe("organization model policy", () => {
  test("preserves unrelated organization metadata", () => {
    const policy = { ...DEFAULT_ORGANIZATION_MODEL_POLICY, allowedModelSkus: ["renwork-standard"], defaultModelSku: "renwork-standard" }
    const metadata = writeOrganizationModelPolicy({ plan: { tier: "team" } }, policy)
    expect(metadata.plan).toEqual({ tier: "team" })
    expect(readOrganizationModelPolicy(metadata)).toEqual(policy)
  })

  test("rejects a default outside the organization allowlist", () => {
    const parsed = organizationModelPolicyInputSchema.safeParse({
      ...DEFAULT_ORGANIZATION_MODEL_POLICY,
      allowedModelSkus: ["renwork-standard"],
      defaultModelSku: "renwork-extreme",
    })
    expect(parsed.success).toBe(false)
  })

  test("resolves only the active member quota", () => {
    const policy = {
      ...DEFAULT_ORGANIZATION_MODEL_POLICY,
      memberMonthlyBudgetMicroCredits: { member_a: 5_000_000, member_b: null },
    }
    expect(resolveMemberMonthlyBudget(policy, "member_a")).toBe(5_000_000)
    expect(resolveMemberMonthlyBudget(policy, "member_b")).toBeNull()
    expect(resolveMemberMonthlyBudget(policy, "member_c")).toBeNull()
  })

  test("rejects zero and records admin-only multiplier audit history", () => {
    expect(organizationModelPricingPolicyInputSchema.safeParse({ modelMultiplierOverridesBps: { model: 0 } }).success).toBe(false)
    const updated = updateOrganizationModelPricingPolicy({
      metadata: {},
      organizationId: "org_1",
      actorUserId: "user_admin",
      pricing: { modelMultiplierOverridesBps: { model: 15_000 } },
      changedAt: new Date("2026-09-04T00:00:00.000Z"),
    })
    expect(readOrganizationModelPricingPolicy(updated.metadata)).toEqual(updated.policy)
    expect(updated.policy.version).toBe(1)
    expect(updated.policy.auditTrail[0]).toMatchObject({ modelSku: "model", previousMultiplierBps: null, nextMultiplierBps: 15_000 })
  })

  test("inherits platform pricing or replaces both display and charge multiplier", () => {
    const model = { sku: "model", displayMultiplierBps: 8_000, priceMultiplierBps: 9_000, promotion: null } as never
    expect(applyOrganizationPricingToAdminModel(model, DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY)).toBe(model)
    expect(applyOrganizationPricingToAdminModel(model, { ...DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY, modelMultiplierOverridesBps: { model: 12_500 } })).toMatchObject({
      displayMultiplierBps: 12_500,
      priceMultiplierBps: 12_500,
    })
  })

  test("charges token usage with the organization effective multiplier", () => {
    const model: RenWorkAdminModel = {
      sku: "model", displayName: "Model", description: "", tier: "standard", status: "published",
      autoEligible: false, contextWindow: null, tags: [], sortOrder: 0,
      displayMultiplierBps: 10_000, priceMultiplierBps: 10_000,
      rates: {
        inputMicroCreditsPerMillion: 1_000_000, outputMicroCreditsPerMillion: 0,
        reasoningMicroCreditsPerMillion: 0, cacheReadMicroCreditsPerMillion: 0,
        cacheWriteMicroCreditsPerMillion: 0,
      },
      promotion: null, allowedPlanIds: [], routes: [],
    }
    const priced = applyOrganizationPricingToAdminModel(model, {
      ...DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY,
      modelMultiplierOverridesBps: { model: 25_000 },
    })
    expect(calculateRenCreditMicroCharge({
      inputTokens: 1_000_000, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    }, priced)).toBe(2_500_000)
  })

  test("resets an override without changing another tenant and keeps only effective public pricing", () => {
    const tenantA = updateOrganizationModelPricingPolicy({
      metadata: {}, organizationId: "org_a", actorUserId: "admin", pricing: { modelMultiplierOverridesBps: { model: 20_000 } },
    })
    const tenantB = readOrganizationModelPricingPolicy({})
    const reset = updateOrganizationModelPricingPolicy({
      metadata: tenantA.metadata, organizationId: "org_a", actorUserId: "admin", pricing: { modelMultiplierOverridesBps: {} },
    })
    expect(reset.policy.modelMultiplierOverridesBps).toEqual({})
    expect(reset.policy.auditTrail.at(-1)).toMatchObject({ previousMultiplierBps: 20_000, nextMultiplierBps: null })
    expect(tenantB).toEqual(DEFAULT_ORGANIZATION_MODEL_PRICING_POLICY)

    const publicCatalog = applyOrganizationPricingToPublicCatalog({
      version: "catalog-1",
      currency: "REN_CREDIT",
      models: [{ sku: "model", displayMultiplierBps: 10_000, effectiveDisplayMultiplierBps: 8_000 } as never],
    }, tenantA.policy)
    expect(publicCatalog.version).toBe("catalog-1:org-pricing-1")
    expect(publicCatalog.models[0]).toMatchObject({ displayMultiplierBps: 20_000, effectiveDisplayMultiplierBps: 20_000 })
    expect(publicCatalog.models[0]).not.toHaveProperty("modelMultiplierOverridesBps")
  })

  test("owner policy schema rejects multiplier injection", () => {
    expect(organizationModelPolicyInputSchema.safeParse({
      ...DEFAULT_ORGANIZATION_MODEL_POLICY,
      modelMultiplierOverridesBps: { model: 1 },
    }).success).toBe(false)
  })
})
