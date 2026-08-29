import { eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable } from "@openwork-ee/den-db/schema"
import type { RenworkPlanCatalog } from "@openwork/types/renwork-commerce"
import { db } from "./db.js"
import { getRenworkPlanCatalog } from "./renwork-growth/plan-catalog.js"

type JsonRecord = Record<string, unknown>
type OrganizationId = typeof OrganizationTable.$inferSelect.id

export type RenworkSubscriptionRequest = {
  id: string
  status: "pending"
  catalogVersion: string
  planId: string
  offerId: string
  requestedBy: string
  requestedAt: string
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

function parsePendingRequest(value: unknown): RenworkSubscriptionRequest | null {
  if (!isRecord(value) || value.status !== "pending") return null
  for (const key of ["id", "catalogVersion", "planId", "offerId", "requestedBy", "requestedAt"] as const) {
    if (typeof value[key] !== "string" || !value[key].trim()) return null
  }
  if (!Number.isFinite(Date.parse(value.requestedAt as string))) return null
  return {
    id: value.id as string,
    status: "pending",
    catalogVersion: value.catalogVersion as string,
    planId: value.planId as string,
    offerId: value.offerId as string,
    requestedBy: value.requestedBy as string,
    requestedAt: new Date(value.requestedAt as string).toISOString(),
  }
}

export function readRenworkSubscriptionRequest(
  metadata: JsonRecord | string | null | undefined,
): RenworkSubscriptionRequest | null {
  return parsePendingRequest(parseMetadata(metadata).renworkSubscriptionRequest)
}

export function findRequestableRenworkOffer(catalog: RenworkPlanCatalog, offerId: string) {
  for (const plan of catalog.plans) {
    const offer = plan.offers.find((candidate) => candidate.id === offerId)
    if (!offer) continue
    if (offer.purchaseMode !== "request_access" && offer.purchaseMode !== "contact_sales") return null
    return { plan, offer }
  }
  return null
}

export async function getRenworkSubscriptionRequest(organizationId: OrganizationId) {
  const [organization] = await db
    .select({ metadata: OrganizationTable.metadata })
    .from(OrganizationTable)
    .where(eq(OrganizationTable.id, organizationId))
    .limit(1)
  return readRenworkSubscriptionRequest(organization?.metadata)
}

export async function createRenworkSubscriptionRequest(input: {
  organizationId: OrganizationId
  requestedBy: string
  offerId: string
  now?: Date
}) {
  const catalog = getRenworkPlanCatalog()
  const selected = findRequestableRenworkOffer(catalog, input.offerId)
  if (!selected) return { ok: false as const, reason: "offer_not_requestable" as const }

  const [organization] = await db
    .select({ metadata: OrganizationTable.metadata })
    .from(OrganizationTable)
    .where(eq(OrganizationTable.id, input.organizationId))
    .limit(1)
  if (!organization) return { ok: false as const, reason: "organization_not_found" as const }

  const current = readRenworkSubscriptionRequest(organization.metadata)
  if (current?.offerId === input.offerId) {
    return { ok: true as const, created: false, request: current }
  }

  const now = input.now ?? new Date()
  const request: RenworkSubscriptionRequest = {
    id: `rwreq_${crypto.randomUUID()}`,
    status: "pending",
    catalogVersion: catalog.catalogVersion,
    planId: selected.plan.id,
    offerId: selected.offer.id,
    requestedBy: input.requestedBy,
    requestedAt: now.toISOString(),
  }
  await db
    .update(OrganizationTable)
    .set({
      metadata: {
        ...parseMetadata(organization.metadata),
        renworkSubscriptionRequest: request,
      },
    })
    .where(eq(OrganizationTable.id, input.organizationId))

  return { ok: true as const, created: true, request }
}
