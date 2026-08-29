import { describe, expect, test } from "bun:test"
import {
  DEFAULT_ORGANIZATION_MODEL_POLICY,
  organizationModelPolicyInputSchema,
  readOrganizationModelPolicy,
  resolveMemberMonthlyBudget,
  writeOrganizationModelPolicy,
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
})
