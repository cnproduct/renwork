import { and, desc, eq, isNull, sql } from "@openwork-ee/den-db/drizzle"
import {
  MemberTable,
  OrganizationTable,
  RenCreditLedgerEntryTable,
  RenCreditWalletTable,
  RenworkOfflineOrderTable,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { REN_CREDIT_MICRO_UNITS } from "@openwork/rencredit-metering"
import { db } from "./db.js"
import { DEFAULT_ORGANIZATION_LIMITS, normalizeOrganizationMetadata } from "./organization-limits.js"
import { readOrganizationModelPolicy } from "./organization-model-policy.js"
import { getRenworkPlanCatalog } from "./renwork-growth/plan-catalog.js"

type OrganizationId = typeof OrganizationTable.$inferSelect.id
type UserId = typeof RenworkOfflineOrderTable.$inferSelect.created_by_user_id
type OfflineOrderId = typeof RenworkOfflineOrderTable.$inferSelect.id
type PaymentMethod = typeof RenworkOfflineOrderTable.$inferInsert.payment_method

type JsonRecord = Record<string, unknown>

export type OfflineOffer = {
  catalogVersion: string
  planId: string
  planName: string
  audience: "personal" | "enterprise"
  seatLimit: number
  offerId: string
  billingInterval: "monthly" | "annual"
  currency: "CNY"
  priceMinor: number
  includedRenCredits: number
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function calculateOfflinePeriodEnd(start: Date, interval: OfflineOffer["billingInterval"]) {
  const monthOffset = interval === "monthly" ? 1 : 12
  const absoluteMonth = start.getUTCFullYear() * 12 + start.getUTCMonth() + monthOffset
  const targetYear = Math.floor(absoluteMonth / 12)
  const targetMonth = absoluteMonth % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(start.getUTCDate(), lastDay),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  ))
}

export function listOfflineOffers(): OfflineOffer[] {
  const catalog = getRenworkPlanCatalog()
  return catalog.plans.flatMap((plan) => {
    const seatLimit = plan.seatLimit
    if (!seatLimit) return []
    return plan.offers.flatMap((offer) => {
      if (
        offer.purchaseMode !== "request_access"
        || (offer.billingInterval !== "monthly" && offer.billingInterval !== "annual")
        || offer.currency !== "CNY"
        || offer.priceMinor === null
        || offer.includedRenCredits === null
      ) return []
      return [{
        catalogVersion: catalog.catalogVersion,
        planId: plan.id,
        planName: plan.displayName,
        audience: plan.audience,
        seatLimit,
        offerId: offer.id,
        billingInterval: offer.billingInterval,
        currency: offer.currency,
        priceMinor: offer.priceMinor,
        includedRenCredits: offer.includedRenCredits,
      }]
    })
  })
}

export function resolveOfflineOffer(offerId: string): OfflineOffer {
  const offer = listOfflineOffers().find((candidate) => candidate.offerId === offerId)
  if (!offer) throw new Error("RENWORK_OFFLINE_OFFER_NOT_FOUND")
  return offer
}

function orderGrantKey(orderId: OfflineOrderId) {
  return `offline-order:${orderId}:grant`
}

function orderRefundKey(orderId: OfflineOrderId) {
  return `offline-order:${orderId}:refund`
}

export async function createOfflineOrder(input: {
  organizationId: OrganizationId
  actorUserId: UserId
  offerId: string
  amountMinor: number
  paymentMethod: PaymentMethod
  paymentReference: string
  idempotencyKey: string
  note?: string | null
  now?: Date
}) {
  const offer = resolveOfflineOffer(input.offerId)
  if (input.amountMinor !== offer.priceMinor) throw new Error("RENWORK_OFFLINE_AMOUNT_MISMATCH")
  const now = input.now ?? new Date()
  const periodEnd = calculateOfflinePeriodEnd(now, offer.billingInterval)
  const grantedMicroCredits = offer.includedRenCredits * REN_CREDIT_MICRO_UNITS
  if (!Number.isSafeInteger(grantedMicroCredits)) throw new Error("RENWORK_OFFLINE_GRANT_INVALID")

  const result = await db.transaction(async (tx) => {
    // Lock the tenant before the idempotency lookup so concurrent submissions
    // for the same organization serialize and the loser observes the winner.
    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, input.organizationId)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")

    const [existing] = await tx
      .select()
      .from(RenworkOfflineOrderTable)
      .where(and(
        eq(RenworkOfflineOrderTable.organization_id, input.organizationId),
        eq(RenworkOfflineOrderTable.idempotency_key, input.idempotencyKey),
      ))
      .limit(1)
    if (existing) {
      if (
        existing.offer_id !== offer.offerId
        || existing.amount_minor !== input.amountMinor
        || existing.payment_reference !== input.paymentReference
        || existing.payment_method !== input.paymentMethod
      ) throw new Error("RENWORK_OFFLINE_IDEMPOTENCY_CONFLICT")
      const [wallet] = await tx.select().from(RenCreditWalletTable)
        .where(eq(RenCreditWalletTable.organization_id, input.organizationId)).limit(1)
      return { order: existing, wallet: wallet ?? null, replayed: true as const }
    }

    const [memberCountRow] = await tx.select({ count: sql<number>`count(*)` }).from(MemberTable)
      .where(and(eq(MemberTable.organizationId, input.organizationId), isNull(MemberTable.removedAt)))
    if (Number(memberCountRow?.count ?? 0) > offer.seatLimit) {
      throw new Error("RENWORK_OFFLINE_SEAT_LIMIT_EXCEEDED")
    }

    const { metadata } = normalizeOrganizationMetadata(organization.metadata)
    const previousEntitlementSnapshot = {
      plan: metadata.plan ?? null,
      renworkAccessGrant: metadata.renworkAccessGrant ?? null,
      limits: metadata.limits,
    }
    const orderId = createDenTypeId("renworkOfflineOrder")
    const orderValues: typeof RenworkOfflineOrderTable.$inferInsert = {
      id: orderId,
      organization_id: input.organizationId,
      created_by_user_id: input.actorUserId,
      plan_id: offer.planId,
      offer_id: offer.offerId,
      catalog_version: offer.catalogVersion,
      currency: offer.currency,
      amount_minor: input.amountMinor,
      granted_microcredits: grantedMicroCredits,
      payment_method: input.paymentMethod,
      payment_reference: input.paymentReference,
      idempotency_key: input.idempotencyKey,
      current_period_start: now,
      current_period_end: periodEnd,
      seat_limit: offer.seatLimit,
      catalog_snapshot: offer,
      model_policy_snapshot: readOrganizationModelPolicy(metadata),
      previous_entitlement_snapshot: previousEntitlementSnapshot,
      note: input.note ?? null,
    }
    await tx.insert(RenworkOfflineOrderTable).values(orderValues)

    const nextMetadata: JsonRecord = {
      ...metadata,
      limits: { ...metadata.limits, members: offer.seatLimit },
      plan: {
        tier: offer.audience === "enterprise" ? "enterprise" : "team",
        source: "manual",
        planId: offer.planId,
        offerId: offer.offerId,
        catalogVersion: offer.catalogVersion,
        offlineOrderId: orderId,
        currentPeriodEndsAt: periodEnd.toISOString(),
      },
      renworkAccessGrant: {
        status: "active",
        source: "offline_payment",
        startsAt: now.toISOString(),
        expiresAt: periodEnd.toISOString(),
        modelSkus: null,
        reason: `Offline payment ${input.paymentReference}`,
        grantedBy: input.actorUserId,
        orderId,
      },
    }
    delete nextMetadata.renworkSubscriptionRequest
    await tx.update(OrganizationTable).set({ metadata: nextMetadata })
      .where(eq(OrganizationTable.id, input.organizationId))

    await tx.insert(RenCreditWalletTable).values({ organization_id: input.organizationId }).onDuplicateKeyUpdate({
      set: { organization_id: input.organizationId },
    })
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, input.organizationId)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits + grantedMicroCredits
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, input.organizationId))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"),
      organization_id: input.organizationId,
      reservation_id: null,
      entry_type: "grant",
      idempotency_key: orderGrantKey(orderId),
      amount_microcredits: grantedMicroCredits,
      available_delta_microcredits: grantedMicroCredits,
      reserved_delta_microcredits: 0,
      available_balance_after: available,
      reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version,
      reason_code: "offline_plan_activation",
      metadata: { orderId, offerId: offer.offerId, catalogVersion: offer.catalogVersion, actorUserId: input.actorUserId },
    })

    return {
      order: { ...orderValues, status: "active" as const, reversed_at: null, reversed_by_user_id: null, reversal_reason: null },
      wallet: { ...wallet, available_microcredits: available, version },
      replayed: false as const,
    }
  })
  return result
}

export async function reverseOfflineOrder(input: {
  orderId: OfflineOrderId
  actorUserId: UserId
  reason: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(RenworkOfflineOrderTable)
      .where(eq(RenworkOfflineOrderTable.id, input.orderId)).for("update").limit(1)
    if (!order) throw new Error("RENWORK_OFFLINE_ORDER_NOT_FOUND")
    if (order.status === "reversed") {
      const [wallet] = await tx.select().from(RenCreditWalletTable)
        .where(eq(RenCreditWalletTable.organization_id, order.organization_id)).limit(1)
      return { order, wallet: wallet ?? null, replayed: true as const }
    }

    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, order.organization_id)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")
    const { metadata } = normalizeOrganizationMetadata(organization.metadata)
    const currentPlan = isRecord(metadata.plan) ? metadata.plan : null
    const currentGrant = isRecord(metadata.renworkAccessGrant) ? metadata.renworkAccessGrant : null
    if (currentPlan?.offlineOrderId === order.id || currentGrant?.orderId === order.id) {
      const previous = isRecord(order.previous_entitlement_snapshot) ? order.previous_entitlement_snapshot : {}
      const previousLimits = isRecord(previous.limits) ? previous.limits : metadata.limits
      const restoredMetadata: JsonRecord = {
        ...metadata,
        limits: {
          ...metadata.limits,
          members: typeof previousLimits.members === "number" && previousLimits.members > 0
            ? previousLimits.members
            : DEFAULT_ORGANIZATION_LIMITS.members,
        },
        plan: isRecord(previous.plan) ? previous.plan : { tier: "free", source: "default" },
      }
      if (isRecord(previous.renworkAccessGrant)) restoredMetadata.renworkAccessGrant = previous.renworkAccessGrant
      else delete restoredMetadata.renworkAccessGrant
      await tx.update(OrganizationTable).set({ metadata: restoredMetadata })
        .where(eq(OrganizationTable.id, order.organization_id))
    }

    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, order.organization_id)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits - order.granted_microcredits
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, order.organization_id))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"),
      organization_id: order.organization_id,
      reservation_id: null,
      entry_type: "refund",
      idempotency_key: orderRefundKey(order.id),
      amount_microcredits: order.granted_microcredits,
      available_delta_microcredits: -order.granted_microcredits,
      reserved_delta_microcredits: 0,
      available_balance_after: available,
      reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version,
      reason_code: "offline_plan_reversal",
      metadata: { orderId: order.id, actorUserId: input.actorUserId, reason: input.reason },
    })
    await tx.update(RenworkOfflineOrderTable).set({
      status: "reversed",
      reversed_at: now,
      reversed_by_user_id: input.actorUserId,
      reversal_reason: input.reason,
    }).where(eq(RenworkOfflineOrderTable.id, order.id))

    return {
      order: { ...order, status: "reversed" as const, reversed_at: now, reversed_by_user_id: input.actorUserId, reversal_reason: input.reason },
      wallet: { ...wallet, available_microcredits: available, version },
      replayed: false as const,
    }
  })
}

export async function listOfflineOrders(input: { organizationId?: OrganizationId; limit?: number }) {
  const query = db.select().from(RenworkOfflineOrderTable)
  const rows = input.organizationId
    ? await query.where(eq(RenworkOfflineOrderTable.organization_id, input.organizationId)).orderBy(desc(RenworkOfflineOrderTable.created_at)).limit(Math.min(100, Math.max(1, input.limit ?? 20)))
    : await query.orderBy(desc(RenworkOfflineOrderTable.created_at)).limit(Math.min(100, Math.max(1, input.limit ?? 50)))
  return rows
}
