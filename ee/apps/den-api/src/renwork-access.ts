import { organizationHasActiveInferenceSubscription } from "./stripe-billing.js"

type JsonRecord = Record<string, unknown>
type OrganizationId = Parameters<typeof organizationHasActiveInferenceSubscription>[0]

export type RenworkAccessGrant = {
  status: "active"
  source: "campaign" | "super_admin" | "offline_payment"
  startsAt: string
  expiresAt: string
  modelSkus: string[] | null
  reason: string
  grantedBy: string
  orderId?: string
}

export type RenworkModelAccess = {
  allowed: boolean
  source: "subscription" | "campaign" | "super_admin" | "offline_payment" | null
  expiresAt: string | null
  allowedModelSkus: string[] | null
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseMetadata(value: JsonRecord | string | null | undefined): JsonRecord {
  if (!value) return {}
  if (typeof value !== "string") return isRecord(value) ? value : {}
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function validIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

export function readRenworkAccessGrant(
  metadata: JsonRecord | string | null | undefined,
  now = new Date(),
): RenworkAccessGrant | null {
  const raw = parseMetadata(metadata).renworkAccessGrant
  if (!isRecord(raw) || raw.status !== "active") return null
  if (raw.source !== "campaign" && raw.source !== "super_admin" && raw.source !== "offline_payment") return null

  const startsAt = validIsoDate(raw.startsAt)
  const expiresAt = validIsoDate(raw.expiresAt)
  if (!startsAt || !expiresAt || Date.parse(startsAt) > now.getTime() || Date.parse(expiresAt) <= now.getTime()) return null

  const modelSkus = raw.modelSkus === null
    ? null
    : Array.isArray(raw.modelSkus)
      ? [...new Set(raw.modelSkus.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))]
      : null
  if (Array.isArray(raw.modelSkus) && modelSkus?.length === 0) return null
  if (typeof raw.reason !== "string" || !raw.reason.trim()) return null
  if (typeof raw.grantedBy !== "string" || !raw.grantedBy.trim()) return null

  return {
    status: "active",
    source: raw.source,
    startsAt,
    expiresAt,
    modelSkus,
    reason: raw.reason.trim(),
    grantedBy: raw.grantedBy.trim(),
    ...(typeof raw.orderId === "string" && raw.orderId.trim() ? { orderId: raw.orderId.trim() } : {}),
  }
}

export async function resolveRenworkModelAccess(input: {
  organizationId: OrganizationId
  metadata: JsonRecord | string | null | undefined
  now?: Date
}): Promise<RenworkModelAccess> {
  return resolveRenworkModelAccessFromSources({
    hasActiveSubscription: await organizationHasActiveInferenceSubscription(input.organizationId),
    metadata: input.metadata,
    now: input.now,
  })
}

export function resolveRenworkModelAccessFromSources(input: {
  hasActiveSubscription: boolean
  metadata: JsonRecord | string | null | undefined
  now?: Date
}): RenworkModelAccess {
  if (input.hasActiveSubscription) {
    return { allowed: true, source: "subscription", expiresAt: null, allowedModelSkus: null }
  }

  const grant = readRenworkAccessGrant(input.metadata, input.now)
  if (!grant) return { allowed: false, source: null, expiresAt: null, allowedModelSkus: null }
  return {
    allowed: true,
    source: grant.source,
    expiresAt: grant.expiresAt,
    allowedModelSkus: grant.modelSkus,
  }
}

export function accessAllowsModel(access: RenworkModelAccess, modelSku: string) {
  return access.allowed && (!access.allowedModelSkus || access.allowedModelSkus.includes(modelSku))
}
