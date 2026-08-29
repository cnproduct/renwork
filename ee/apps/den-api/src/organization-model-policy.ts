import { z } from "zod"

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
}).superRefine((policy, ctx) => {
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

export function resolveMemberMonthlyBudget(
  policy: OrganizationModelPolicy,
  memberId: string | null | undefined,
) {
  if (!memberId) return null
  return policy.memberMonthlyBudgetMicroCredits[memberId] ?? null
}
