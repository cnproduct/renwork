import { describe, expect, test } from "bun:test"
import {
  DEFAULT_ORGANIZATION_MODEL_POLICY,
  organizationModelPolicyInputSchema,
  readOrganizationModelPolicy,
  modelAllowedForMember,
  providerAssignmentAllowsModel,
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

  test("intersects member model permissions with active provider authorizations", () => {
    const policy = {
      ...DEFAULT_ORGANIZATION_MODEL_POLICY,
      memberAllowedModelSkus: { member_a: ["renwork-code-kimi-k3"] },
      providerAssignments: [{
        id: "assignment_opencode_go",
        providerId: "opencode-go-primary",
        label: "OpenCode Go production authorization",
        allowedModelSkus: ["renwork-code-kimi-k3"],
        allowedMemberIds: ["member_a"],
        startsAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z",
        enabled: true,
      }],
    }

    expect(modelAllowedForMember(policy, "member_a", "renwork-code-kimi-k3")).toBe(true)
    expect(modelAllowedForMember(policy, "member_a", "renwork-standard")).toBe(false)
    expect(providerAssignmentAllowsModel(policy, {
      providerId: "opencode-go-primary",
      modelSku: "renwork-code-kimi-k3",
      memberId: "member_a",
      now: new Date("2026-09-15T00:00:00.000Z"),
    })).toBe(true)
    expect(providerAssignmentAllowsModel(policy, {
      providerId: "opencode-go-primary",
      modelSku: "renwork-code-kimi-k3",
      memberId: "member_b",
      now: new Date("2026-09-15T00:00:00.000Z"),
    })).toBe(false)
  })

  test("fails closed when an organization has no super-admin provider authorization", () => {
    expect(providerAssignmentAllowsModel(DEFAULT_ORGANIZATION_MODEL_POLICY, {
      providerId: "openrouter-primary",
      modelSku: "renwork-standard",
      memberId: "member_a",
    })).toBe(false)
  })
})
