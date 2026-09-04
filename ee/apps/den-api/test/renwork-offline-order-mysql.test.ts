import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { afterAll, beforeAll, expect, test } from "bun:test"

process.env.DATABASE_URL = process.env.RENCREDIT_LEDGER_TEST_DATABASE_URL
  ?? "mysql://root:password@127.0.0.1:3306/openwork_test_rencredit_v6"
process.env.DB_MODE = "mysql"
process.env.DEN_DB_ENCRYPTION_KEY = "offline-order-test-encryption-key-1234567890"
process.env.BETTER_AUTH_SECRET = "offline-order-test-auth-secret-1234567890"
process.env.BETTER_AUTH_URL = "https://den.example.test"
process.env.DEN_API_PUBLIC_URL = "https://api.den.example.test"

const organizationAId = createDenTypeId("organization")
const organizationBId = createDenTypeId("organization")
const adminUserId = createDenTypeId("user")
const secondAdminUserId = createDenTypeId("user")

let db: typeof import("../src/db.js").db
let drizzle: typeof import("@openwork-ee/den-db/drizzle")
let schema: typeof import("@openwork-ee/den-db/schema")
let offline: typeof import("../src/renwork-offline-order.js")

async function clearRows() {
  const tenants = drizzle.or(
    drizzle.eq(schema.OrganizationTable.id, organizationAId),
    drizzle.eq(schema.OrganizationTable.id, organizationBId),
  )
  const tenantOrders = drizzle.or(
    drizzle.eq(schema.RenworkOfflineOrderTable.organization_id, organizationAId),
    drizzle.eq(schema.RenworkOfflineOrderTable.organization_id, organizationBId),
  )
  const tenantQuotes = drizzle.or(
    drizzle.eq(schema.RenworkContractQuoteTable.organization_id, organizationAId),
    drizzle.eq(schema.RenworkContractQuoteTable.organization_id, organizationBId),
  )
  const tenantWallets = drizzle.or(
    drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationAId),
    drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationBId),
  )
  const tenantLedger = drizzle.or(
    drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationAId),
    drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationBId),
  )
  await db.delete(schema.RenworkOfflineOrderTable).where(tenantOrders)
  await db.delete(schema.RenworkContractQuoteTable).where(tenantQuotes)
  await db.delete(schema.RenCreditLedgerEntryTable).where(tenantLedger)
  await db.delete(schema.RenCreditWalletTable).where(tenantWallets)
  await db.delete(schema.OrganizationTable).where(tenants)
  await db.delete(schema.AuthUserTable).where(drizzle.eq(schema.AuthUserTable.id, adminUserId))
  await db.delete(schema.AuthUserTable).where(drizzle.eq(schema.AuthUserTable.id, secondAdminUserId))
}

beforeAll(async () => {
  const modules = await Promise.all([
    import("../src/db.js"),
    import("@openwork-ee/den-db/drizzle"),
    import("@openwork-ee/den-db/schema"),
    import("../src/renwork-offline-order.js"),
  ])
  db = modules[0].db
  drizzle = modules[1]
  schema = modules[2]
  offline = modules[3]
  await clearRows()
  await db.insert(schema.AuthUserTable).values([
    { id: adminUserId, name: "Offline Admin", email: `${adminUserId}@example.test`, emailVerified: true },
    { id: secondAdminUserId, name: "Second Offline Admin", email: `${secondAdminUserId}@example.test`, emailVerified: true },
  ])
  await db.insert(schema.OrganizationTable).values([
    { id: organizationAId, name: "Offline Tenant A", slug: `offline-a-${organizationAId}`, metadata: { limits: { members: 5, workers: 1 } }, desktopAppRestrictions: {} },
    { id: organizationBId, name: "Offline Tenant B", slug: `offline-b-${organizationBId}`, metadata: { limits: { members: 5, workers: 1 } }, desktopAppRestrictions: {} },
  ])
})

afterAll(async () => {
  if (db && drizzle && schema) await clearRows()
})

test("two tenants isolate grants, serialize duplicate submissions and reverse without deleting history", async () => {
  const createA = () => offline.createOfflineOrder({
    organizationId: organizationAId,
    actorUserId: adminUserId,
    offerId: "personal-pro-monthly",
    amountMinor: 13_900,
    paymentMethod: "bank_transfer",
    paymentReference: `A-${organizationAId}`,
    idempotencyKey: "same-key-across-tenants",
  })
  const concurrentA = await Promise.all([createA(), createA()])
  expect(concurrentA.filter((result) => result.replayed)).toHaveLength(1)

  const resultB = await offline.createOfflineOrder({
    organizationId: organizationBId,
    actorUserId: adminUserId,
    offerId: "personal-light-monthly",
    amountMinor: 6_900,
    paymentMethod: "bank_transfer",
    paymentReference: `B-${organizationBId}`,
    idempotencyKey: "same-key-across-tenants",
  })
  expect(resultB.replayed).toBe(false)

  const [walletA, walletB] = await Promise.all([
    db.select().from(schema.RenCreditWalletTable).where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationAId)).limit(1),
    db.select().from(schema.RenCreditWalletTable).where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationBId)).limit(1),
  ])
  expect(walletA[0]?.available_microcredits).toBe(4_000_000_000)
  expect(walletB[0]?.available_microcredits).toBe(2_000_000_000)

  const firstReverse = await offline.reverseOfflineOrder({ orderId: concurrentA[0]!.order.id, actorUserId: adminUserId, reason: "Customer refund" })
  const replayReverse = await offline.reverseOfflineOrder({ orderId: concurrentA[0]!.order.id, actorUserId: adminUserId, reason: "Customer refund" })
  expect(firstReverse.replayed).toBe(false)
  expect(replayReverse.replayed).toBe(true)

  const [afterA, afterB, ledgerA, ledgerB, organizationA, organizationB] = await Promise.all([
    db.select().from(schema.RenCreditWalletTable).where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationAId)).limit(1),
    db.select().from(schema.RenCreditWalletTable).where(drizzle.eq(schema.RenCreditWalletTable.organization_id, organizationBId)).limit(1),
    db.select().from(schema.RenCreditLedgerEntryTable).where(drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationAId)),
    db.select().from(schema.RenCreditLedgerEntryTable).where(drizzle.eq(schema.RenCreditLedgerEntryTable.organization_id, organizationBId)),
    db.select().from(schema.OrganizationTable).where(drizzle.eq(schema.OrganizationTable.id, organizationAId)).limit(1),
    db.select().from(schema.OrganizationTable).where(drizzle.eq(schema.OrganizationTable.id, organizationBId)).limit(1),
  ])
  expect(afterA[0]?.available_microcredits).toBe(0)
  expect(afterB[0]?.available_microcredits).toBe(2_000_000_000)
  expect(ledgerA.map((entry) => entry.entry_type).sort()).toEqual(["grant", "refund"])
  expect(ledgerB.map((entry) => entry.entry_type)).toEqual(["grant"])
  expect(organizationA[0]?.metadata?.renworkAccessGrant).toBeUndefined()
  expect(organizationB[0]?.metadata?.renworkAccessGrant).toMatchObject({ source: "offline_payment" })
})

test("amount mismatches roll back before creating an order or wallet", async () => {
  await expect(offline.createOfflineOrder({
    organizationId: organizationAId,
    actorUserId: adminUserId,
    offerId: "personal-light-monthly",
    amountMinor: 10_000,
    paymentMethod: "wechat_offline",
    paymentReference: `MISMATCH-${organizationAId}`,
    idempotencyKey: "amount-mismatch-v14",
  })).rejects.toThrow("RENWORK_OFFLINE_AMOUNT_MISMATCH")
  expect(await offline.listOfflineOrders({ organizationId: organizationAId })).toHaveLength(1)
})

test("enterprise contract quote requires a second admin and is orderable only after publication", async () => {
  const contract = await import("../src/renwork-contract-quote.js")
  const quote = await contract.createRenworkContractQuote({
    organizationId: organizationAId,
    actorUserId: adminUserId,
    amountMinor: 123_400,
    includedRenCredits: 9_000,
    seatLimit: 12,
    billingInterval: "annual",
    contractReference: `CUSTOM-${organizationAId}`,
  })

  await expect(offline.createOfflineOrder({
    organizationId: organizationAId,
    actorUserId: adminUserId,
    offerId: quote.id,
    amountMinor: 123_400,
    paymentMethod: "bank_transfer",
    paymentReference: `CUSTOM-PRE-PUBLISH-${organizationAId}`,
    idempotencyKey: "custom-before-publish-v15",
  })).rejects.toThrow("RENWORK_OFFLINE_OFFER_NOT_FOUND")
  await expect(contract.approveRenworkContractQuote({ quoteId: quote.id, actorUserId: adminUserId }))
    .rejects.toThrow("RENWORK_CONTRACT_SECOND_ADMIN_REQUIRED")

  await contract.approveRenworkContractQuote({ quoteId: quote.id, actorUserId: secondAdminUserId })
  await contract.publishRenworkContractQuote({ quoteId: quote.id, actorUserId: adminUserId })

  const [offersA, offersB] = await Promise.all([
    offline.listOfflineOffersForOrganization(organizationAId),
    offline.listOfflineOffersForOrganization(organizationBId),
  ])
  expect(offersA.find((offer) => offer.offerId === quote.id)).toMatchObject({
    planId: "enterprise-custom",
    priceMinor: 123_400,
    includedRenCredits: 9_000,
    seatLimit: 12,
    source: "contract_quote",
  })
  expect(offersB.some((offer) => offer.offerId === quote.id)).toBe(false)

  const order = await offline.createOfflineOrder({
    organizationId: organizationAId,
    actorUserId: adminUserId,
    offerId: quote.id,
    amountMinor: 123_400,
    paymentMethod: "bank_transfer",
    paymentReference: `CUSTOM-PAID-${organizationAId}`,
    idempotencyKey: "custom-published-v15",
  })
  expect(order.order.plan_id).toBe("enterprise-custom")
  expect(order.wallet?.available_microcredits).toBe(9_000_000_000)
})
