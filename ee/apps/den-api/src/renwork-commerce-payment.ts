import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, lte } from "@openwork-ee/den-db/drizzle"
import {
  CommerceOrderTable,
  CommercePaymentEventTable,
  CommerceRefundTable,
  OrganizationTable,
  RenworkPlanSubscriptionTable,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { REN_CREDIT_MICRO_UNITS } from "@openwork/rencredit-metering"
import type { RenworkCommerceOrder, RenworkPaymentChannel } from "@openwork/types/renwork-commerce"
import { db } from "./db.js"
import { setInferenceEnabled } from "./inference.js"
import { grantRenCredit, refundGrantedRenCredit } from "./rencredit-ledger.js"
import { resolveRenworkModelAccess } from "./renwork-access.js"
import { getRenworkPlanCatalog } from "./renwork-growth/plan-catalog.js"
import { createProviderCheckout, requestProviderRefund, type VerifiedPayment } from "./renwork-payment-providers.js"

type OrganizationId = typeof CommerceOrderTable.$inferSelect.organization_id
type MemberId = typeof CommerceOrderTable.$inferSelect.created_by_member_id
type CommerceOrderId = typeof CommerceOrderTable.$inferSelect.id

function dateIso(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null
}

function serializeOrder(row: typeof CommerceOrderTable.$inferSelect): RenworkCommerceOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    offerId: row.offer_id,
    planId: row.plan_id,
    catalogVersion: row.catalog_version,
    channel: row.channel,
    status: row.status,
    currency: row.currency,
    amountMinor: row.amount_minor,
    includedRenCredits: row.included_rencredits,
    checkoutUrl: row.checkout_url,
    qrCodeUrl: row.qr_code_url,
    expiresAt: dateIso(row.expires_at)!,
    paidAt: dateIso(row.paid_at),
    fulfilledAt: dateIso(row.fulfilled_at),
    createdAt: dateIso(row.created_at)!,
  }
}

function checkoutOffer(offerId: string) {
  const catalog = getRenworkPlanCatalog()
  for (const plan of catalog.plans) {
    const offer = plan.offers.find((candidate) => candidate.id === offerId)
    if (offer?.purchaseMode === "checkout" && plan.audience === "personal") return { catalog, plan, offer }
  }
  return null
}

function providerOrderId() {
  return `RW${Date.now().toString(36).toUpperCase()}${randomBytes(6).toString("hex").toUpperCase()}`
}

function providerRefundId() {
  return `RWR${Date.now().toString(36).toUpperCase()}${randomBytes(6).toString("hex").toUpperCase()}`
}

function addUtcMonths(value: Date, months: number) {
  const result = new Date(value)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

function isDuplicateEntry(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"
}

export async function createRenworkCommerceOrder(input: {
  organizationId: OrganizationId
  memberId: MemberId
  offerId: string
  channel: RenworkPaymentChannel
  idempotencyKey: string
}) {
  const selected = checkoutOffer(input.offerId)
  if (!selected) throw new Error("renwork_checkout_offer_unavailable")
  if (selected.offer.currency !== "CNY") throw new Error("renwork_checkout_currency_unsupported")

  const [existing] = await db.select().from(CommerceOrderTable).where(and(
    eq(CommerceOrderTable.organization_id, input.organizationId),
    eq(CommerceOrderTable.idempotency_key, input.idempotencyKey),
  )).limit(1)
  if (existing) return { order: serializeOrder(existing), replayed: true }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 30 * 60_000)
  const id = createDenTypeId("commerceOrder")
  const upstreamOrderId = providerOrderId()
  const catalog_snapshot = {
    catalogVersion: selected.catalog.catalogVersion,
    plan: selected.plan,
    offer: selected.offer,
  }
  try {
    await db.insert(CommerceOrderTable).values({
      id,
      organization_id: input.organizationId,
      created_by_member_id: input.memberId,
      plan_id: selected.plan.id,
      offer_id: selected.offer.id,
      catalog_version: selected.catalog.catalogVersion,
      channel: input.channel,
      currency: selected.offer.currency,
      amount_minor: selected.offer.priceMinor,
      included_rencredits: selected.offer.includedRenCredits,
      provider_order_id: upstreamOrderId,
      idempotency_key: input.idempotencyKey,
      catalog_snapshot,
      expires_at: expiresAt,
    })
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error
    const [replayed] = await db.select().from(CommerceOrderTable).where(and(
      eq(CommerceOrderTable.organization_id, input.organizationId),
      eq(CommerceOrderTable.idempotency_key, input.idempotencyKey),
    )).limit(1)
    if (!replayed) throw error
    return { order: serializeOrder(replayed), replayed: true }
  }

  try {
    const checkout = await createProviderCheckout(input.channel, {
      providerOrderId: upstreamOrderId,
      description: `RenWork ${selected.plan.displayName} ${selected.offer.billingInterval === "annual" ? "年付" : "月付"}`,
      amountMinor: selected.offer.priceMinor,
      currency: "CNY",
      expiresAt,
    })
    await db.update(CommerceOrderTable).set({ checkout_url: checkout.checkoutUrl, qr_code_url: checkout.qrCodeUrl })
      .where(and(eq(CommerceOrderTable.id, id), eq(CommerceOrderTable.organization_id, input.organizationId)))
  } catch (error) {
    await db.update(CommerceOrderTable).set({ status: "failed", last_error_code: error instanceof Error ? error.message.slice(0, 128) : "provider_checkout_failed" })
      .where(and(eq(CommerceOrderTable.id, id), eq(CommerceOrderTable.organization_id, input.organizationId)))
    throw error
  }

  const [created] = await db.select().from(CommerceOrderTable).where(eq(CommerceOrderTable.id, id)).limit(1)
  if (!created) throw new Error("commerce_order_create_failed")
  return { order: serializeOrder(created), replayed: false }
}

export async function getRenworkCommerceOrder(input: { organizationId: OrganizationId; orderId: CommerceOrderId }) {
  const [order] = await db.select().from(CommerceOrderTable).where(and(
    eq(CommerceOrderTable.id, input.orderId),
    eq(CommerceOrderTable.organization_id, input.organizationId),
  )).limit(1)
  return order ? serializeOrder(order) : null
}

export async function closeRenworkCommerceOrder(input: { organizationId: OrganizationId; orderId: CommerceOrderId }) {
  await db.update(CommerceOrderTable).set({ status: "closed", closed_at: new Date() }).where(and(
    eq(CommerceOrderTable.id, input.orderId),
    eq(CommerceOrderTable.organization_id, input.organizationId),
    eq(CommerceOrderTable.status, "pending"),
  ))
  return getRenworkCommerceOrder(input)
}

async function fulfillPaidOrder(orderId: CommerceOrderId) {
  const [order] = await db.select().from(CommerceOrderTable).where(eq(CommerceOrderTable.id, orderId)).limit(1)
  if (!order) throw new Error("commerce_order_not_found")
  if (order.status === "fulfilled") return serializeOrder(order)
  if (order.status !== "paid") throw new Error("commerce_order_not_paid")

  const selected = checkoutOffer(order.offer_id)
  if (!selected || selected.catalog.catalogVersion !== order.catalog_version) throw new Error("commerce_order_catalog_mismatch")
  const startedAt = order.paid_at ?? new Date()
  const periodEnd = selected.offer.billingInterval === "annual"
    ? addUtcMonths(startedAt, 12)
    : addUtcMonths(startedAt, 1)
  const nextGrantAt = selected.offer.billingInterval === "annual" ? addUtcMonths(startedAt, 1) : null

  await grantRenCredit({
    organizationId: order.organization_id,
    amountMicroCredits: order.included_rencredits * REN_CREDIT_MICRO_UNITS,
    idempotencyKey: `payment:${order.id}:period:${startedAt.toISOString().slice(0, 7)}`,
    reasonCode: "PAYMENT_PLAN_CREDIT_GRANT",
    metadata: { orderId: order.id, planId: order.plan_id, offerId: order.offer_id, catalogVersion: order.catalog_version },
  })
  await db.insert(RenworkPlanSubscriptionTable).values({
    id: createDenTypeId("renworkPlanSubscription"),
    organization_id: order.organization_id,
    source_order_id: order.id,
    plan_id: order.plan_id,
    offer_id: order.offer_id,
    catalog_version: order.catalog_version,
    billing_interval: selected.offer.billingInterval,
    current_period_start: startedAt,
    current_period_end: periodEnd,
    next_credit_grant_at: nextGrantAt,
    granted_rencredits: order.included_rencredits,
  }).onDuplicateKeyUpdate({ set: { status: "active", current_period_end: periodEnd, next_credit_grant_at: nextGrantAt } })

  const [organization] = await db.select({ metadata: OrganizationTable.metadata }).from(OrganizationTable)
    .where(eq(OrganizationTable.id, order.organization_id)).limit(1)
  if (!organization) throw new Error("organization_not_found")
  const metadata = organization.metadata ?? {}
  await db.update(OrganizationTable).set({
    metadata: {
      ...metadata,
      plan: { tier: "team", source: "renwork_payment", paidOrderId: order.id, currentPeriodEndsAt: periodEnd.toISOString() },
    },
  }).where(eq(OrganizationTable.id, order.organization_id))

  await setInferenceEnabled({ organizationId: order.organization_id, enabled: true, tier: "tier1" })
  await db.update(CommerceOrderTable).set({ status: "fulfilled", fulfilled_at: new Date(), last_error_code: null })
    .where(eq(CommerceOrderTable.id, order.id))
  const [fulfilled] = await db.select().from(CommerceOrderTable).where(eq(CommerceOrderTable.id, order.id)).limit(1)
  if (!fulfilled) throw new Error("commerce_order_not_found")
  return serializeOrder(fulfilled)
}

export async function recordVerifiedPayment(input: { payment: VerifiedPayment; rawBody: string }) {
  const payment = input.payment
  const [order] = await db.select().from(CommerceOrderTable).where(and(
    eq(CommerceOrderTable.channel, payment.channel),
    eq(CommerceOrderTable.provider_order_id, payment.providerOrderId),
  )).limit(1)
  if (!order) throw new Error("commerce_order_not_found")

  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex")
  const matches = order.amount_minor === payment.amountMinor && order.currency === payment.currency
  const [existingEvent] = await db.select().from(CommercePaymentEventTable).where(and(
    eq(CommercePaymentEventTable.channel, payment.channel),
    eq(CommercePaymentEventTable.provider_event_id, payment.providerEventId),
  )).limit(1)
  if (existingEvent && existingEvent.payload_hash !== payloadHash) throw new Error("commerce_payment_replay_payload_mismatch")
  if (!existingEvent) {
    try {
      await db.insert(CommercePaymentEventTable).values({
        id: createDenTypeId("commercePaymentEvent"),
        order_id: order.id,
        organization_id: order.organization_id,
        channel: payment.channel,
        provider_event_id: payment.providerEventId,
        event_type: payment.eventType,
        payload_hash: payloadHash,
        verified: matches ? "yes" : "no",
        processed_at: matches ? new Date() : null,
      })
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error
      const [racedEvent] = await db.select().from(CommercePaymentEventTable).where(and(
        eq(CommercePaymentEventTable.channel, payment.channel),
        eq(CommercePaymentEventTable.provider_event_id, payment.providerEventId),
      )).limit(1)
      if (!racedEvent || racedEvent.payload_hash !== payloadHash) throw new Error("commerce_payment_replay_payload_mismatch")
    }
  }
  if (!matches) throw new Error("commerce_payment_amount_mismatch")
  if (["failed", "refunded"].includes(order.status)) throw new Error("commerce_order_not_payable")
  // Provider notifications can arrive after our local expiry sweep. A payment
  // completed before the signed expiry must still be fulfilled, otherwise the
  // customer could be charged without receiving their plan or RenCredit.
  if ((order.status === "pending" || order.status === "closed") && payment.paidAt > order.expires_at) {
    await db.update(CommerceOrderTable).set({ status: "closed", closed_at: new Date(), last_error_code: "order_expired" })
      .where(eq(CommerceOrderTable.id, order.id))
    throw new Error("commerce_order_expired")
  }

  if (order.status === "pending" || order.status === "closed") {
    await db.update(CommerceOrderTable).set({
      status: "paid",
      provider_transaction_id: payment.providerTransactionId,
      paid_at: payment.paidAt,
      last_error_code: null,
    }).where(eq(CommerceOrderTable.id, order.id))
  }
  return fulfillPaidOrder(order.id)
}

export async function refundRenworkCommerceOrder(input: {
  orderId: CommerceOrderId
  idempotencyKey: string
  reason: string
}) {
  const [order] = await db.select().from(CommerceOrderTable).where(eq(CommerceOrderTable.id, input.orderId)).limit(1)
  if (!order) throw new Error("commerce_order_not_found")
  if (order.status !== "fulfilled" && order.status !== "refunded") throw new Error("commerce_order_not_refundable")
  if (!order.provider_transaction_id) throw new Error("commerce_order_transaction_missing")
  const [subscription] = await db.select().from(RenworkPlanSubscriptionTable)
    .where(eq(RenworkPlanSubscriptionTable.source_order_id, order.id)).limit(1)
  if (!subscription) throw new Error("commerce_subscription_not_found")

  let [refund] = await db.select().from(CommerceRefundTable).where(and(
    eq(CommerceRefundTable.organization_id, order.organization_id),
    eq(CommerceRefundTable.idempotency_key, input.idempotencyKey),
  )).limit(1)
  const replayed = Boolean(refund)
  if (refund && refund.order_id !== order.id) throw new Error("commerce_refund_idempotency_conflict")
  if (!refund) {
    const refundId = createDenTypeId("commerceRefund")
    try {
      await db.insert(CommerceRefundTable).values({
        id: refundId,
        order_id: order.id,
        organization_id: order.organization_id,
        amount_minor: order.amount_minor,
        provider_refund_id: providerRefundId(),
        idempotency_key: input.idempotencyKey,
        reason: input.reason,
      })
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error
    }
    ;[refund] = await db.select().from(CommerceRefundTable).where(and(
      eq(CommerceRefundTable.organization_id, order.organization_id),
      eq(CommerceRefundTable.idempotency_key, input.idempotencyKey),
    )).limit(1)
    if (!refund) throw new Error("commerce_refund_create_failed")
  }
  if (refund.status === "succeeded") return { refund, replayed: true }

  let providerResult
  try {
    providerResult = await requestProviderRefund(order.channel, {
      providerOrderId: order.provider_order_id,
      providerTransactionId: order.provider_transaction_id,
      providerRefundId: refund.provider_refund_id,
      amountMinor: order.amount_minor,
      totalAmountMinor: order.amount_minor,
      currency: "CNY",
      reason: refund.reason,
    })
  } catch (error) {
    await db.update(CommerceRefundTable).set({ status: "failed" }).where(eq(CommerceRefundTable.id, refund.id))
    throw error
  }

  await db.update(CommerceRefundTable).set({
    status: providerResult.status,
    completed_at: providerResult.status === "succeeded" ? new Date() : null,
  }).where(eq(CommerceRefundTable.id, refund.id))

  if (providerResult.status === "succeeded") {
    await refundGrantedRenCredit({
      organizationId: order.organization_id,
      amountMicroCredits: subscription.granted_rencredits * REN_CREDIT_MICRO_UNITS,
      idempotencyKey: `payment-refund:${refund.id}:rencredit`,
      reasonCode: "PAYMENT_PLAN_CREDIT_REVERSAL",
      metadata: { orderId: order.id, refundId: refund.id, planId: order.plan_id, providerRefundId: providerResult.providerRefundId },
    })
    await db.update(RenworkPlanSubscriptionTable).set({ status: "refunded", next_credit_grant_at: null })
      .where(eq(RenworkPlanSubscriptionTable.id, subscription.id))
    await db.update(CommerceOrderTable).set({ status: "refunded" }).where(eq(CommerceOrderTable.id, order.id))

    const [organization] = await db.select({ metadata: OrganizationTable.metadata }).from(OrganizationTable)
      .where(eq(OrganizationTable.id, order.organization_id)).limit(1)
    if (organization) {
      const access = await resolveRenworkModelAccess({ organizationId: order.organization_id, metadata: organization.metadata })
      if (!access.allowed) await setInferenceEnabled({ organizationId: order.organization_id, enabled: false })
    }
  }

  const [updatedRefund] = await db.select().from(CommerceRefundTable).where(eq(CommerceRefundTable.id, refund.id)).limit(1)
  if (!updatedRefund) throw new Error("commerce_refund_not_found")
  return { refund: updatedRefund, replayed }
}

export async function organizationHasActiveRenworkPlanSubscription(organizationId: OrganizationId, now = new Date()) {
  const [row] = await db.select({ id: RenworkPlanSubscriptionTable.id }).from(RenworkPlanSubscriptionTable).where(and(
    eq(RenworkPlanSubscriptionTable.organization_id, organizationId),
    eq(RenworkPlanSubscriptionTable.status, "active"),
    lte(RenworkPlanSubscriptionTable.current_period_start, now),
    gt(RenworkPlanSubscriptionTable.current_period_end, now),
  )).limit(1)
  return Boolean(row)
}

export async function reconcileRenworkPlanCreditGrants(limit = 100, now = new Date()) {
  const due = await db.select().from(RenworkPlanSubscriptionTable).where(and(
    eq(RenworkPlanSubscriptionTable.status, "active"),
    lte(RenworkPlanSubscriptionTable.next_credit_grant_at, now),
    gt(RenworkPlanSubscriptionTable.current_period_end, now),
  )).limit(Math.max(1, Math.min(500, limit)))

  let granted = 0
  for (const subscription of due) {
    const [order] = await db.select().from(CommerceOrderTable).where(eq(CommerceOrderTable.id, subscription.source_order_id)).limit(1)
    const grantAt = subscription.next_credit_grant_at
    if (!order || !grantAt) continue
    await grantRenCredit({
      organizationId: subscription.organization_id,
      amountMicroCredits: order.included_rencredits * REN_CREDIT_MICRO_UNITS,
      idempotencyKey: `payment:${order.id}:period:${grantAt.toISOString().slice(0, 7)}`,
      reasonCode: "PAYMENT_PLAN_CREDIT_GRANT",
      metadata: { orderId: order.id, subscriptionId: subscription.id, planId: subscription.plan_id, grantAt: grantAt.toISOString() },
    })
    const next = addUtcMonths(grantAt, 1)
    await db.update(RenworkPlanSubscriptionTable).set({
      next_credit_grant_at: next < subscription.current_period_end ? next : null,
      granted_rencredits: subscription.granted_rencredits + order.included_rencredits,
    }).where(and(
      eq(RenworkPlanSubscriptionTable.id, subscription.id),
      eq(RenworkPlanSubscriptionTable.next_credit_grant_at, grantAt),
    ))
    granted += 1
  }
  return { scanned: due.length, granted }
}

export function startRenworkPlanCreditGrantSweep() {
  const configured = Number(process.env.RENWORK_PLAN_CREDIT_GRANT_SWEEP_INTERVAL_MS ?? "3600000")
  const intervalMs = Number.isSafeInteger(configured) && configured >= 60_000 ? configured : 3_600_000
  let running = false
  let stopped = false
  const run = async () => {
    if (running || stopped) return
    running = true
    try {
      await reconcileRenworkPlanCreditGrants()
    } catch (error) {
      console.error("[commerce] plan credit grant sweep failed", error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(() => void run(), intervalMs)
  timer.unref()
  void run()
  return async () => {
    stopped = true
    clearInterval(timer)
    while (running) await new Promise((resolve) => setTimeout(resolve, 10))
  }
}
