import { createSign, generateKeyPairSync } from "node:crypto"
import { afterAll, beforeAll, expect, test } from "bun:test"
import { createDenTypeId } from "@openwork-ee/utils/typeid"

const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 })
const alipay = generateKeyPairSync("rsa", { modulusLength: 2048 })
process.env.DATABASE_URL = "mysql://root:password@127.0.0.1:3306/renwork_alipay_v50_local_test"
process.env.DB_MODE = "mysql"
process.env.DEN_DB_ENCRYPTION_KEY = "alipay-test-encryption-key-1234567890"
process.env.BETTER_AUTH_SECRET = "alipay-test-auth-secret-1234567890"
process.env.BETTER_AUTH_URL = "https://example.test"
process.env.DEN_API_PUBLIC_URL = "https://api.example.test"
process.env.RENWORK_ALIPAY_ONLINE_ENABLED = "true"
process.env.RENWORK_ALIPAY_APP_ID = "2021000000000000"
process.env.RENWORK_ALIPAY_SELLER_ID = "2088000000000000"
process.env.RENWORK_ALIPAY_PRIVATE_KEY = merchant.privateKey.export({ type: "pkcs8", format: "pem" }).toString()
process.env.RENWORK_ALIPAY_PUBLIC_KEY = alipay.publicKey.export({ type: "spki", format: "pem" }).toString()

const organizationId = createDenTypeId("organization")
const otherOrganizationId = createDenTypeId("organization")
const userId = createDenTypeId("user")
let db: typeof import("../src/db.js").db
let drizzle: typeof import("@openwork-ee/den-db/drizzle")
let schema: typeof import("@openwork-ee/den-db/schema")
let orders: typeof import("../src/renwork-alipay-order.js")
const originalFetch = globalThis.fetch

function signedNotice(id: string, amount = "698.00") {
  const fields = new URLSearchParams({
    app_id: process.env.RENWORK_ALIPAY_APP_ID!, seller_id: process.env.RENWORK_ALIPAY_SELLER_ID!,
    out_trade_no: id, trade_no: `alipay-v50-${id}`, total_amount: amount,
    trade_status: "TRADE_SUCCESS", sign_type: "RSA2",
  })
  const canonical = [...fields.entries()].filter(([key]) => key !== "sign_type")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("&")
  const signer = createSign("RSA-SHA256")
  signer.update(canonical)
  signer.end()
  fields.set("sign", signer.sign(alipay.privateKey, "base64"))
  return fields.toString()
}

beforeAll(async () => {
  const modules = await Promise.all([
    import("../src/db.js"), import("@openwork-ee/den-db/drizzle"), import("@openwork-ee/den-db/schema"),
    import("../src/renwork-alipay-order.js"),
  ])
  db = modules[0].db
  drizzle = modules[1]
  schema = modules[2]
  orders = modules[3]
  await db.insert(schema.AuthUserTable).values({ id: userId, name: "Alipay Test", email: `${userId}@example.test`, emailVerified: true })
  await db.insert(schema.OrganizationTable).values([
    { id: organizationId, name: "V50 A", slug: `v50-a-${organizationId}`, metadata: { limits: { members: 1, workers: 1 } }, desktopAppRestrictions: {} },
    { id: otherOrganizationId, name: "V50 B", slug: `v50-b-${otherOrganizationId}`, metadata: { limits: { members: 1, workers: 1 } }, desktopAppRestrictions: {} },
  ])
})

afterAll(async () => {
  globalThis.fetch = originalFetch
  if (!db) return
  await db.delete(schema.RenworkAlipayOrderTable).where(drizzle.eq(schema.RenworkAlipayOrderTable.organization_id, organizationId))
  await db.delete(schema.RenCreditLedgerEntryTable).where(drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationId))
  await db.delete(schema.RenCreditWalletTable).where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  await db.delete(schema.OrganizationTable).where(drizzle.eq(schema.OrganizationTable.id, organizationId))
  await db.delete(schema.OrganizationTable).where(drizzle.eq(schema.OrganizationTable.id, otherOrganizationId))
  await db.delete(schema.AuthUserTable).where(drizzle.eq(schema.AuthUserTable.id, userId))
})

test("checkout cannot grant; signed callback grants once, annual month grants once, refund reverses once", async () => {
  const first = await orders.createAlipayOrder({ organizationId, actorUserId: userId,
    offerId: "personal-light-annual", idempotencyKey: "annual-v50-unique" })
  const replayCheckout = await orders.createAlipayOrder({ organizationId, actorUserId: userId,
    offerId: "personal-light-annual", idempotencyKey: "annual-v50-unique" })
  expect(first.orderId).toBe(replayCheckout.orderId)
  expect(await orders.readAlipayOrder({ organizationId: otherOrganizationId, orderId: first.orderId })).toBeNull()
  expect(await db.select().from(schema.RenCreditLedgerEntryTable)
    .where(drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationId))).toHaveLength(0)
  await expect(orders.settleAlipayNotification(signedNotice(first.orderId, "0.01")))
    .rejects.toThrow("RENWORK_ALIPAY_ORDER_MISMATCH")
  const concurrent = await Promise.all([
    orders.settleAlipayNotification(signedNotice(first.orderId)),
    orders.settleAlipayNotification(signedNotice(first.orderId)),
  ])
  expect(concurrent.map((result) => result.replayed).sort()).toEqual([false, true])
  const [wallet] = await db.select().from(schema.RenCreditWalletTable)
    .where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  expect(wallet?.available_microcredits).toBe(2_000_000_000)
  const [paid] = await db.select().from(schema.RenworkAlipayOrderTable)
    .where(drizzle.eq(schema.RenworkAlipayOrderTable.id, first.orderId))
  expect(paid?.paid_at).toBeDefined()
  const now = orders.alipayGrantMonthStart(paid!.paid_at!, 1)
  expect(await orders.grantDueAlipayMonth({ orderId: first.orderId, organizationId, now })).toBe(true)
  expect(await orders.grantDueAlipayMonth({ orderId: first.orderId, organizationId, now })).toBe(false)
  globalThis.fetch = async () => {
    const response = { code: "10000", fund_change: "Y", out_trade_no: first.orderId, refund_fee: "698.00" }
    const raw = JSON.stringify(response)
    const signer = createSign("RSA-SHA256")
    signer.update(raw)
    signer.end()
    return new Response(`{"alipay_trade_refund_response":${raw},"sign":"${signer.sign(alipay.privateKey, "base64")}"}`)
  }
  expect((await orders.refundAlipayOrder({ orderId: first.orderId, actorUserId: userId, reason: "Test full refund" })).replayed).toBe(false)
  expect((await orders.refundAlipayOrder({ orderId: first.orderId, actorUserId: userId, reason: "Test full refund" })).replayed).toBe(true)
  const [reversed] = await db.select().from(schema.RenCreditWalletTable)
    .where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  expect(reversed?.available_microcredits).toBe(0)
  const ledger = await db.select().from(schema.RenCreditLedgerEntryTable)
    .where(drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationId))
  expect(ledger.map((entry) => entry.entry_type).sort()).toEqual(["grant", "grant", "refund"])
})

test("late payment never replaces a newly granted plan and can be fully refunded without credit reversal", async () => {
  const checkout = await orders.createAlipayOrder({ organizationId, actorUserId: userId,
    offerId: "personal-light-annual", idempotencyKey: "late-plan-v50-unique" })
  const [before] = await db.select().from(schema.RenCreditWalletTable)
    .where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  const grant = { status: "active", source: "super_admin", expiresAt: "2099-01-01T00:00:00.000Z" }
  await db.update(schema.OrganizationTable).set({ metadata: { plan: { tier: "team", source: "super_admin" }, renworkAccessGrant: grant } })
    .where(drizzle.eq(schema.OrganizationTable.id, organizationId))
  const settled = await orders.settleAlipayNotification(signedNotice(checkout.orderId))
  expect(settled.replayed).toBe(false)
  expect(settled.needsReview).toBe(true)
  expect((await orders.settleAlipayNotification(signedNotice(checkout.orderId))).replayed).toBe(true)
  const [paidReview] = await db.select().from(schema.RenworkAlipayOrderTable)
    .where(drizzle.eq(schema.RenworkAlipayOrderTable.id, checkout.orderId))
  expect(paidReview.status).toBe("paid_review")
  const [unchanged] = await db.select().from(schema.RenCreditWalletTable)
    .where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  expect(unchanged.available_microcredits).toBe(before.available_microcredits)
  globalThis.fetch = async () => {
    const raw = JSON.stringify({ code: "10000", fund_change: "Y", out_trade_no: checkout.orderId, refund_fee: "698.00" })
    const signer = createSign("RSA-SHA256")
    signer.update(raw)
    signer.end()
    return new Response(`{"alipay_trade_refund_response":${raw},"sign":"${signer.sign(alipay.privateKey, "base64")}"}`)
  }
  expect((await orders.refundAlipayOrder({ orderId: checkout.orderId, actorUserId: userId, reason: "Late payment" })).replayed).toBe(false)
  const [organization] = await db.select().from(schema.OrganizationTable)
    .where(drizzle.eq(schema.OrganizationTable.id, organizationId))
  expect((organization.metadata as { renworkAccessGrant?: unknown }).renworkAccessGrant).toEqual(grant)
  const [after] = await db.select().from(schema.RenCreditWalletTable)
    .where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationId))
  expect(after.available_microcredits).toBe(before.available_microcredits)
})
