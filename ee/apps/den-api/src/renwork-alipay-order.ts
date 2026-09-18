import { and, eq, isNull, lt, sql } from "@openwork-ee/den-db/drizzle"
import {
  MemberTable,
  OrganizationTable,
  RenCreditLedgerEntryTable,
  RenCreditWalletTable,
  RenworkAlipayOrderTable,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { REN_CREDIT_MICRO_UNITS } from "@openwork/rencredit-metering"
import { db } from "./db.js"
import { env } from "./env.js"
import { DEFAULT_ORGANIZATION_LIMITS, normalizeOrganizationMetadata } from "./organization-limits.js"
import { createAlipayCheckoutUrl, requestAlipayFullRefund, verifyAlipayNotification, type AlipayConfiguration } from "./renwork-alipay-protocol.js"
import { calculateOfflinePeriodEnd, listOfflineOffers, type OfflineOffer } from "./renwork-offline-order.js"

type OrganizationId = typeof OrganizationTable.$inferSelect.id
type UserId = typeof RenworkAlipayOrderTable.$inferSelect.created_by_user_id
type OrderId = typeof RenworkAlipayOrderTable.$inferSelect.id
type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function config(): AlipayConfiguration {
  const { enabled, appId, sellerId, privateKey, publicKey } = env.renworkAlipay
  if (!enabled || !appId || !sellerId || !privateKey || !publicKey || !env.apiPublicUrl || !env.betterAuthUrl) {
    throw new Error("RENWORK_ALIPAY_UNAVAILABLE")
  }
  if (!env.apiPublicUrl.startsWith("https://") || !env.betterAuthUrl.startsWith("https://")) {
    throw new Error("RENWORK_ALIPAY_HTTPS_REQUIRED")
  }
  return { appId, sellerId, privateKey, publicKey }
}

function snapshotOffer(value: unknown): OfflineOffer {
  if (!isRecord(value) || typeof value.includedRenCredits !== "number" || !Number.isSafeInteger(value.includedRenCredits)
    || typeof value.seatLimit !== "number" || (value.billingInterval !== "monthly" && value.billingInterval !== "annual")
    || typeof value.planId !== "string" || typeof value.offerId !== "string" || typeof value.catalogVersion !== "string"
    || value.currency !== "CNY" || typeof value.priceMinor !== "number") {
    throw new Error("RENWORK_ALIPAY_SNAPSHOT_INVALID")
  }
  return {
    catalogVersion: value.catalogVersion,
    planId: value.planId,
    planName: typeof value.planName === "string" ? value.planName : value.planId,
    audience: value.audience === "enterprise" ? "enterprise" : "personal",
    seatLimit: value.seatLimit,
    offerId: value.offerId,
    billingInterval: value.billingInterval,
    currency: "CNY",
    priceMinor: value.priceMinor,
    includedRenCredits: value.includedRenCredits,
  }
}

export async function createAlipayOrder(input: {
  organizationId: OrganizationId
  actorUserId: UserId
  offerId: string
  idempotencyKey: string
}) {
  const merchant = config()
  const offer = listOfflineOffers().find((candidate) => candidate.offerId === input.offerId)
  if (!offer || offer.source !== "catalog" || offer.priceMinor <= 0) throw new Error("RENWORK_ALIPAY_OFFER_UNAVAILABLE")
  const order = await db.transaction(async (tx) => {
    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, input.organizationId)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")
    const [existing] = await tx.select().from(RenworkAlipayOrderTable).where(and(
      eq(RenworkAlipayOrderTable.organization_id, input.organizationId),
      eq(RenworkAlipayOrderTable.idempotency_key, input.idempotencyKey),
    )).limit(1)
    if (existing) {
      if (existing.offer_id !== offer.offerId || existing.status !== "pending") throw new Error("RENWORK_ALIPAY_IDEMPOTENCY_CONFLICT")
      return existing
    }
    const [pending] = await tx.select({ id: RenworkAlipayOrderTable.id }).from(RenworkAlipayOrderTable).where(and(
      eq(RenworkAlipayOrderTable.organization_id, input.organizationId),
      eq(RenworkAlipayOrderTable.status, "pending"),
    )).limit(1)
    if (pending) throw new Error("RENWORK_ALIPAY_PENDING_ORDER_EXISTS")
    const metadata = normalizeOrganizationMetadata(organization.metadata).metadata
    if (isRecord(metadata.renworkAccessGrant) && metadata.renworkAccessGrant.status === "active"
      && typeof metadata.renworkAccessGrant.expiresAt === "string" && Date.parse(metadata.renworkAccessGrant.expiresAt) > Date.now()) {
      throw new Error("RENWORK_ALIPAY_EXISTING_PLAN_REQUIRES_REVIEW")
    }
    const [memberCount] = await tx.select({ count: sql<number>`count(*)` }).from(MemberTable)
      .where(and(eq(MemberTable.organizationId, input.organizationId), isNull(MemberTable.removedAt)))
    if (Number(memberCount?.count ?? 0) > offer.seatLimit) throw new Error("RENWORK_ALIPAY_SEAT_LIMIT_EXCEEDED")
    const values: typeof RenworkAlipayOrderTable.$inferInsert = {
      id: createDenTypeId("renworkAlipayOrder"),
      organization_id: input.organizationId,
      created_by_user_id: input.actorUserId,
      offer_id: offer.offerId,
      catalog_version: offer.catalogVersion,
      catalog_snapshot: offer,
      currency: "CNY",
      amount_minor: offer.priceMinor,
      idempotency_key: input.idempotencyKey,
    }
    await tx.insert(RenworkAlipayOrderTable).values(values)
    return { ...values, status: "pending" as const }
  })
  const notifyUrl = `${env.apiPublicUrl}/v1/webhooks/renwork/alipay`
  const returnUrl = new URL(`/dashboard/inference?alipay_order=${encodeURIComponent(order.id)}`, env.betterAuthUrl).toString()
  return {
    orderId: order.id,
    status: order.status,
    url: createAlipayCheckoutUrl({
      config: merchant,
      outTradeNo: order.id,
      amountMinor: order.amount_minor,
      title: `RenWork ${offer.planName}`,
      notifyUrl,
      returnUrl,
    }),
  }
}

export async function readAlipayOrder(input: { organizationId: OrganizationId; orderId: OrderId }) {
  const [order] = await db.select({
    id: RenworkAlipayOrderTable.id,
    offerId: RenworkAlipayOrderTable.offer_id,
    status: RenworkAlipayOrderTable.status,
    amountMinor: RenworkAlipayOrderTable.amount_minor,
    paidAt: RenworkAlipayOrderTable.paid_at,
  }).from(RenworkAlipayOrderTable).where(and(
    eq(RenworkAlipayOrderTable.id, input.orderId),
    eq(RenworkAlipayOrderTable.organization_id, input.organizationId),
  )).limit(1)
  return order ?? null
}

export async function settleAlipayNotification(body: string) {
  const notice = verifyAlipayNotification(body, config())
  const [located] = await db.select({ organizationId: RenworkAlipayOrderTable.organization_id })
    .from(RenworkAlipayOrderTable).where(eq(RenworkAlipayOrderTable.id, notice.outTradeNo as OrderId)).limit(1)
  if (!located) throw new Error("RENWORK_ALIPAY_ORDER_NOT_FOUND")
  return db.transaction(async (tx) => {
    // Match checkout lock order (organization then order) to serialize callbacks.
    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, located.organizationId)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")
    const [order] = await tx.select().from(RenworkAlipayOrderTable)
      .where(eq(RenworkAlipayOrderTable.id, notice.outTradeNo as OrderId)).for("update").limit(1)
    if (!order || order.organization_id !== organization.id || order.amount_minor !== notice.amountMinor || order.currency !== "CNY") {
      throw new Error("RENWORK_ALIPAY_ORDER_MISMATCH")
    }
    if ((order.status === "paid" || order.status === "paid_review") && order.provider_trade_no === notice.providerTradeNo) return { replayed: true, organizationId: organization.id }
    if (order.status !== "pending") throw new Error("RENWORK_ALIPAY_ORDER_CONFLICT")
    const offer = snapshotOffer(order.catalog_snapshot)
    if (offer.priceMinor !== order.amount_minor || offer.offerId !== order.offer_id || offer.catalogVersion !== order.catalog_version) {
      throw new Error("RENWORK_ALIPAY_SNAPSHOT_INVALID")
    }
    const paidAt = new Date()
    const periodEnd = calculateOfflinePeriodEnd(paidAt, offer.billingInterval)
    const granted = offer.includedRenCredits * REN_CREDIT_MICRO_UNITS
    if (!Number.isSafeInteger(granted) || granted < 0) throw new Error("RENWORK_ALIPAY_GRANT_INVALID")
    const { metadata } = normalizeOrganizationMetadata(organization.metadata)
    const currentGrant = isRecord(metadata.renworkAccessGrant) ? metadata.renworkAccessGrant : null
    if (currentGrant?.status === "active" && typeof currentGrant.expiresAt === "string"
      && Date.parse(currentGrant.expiresAt) > paidAt.getTime()) {
      await tx.update(RenworkAlipayOrderTable).set({ status: "paid_review", provider_trade_no: notice.providerTradeNo,
        paid_at: paidAt, period_end: periodEnd }).where(eq(RenworkAlipayOrderTable.id, order.id))
      return { replayed: false, organizationId: organization.id, needsReview: true }
    }
    const previous = { plan: metadata.plan ?? null, renworkAccessGrant: metadata.renworkAccessGrant ?? null, limits: metadata.limits }
    const next: JsonRecord = {
      ...metadata,
      limits: { ...metadata.limits, members: offer.seatLimit },
      plan: { tier: offer.audience === "enterprise" ? "enterprise" : "team", source: "alipay", planId: offer.planId,
        offerId: offer.offerId, catalogVersion: offer.catalogVersion, alipayOrderId: order.id, currentPeriodEndsAt: periodEnd.toISOString() },
      renworkAccessGrant: { status: "active", source: "online_payment", startsAt: paidAt.toISOString(),
        expiresAt: periodEnd.toISOString(), modelSkus: null, reason: `Alipay order ${order.id}`, grantedBy: order.created_by_user_id, orderId: order.id },
    }
    delete next.renworkSubscriptionRequest
    await tx.update(OrganizationTable).set({ metadata: next }).where(eq(OrganizationTable.id, organization.id))
    await tx.insert(RenCreditWalletTable).values({ organization_id: organization.id }).onDuplicateKeyUpdate({
      set: { organization_id: organization.id },
    })
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, organization.id)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits + granted
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, organization.id))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"), organization_id: organization.id, reservation_id: null,
      entry_type: "grant", idempotency_key: `alipay-order:${order.id}:month:0`, amount_microcredits: granted,
      available_delta_microcredits: granted, reserved_delta_microcredits: 0,
      available_balance_after: available, reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version, reason_code: "alipay_plan_activation",
      metadata: { orderId: order.id, providerTradeNo: notice.providerTradeNo, offerId: offer.offerId },
    })
    await tx.update(RenworkAlipayOrderTable).set({ status: "paid", provider_trade_no: notice.providerTradeNo,
      paid_at: paidAt, period_end: periodEnd, granted_months: offer.billingInterval === "annual" ? 1 : 12,
      previous_entitlement_snapshot: previous })
      .where(eq(RenworkAlipayOrderTable.id, order.id))
    return { replayed: false, organizationId: organization.id }
  })
}

export function alipayGrantMonthStart(paidAt: Date, month: number) {
  if (!Number.isInteger(month) || month < 0 || month >= 12) throw new Error("RENWORK_ALIPAY_GRANT_MONTH_INVALID")
  const absoluteMonth = paidAt.getUTCFullYear() * 12 + paidAt.getUTCMonth() + month
  const year = Math.floor(absoluteMonth / 12)
  const calendarMonth = absoluteMonth % 12
  const lastDay = new Date(Date.UTC(year, calendarMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, calendarMonth, Math.min(paidAt.getUTCDate(), lastDay),
    paidAt.getUTCHours(), paidAt.getUTCMinutes(), paidAt.getUTCSeconds(), paidAt.getUTCMilliseconds()))
}

export async function grantDueAlipayMonth(input: { orderId: OrderId; organizationId: OrganizationId; now?: Date }) {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, input.organizationId)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")
    const [order] = await tx.select().from(RenworkAlipayOrderTable).where(and(
      eq(RenworkAlipayOrderTable.id, input.orderId), eq(RenworkAlipayOrderTable.organization_id, organization.id),
    )).for("update").limit(1)
    if (!order || order.status !== "paid" || !order.paid_at || !order.period_end || order.granted_months >= 12) return false
    const { metadata } = normalizeOrganizationMetadata(organization.metadata)
    const currentGrant = isRecord(metadata.renworkAccessGrant) ? metadata.renworkAccessGrant : null
    if (currentGrant?.status !== "active" || currentGrant.orderId !== order.id) return false
    const offer = snapshotOffer(order.catalog_snapshot)
    if (offer.billingInterval !== "annual" || order.granted_months < 1 || now >= order.period_end
      || alipayGrantMonthStart(order.paid_at, order.granted_months) > now) return false
    const amount = offer.includedRenCredits * REN_CREDIT_MICRO_UNITS
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("RENWORK_ALIPAY_GRANT_INVALID")
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, organization.id)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits + amount
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, organization.id))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"), organization_id: organization.id, reservation_id: null,
      entry_type: "grant", idempotency_key: `alipay-order:${order.id}:month:${order.granted_months}`,
      amount_microcredits: amount, available_delta_microcredits: amount, reserved_delta_microcredits: 0,
      available_balance_after: available, reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version, reason_code: "alipay_annual_monthly_grant",
      metadata: { orderId: order.id, month: order.granted_months, offerId: offer.offerId },
    })
    await tx.update(RenworkAlipayOrderTable).set({ granted_months: order.granted_months + 1 })
      .where(eq(RenworkAlipayOrderTable.id, order.id))
    return true
  })
}

export async function grantDueAlipayMonths(now = new Date()) {
  if (!env.renworkAlipay.enabled) return 0
  const due = await db.select({ id: RenworkAlipayOrderTable.id, organizationId: RenworkAlipayOrderTable.organization_id })
    .from(RenworkAlipayOrderTable).where(and(
      eq(RenworkAlipayOrderTable.status, "paid"),
      lt(RenworkAlipayOrderTable.granted_months, 12),
    )).limit(100)
  let count = 0
  for (const row of due) {
    for (let month = 1; month < 12; month++) {
      if (!await grantDueAlipayMonth({ orderId: row.id, organizationId: row.organizationId, now })) break
      count++
    }
  }
  return count
}

export async function refundAlipayOrder(input: { orderId: OrderId; actorUserId: UserId; reason: string }) {
  const merchant = config()
  const [original] = await db.select().from(RenworkAlipayOrderTable)
    .where(eq(RenworkAlipayOrderTable.id, input.orderId)).limit(1)
  if (!original) throw new Error("RENWORK_ALIPAY_ORDER_NOT_FOUND")
  if (original.status === "refunded") return { replayed: true, organizationId: original.organization_id }
  if ((original.status !== "paid" && original.status !== "paid_review") || !original.provider_trade_no) throw new Error("RENWORK_ALIPAY_ORDER_NOT_PAID")
  // Stable request number is critical: retrying an uncertain refund cannot issue a second refund.
  await requestAlipayFullRefund({
    config: merchant, outTradeNo: original.id, providerTradeNo: original.provider_trade_no,
    amountMinor: original.amount_minor, requestNo: `refund_${original.id}`, reason: input.reason,
  })
  return db.transaction(async (tx) => {
    const [organization] = await tx.select().from(OrganizationTable)
      .where(eq(OrganizationTable.id, original.organization_id)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")
    const [order] = await tx.select().from(RenworkAlipayOrderTable)
      .where(eq(RenworkAlipayOrderTable.id, original.id)).for("update").limit(1)
    if (!order || order.provider_trade_no !== original.provider_trade_no) throw new Error("RENWORK_ALIPAY_ORDER_CONFLICT")
    if (order.status === "refunded") return { replayed: true, organizationId: organization.id }
    if (order.status !== "paid" && order.status !== "paid_review") throw new Error("RENWORK_ALIPAY_ORDER_CONFLICT")
    const offer = snapshotOffer(order.catalog_snapshot)
    const totalGrants = order.status === "paid_review" ? 0 : offer.includedRenCredits * REN_CREDIT_MICRO_UNITS *
      (offer.billingInterval === "annual" ? order.granted_months : 1)
    if (!Number.isSafeInteger(totalGrants)) throw new Error("RENWORK_ALIPAY_REFUND_CREDIT_INVALID")
    const { metadata } = normalizeOrganizationMetadata(organization.metadata)
    const currentPlan = isRecord(metadata.plan) ? metadata.plan : null
    const currentGrant = isRecord(metadata.renworkAccessGrant) ? metadata.renworkAccessGrant : null
    if (currentPlan?.alipayOrderId === order.id || currentGrant?.orderId === order.id) {
      const previous = isRecord(order.previous_entitlement_snapshot) ? order.previous_entitlement_snapshot : {}
      const limits = isRecord(previous.limits) ? previous.limits : metadata.limits
      const restored: JsonRecord = {
        ...metadata,
        limits: { ...metadata.limits, members: typeof limits.members === "number" && limits.members > 0
          ? limits.members : DEFAULT_ORGANIZATION_LIMITS.members },
        plan: isRecord(previous.plan) ? previous.plan : { tier: "free", source: "default" },
      }
      if (isRecord(previous.renworkAccessGrant)) restored.renworkAccessGrant = previous.renworkAccessGrant
      else delete restored.renworkAccessGrant
      await tx.update(OrganizationTable).set({ metadata: restored }).where(eq(OrganizationTable.id, organization.id))
    }
    if (order.status === "paid_review") {
      await tx.update(RenworkAlipayOrderTable).set({ status: "refunded", refunded_at: new Date() })
        .where(eq(RenworkAlipayOrderTable.id, order.id))
      return { replayed: false, organizationId: organization.id }
    }
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, organization.id)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits - totalGrants
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, organization.id))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"), organization_id: organization.id, reservation_id: null,
      entry_type: "refund", idempotency_key: `alipay-order:${order.id}:refund`,
      amount_microcredits: totalGrants, available_delta_microcredits: -totalGrants, reserved_delta_microcredits: 0,
      available_balance_after: available, reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version, reason_code: "alipay_plan_refund",
      metadata: { orderId: order.id, actorUserId: input.actorUserId, reason: input.reason, grantedMonths: order.granted_months },
    })
    await tx.update(RenworkAlipayOrderTable).set({ status: "refunded", refunded_at: new Date() })
      .where(eq(RenworkAlipayOrderTable.id, order.id))
    return { replayed: false, organizationId: organization.id }
  })
}
