import { z } from "zod"

const MAX_MICROCREDITS = 9_000_000_000_000_000

export const organizationProviderAssignmentSchema = z.object({
  id: z.string().trim().min(1).max(160),
  providerId: z.string().trim().min(1).max(160),
  label: z.string().trim().min(1).max(160),
  allowedModelSkus: z.array(z.string().trim().min(1).max(160)).max(500).nullable(),
  allowedMemberIds: z.array(z.string().trim().min(1).max(160)).max(5_000).nullable(),
  startsAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  enabled: z.boolean(),
}).superRefine((assignment, ctx) => {
  if (
    assignment.startsAt &&
    assignment.expiresAt &&
    Date.parse(assignment.startsAt) >= Date.parse(assignment.expiresAt)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "The provider authorization must expire after it starts.",
    })
  }
})

export const organizationModelPolicyInputSchema = z.object({
  allowedModelSkus: z.array(z.string().trim().min(1).max(160)).max(500).nullable(),
  defaultModelSku: z.string().trim().min(1).max(160).nullable(),
  dailyBudgetMicroCredits: z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  monthlyBudgetMicroCredits: z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  memberMonthlyBudgetMicroCredits: z.record(
    z.string().trim().min(1).max(160),
    z.number().int().min(0).max(MAX_MICROCREDITS).nullable(),
  ),
  memberAllowedModelSkus: z.record(
    z.string().trim().min(1).max(160),
    z.array(z.string().trim().min(1).max(160)).max(500).nullable(),
  ).default({}),
  providerAssignments: z.array(organizationProviderAssignmentSchema).max(500).default([]),
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
  const assignmentIds = new Set<string>()
  for (const [index, assignment] of policy.providerAssignments.entries()) {
    if (assignmentIds.has(assignment.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["providerAssignments", index, "id"],
        message: "Provider authorization IDs must be unique within an organization.",
      })
    }
    assignmentIds.add(assignment.id)
  }
})

// Organization Owners can tune only the published-model allowlist, default,
// and RenCredit budgets. Provider/member routing remains a platform-admin
// decision even when an older or malicious client submits extra fields.
export const organizationOwnerModelPolicyInputSchema = z.object({
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
export type OrganizationOwnerModelPolicy = z.infer<typeof organizationOwnerModelPolicyInputSchema>

export const DEFAULT_ORGANIZATION_MODEL_POLICY: OrganizationModelPolicy = {
  allowedModelSkus: null,
  defaultModelSku: null,
  dailyBudgetMicroCredits: null,
  monthlyBudgetMicroCredits: null,
  memberMonthlyBudgetMicroCredits: {},
  memberAllowedModelSkus: {},
  providerAssignments: [],
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

export function toOrganizationOwnerModelPolicy(
  policy: OrganizationModelPolicy,
): OrganizationOwnerModelPolicy {
  return {
    allowedModelSkus: policy.allowedModelSkus,
    defaultModelSku: policy.defaultModelSku,
    dailyBudgetMicroCredits: policy.dailyBudgetMicroCredits,
    monthlyBudgetMicroCredits: policy.monthlyBudgetMicroCredits,
    memberMonthlyBudgetMicroCredits: policy.memberMonthlyBudgetMicroCredits,
  }
}

export function applyOrganizationOwnerModelPolicy(
  currentPolicy: OrganizationModelPolicy,
  ownerPolicy: OrganizationOwnerModelPolicy,
): OrganizationModelPolicy {
  return {
    ...currentPolicy,
    ...ownerPolicy,
    memberAllowedModelSkus: currentPolicy.memberAllowedModelSkus,
    providerAssignments: currentPolicy.providerAssignments,
  }
}

export function resolveMemberMonthlyBudget(
  policy: OrganizationModelPolicy,
  memberId: string | null | undefined,
) {
  if (!memberId) return null
  return policy.memberMonthlyBudgetMicroCredits[memberId] ?? null
}

export function modelAllowedForMember(
  policy: OrganizationModelPolicy,
  memberId: string | null | undefined,
  modelSku: string,
) {
  if (!memberId) return false
  const allowedModelSkus = policy.memberAllowedModelSkus[memberId]
  return allowedModelSkus === undefined || allowedModelSkus === null || allowedModelSkus.includes(modelSku)
}

function assignmentIsActive(
  assignment: OrganizationModelPolicy["providerAssignments"][number],
  now: Date,
) {
  if (!assignment.enabled) return false
  const timestamp = now.getTime()
  if (assignment.startsAt && Date.parse(assignment.startsAt) > timestamp) return false
  if (assignment.expiresAt && Date.parse(assignment.expiresAt) <= timestamp) return false
  return true
}

export function providerAssignmentAllowsModel(
  policy: OrganizationModelPolicy,
  input: {
    providerId: string
    modelSku: string
    memberId: string | null | undefined
    now?: Date
  },
) {
  const memberId = input.memberId
  if (!memberId) return false
  const now = input.now ?? new Date()
  return policy.providerAssignments.some((assignment) => (
    assignment.providerId === input.providerId &&
    assignmentIsActive(assignment, now) &&
    (assignment.allowedMemberIds === null || assignment.allowedMemberIds.includes(memberId)) &&
    (assignment.allowedModelSkus === null || assignment.allowedModelSkus.includes(input.modelSku))
  ))
}
