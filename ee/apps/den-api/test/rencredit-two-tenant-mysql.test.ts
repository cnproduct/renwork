import { createDenTypeId } from "@openwork-ee/utils/typeid"
import type { RenWorkAdminModel, RenWorkAdminModelRoute } from "@openwork/rencredit-metering"
import { afterAll, beforeAll, expect, test } from "bun:test"

process.env.DATABASE_URL = process.env.RENCREDIT_LEDGER_TEST_DATABASE_URL
  ?? "mysql://root:password@127.0.0.1:3306/openwork_test_rencredit_v6"
process.env.DB_MODE = "mysql"
process.env.DEN_DB_ENCRYPTION_KEY = "rencredit-ledger-test-encryption-key-1234567890"
process.env.BETTER_AUTH_SECRET = "rencredit-ledger-test-auth-secret-1234567890"
process.env.BETTER_AUTH_URL = "https://den.example.test"
process.env.DEN_API_PUBLIC_URL = "https://api.den.example.test"

const organizationAId = createDenTypeId("organization")
const organizationBId = createDenTypeId("organization")
const userAId = createDenTypeId("user")
const userBId = createDenTypeId("user")
const memberAId = createDenTypeId("member")
const memberBId = createDenTypeId("member")
const inferenceKeyAId = createDenTypeId("inferenceKey")
const inferenceKeyBId = createDenTypeId("inferenceKey")

const route: RenWorkAdminModelRoute = {
  id: "rencredit-v6-route",
  providerId: "rencredit-v6-provider",
  upstreamModelId: "provider/model-v6",
  priority: 10,
  enabled: true,
  source: "official",
}

const model: RenWorkAdminModel = {
  sku: "renwork-v6-integration",
  displayName: "RenWork V6 Integration",
  description: "Two-tenant persistent ledger verification model",
  tier: "standard",
  status: "published",
  autoEligible: true,
  contextWindow: 128_000,
  tags: ["integration"],
  sortOrder: 1,
  displayMultiplierBps: 10_000,
  priceMultiplierBps: 10_000,
  rates: {
    inputMicroCreditsPerMillion: 1_000_000,
    outputMicroCreditsPerMillion: 1_000_000,
    reasoningMicroCreditsPerMillion: 1_000_000,
    cacheReadMicroCreditsPerMillion: 1_000_000,
    cacheWriteMicroCreditsPerMillion: 1_000_000,
  },
  promotion: null,
  allowedPlanIds: ["enterprise"],
  routes: [route],
}

const zeroUsage = {
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

let db: typeof import("../src/db.js").db
let drizzle: typeof import("@openwork-ee/den-db/drizzle")
let schema: typeof import("@openwork-ee/den-db/schema")
let ledger: typeof import("../src/rencredit-ledger.js")

async function clearRows() {
  const organizations = drizzle.or(
    drizzle.eq(schema.OrganizationTable.id, organizationAId),
    drizzle.eq(schema.OrganizationTable.id, organizationBId),
  )
  const users = drizzle.or(
    drizzle.eq(schema.AuthUserTable.id, userAId),
    drizzle.eq(schema.AuthUserTable.id, userBId),
  )
  const tenantRows = <T extends { organization_id: unknown }>(table: T) => drizzle.or(
    drizzle.eq(table.organization_id as never, organizationAId),
    drizzle.eq(table.organization_id as never, organizationBId),
  )

  await db.delete(schema.RenCreditUsageEventTable).where(tenantRows(schema.RenCreditUsageEventTable))
  await db.delete(schema.RenCreditLedgerEntryTable).where(tenantRows(schema.RenCreditLedgerEntryTable))
  await db.delete(schema.RenCreditReservationTable).where(tenantRows(schema.RenCreditReservationTable))
  await db.delete(schema.RenCreditWalletTable).where(tenantRows(schema.RenCreditWalletTable))
  await db.delete(schema.InferenceKeyTable).where(tenantRows(schema.InferenceKeyTable))
  await db.delete(schema.MemberTable).where(drizzle.or(
    drizzle.eq(schema.MemberTable.organizationId, organizationAId),
    drizzle.eq(schema.MemberTable.organizationId, organizationBId),
  ))
  await db.delete(schema.OrganizationTable).where(organizations)
  await db.delete(schema.AuthUserTable).where(users)
}

beforeAll(async () => {
  const modules = await Promise.all([
    import("../src/db.js"),
    import("@openwork-ee/den-db/drizzle"),
    import("@openwork-ee/den-db/schema"),
    import("../src/rencredit-ledger.js"),
  ])
  db = modules[0].db
  drizzle = modules[1]
  schema = modules[2]
  ledger = modules[3]

  await clearRows()
  await db.insert(schema.AuthUserTable).values([
    { id: userAId, name: "RenCredit Tenant A", email: `rencredit-a-${userAId}@example.test`, emailVerified: true },
    { id: userBId, name: "RenCredit Tenant B", email: `rencredit-b-${userBId}@example.test`, emailVerified: true },
  ])
  await db.insert(schema.OrganizationTable).values([
    { id: organizationAId, name: "RenCredit Tenant A", slug: `rencredit-a-${organizationAId}`, desktopAppRestrictions: {} },
    { id: organizationBId, name: "RenCredit Tenant B", slug: `rencredit-b-${organizationBId}`, desktopAppRestrictions: {} },
  ])
  await db.insert(schema.MemberTable).values([
    { id: memberAId, organizationId: organizationAId, userId: userAId, role: "owner" },
    { id: memberBId, organizationId: organizationBId, userId: userBId, role: "owner" },
  ])
  await db.insert(schema.InferenceKeyTable).values([
    { id: inferenceKeyAId, organization_id: organizationAId, org_membership_id: memberAId, key_hash: `hash-${inferenceKeyAId}`, status: "active" },
    { id: inferenceKeyBId, organization_id: organizationBId, org_membership_id: memberBId, key_hash: `hash-${inferenceKeyBId}`, status: "active" },
  ])
  await Promise.all([
    ledger.grantRenCredit({ organizationId: organizationAId, amountMicroCredits: 1_000_000, idempotencyKey: "grant-v6", reasonCode: "V6_TEST_GRANT" }),
    ledger.grantRenCredit({ organizationId: organizationBId, amountMicroCredits: 1_000_000, idempotencyKey: "grant-v6", reasonCode: "V6_TEST_GRANT" }),
  ])
})

afterAll(async () => {
  if (db && drizzle && schema) await clearRows()
})

test("two tenants isolate balances, replay safely, release failures and serialize concurrent charges", async () => {
  const reserveA = () => ledger.reserveInferenceCredits({
    organizationId: organizationAId,
    memberId: memberAId,
    inferenceKeyId: inferenceKeyAId,
    runId: "tenant-a-run",
    idempotencyKey: "shared-idempotency-v6",
    catalogVersion: "v6-test",
    model,
    route,
    providerId: route.providerId,
    billingMode: "token_metered",
    estimatedUsage: zeroUsage,
    reservedMicroCredits: 250_000,
    expiresAt: new Date(Date.now() + 60_000),
  })
  const firstA = await reserveA()
  const replayA = await reserveA()
  expect(firstA.replayed).toBe(false)
  expect(replayA.replayed).toBe(true)
  expect(replayA.reservation.id).toBe(firstA.reservation.id)
  expect(await ledger.getRenCreditWallet(organizationAId)).toMatchObject({
    available_microcredits: 750_000,
    reserved_microcredits: 250_000,
  })

  const concurrentB = await Promise.allSettled([
    ledger.reserveInferenceCredits({
      organizationId: organizationBId,
      memberId: memberBId,
      inferenceKeyId: inferenceKeyBId,
      runId: "tenant-b-run-1",
      idempotencyKey: "shared-idempotency-v6",
      catalogVersion: "v6-test",
      model,
      route,
      providerId: route.providerId,
      billingMode: "token_metered",
      estimatedUsage: zeroUsage,
      reservedMicroCredits: 600_000,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    ledger.reserveInferenceCredits({
      organizationId: organizationBId,
      memberId: memberBId,
      inferenceKeyId: inferenceKeyBId,
      runId: "tenant-b-run-2",
      idempotencyKey: "tenant-b-concurrent-v6",
      catalogVersion: "v6-test",
      model,
      route,
      providerId: route.providerId,
      billingMode: "token_metered",
      estimatedUsage: zeroUsage,
      reservedMicroCredits: 600_000,
      expiresAt: new Date(Date.now() + 60_000),
    }),
  ])
  const acceptedB = concurrentB.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ledger.reserveInferenceCredits>>> => result.status === "fulfilled")
  const rejectedB = concurrentB.filter((result) => result.status === "rejected")
  expect(acceptedB).toHaveLength(1)
  expect(rejectedB).toHaveLength(1)
  expect(String(rejectedB[0]?.reason)).toContain("INSUFFICIENT_RENCREDIT")
  expect(await ledger.getRenCreditWallet(organizationBId)).toMatchObject({
    available_microcredits: 400_000,
    reserved_microcredits: 600_000,
  })

  await ledger.settleInferenceCredits({
    reservationId: firstA.reservation.id,
    usage: zeroUsage,
    providerResponseId: "tenant-a-empty-result",
    accuracy: "reported",
    hasResult: false,
  })
  await ledger.settleInferenceCredits({
    reservationId: acceptedB[0]!.value.reservation.id,
    usage: { ...zeroUsage, inputTokens: 100_000 },
    providerResponseId: "tenant-b-provider-result",
    accuracy: "reported",
    hasResult: true,
  })
  await ledger.settleInferenceCredits({
    reservationId: acceptedB[0]!.value.reservation.id,
    usage: { ...zeroUsage, inputTokens: 100_000 },
    providerResponseId: "tenant-b-provider-result-replay",
    accuracy: "reported",
    hasResult: true,
  })

  expect(await ledger.getRenCreditWallet(organizationAId)).toMatchObject({ available_microcredits: 1_000_000, reserved_microcredits: 0 })
  expect(await ledger.getRenCreditWallet(organizationBId)).toMatchObject({ available_microcredits: 900_000, reserved_microcredits: 0 })

  const [receiptsA, receiptsB, ledgerA, ledgerB] = await Promise.all([
    ledger.listMemberRenCreditTaskReceipts({ organizationId: organizationAId, memberId: memberAId }),
    ledger.listMemberRenCreditTaskReceipts({ organizationId: organizationBId, memberId: memberBId }),
    ledger.listRenCreditLedger(organizationAId),
    ledger.listRenCreditLedger(organizationBId),
  ])
  expect(receiptsA).toHaveLength(1)
  expect(receiptsA[0]).toMatchObject({ run_id: "tenant-a-run", status: "released", captured_microcredits: 0, released_microcredits: 250_000 })
  expect(receiptsB).toHaveLength(1)
  expect(receiptsB[0]).toMatchObject({ status: "captured", captured_microcredits: 100_000, released_microcredits: 500_000 })
  expect(receiptsA.some((receipt) => receipt.run_id.startsWith("tenant-b"))).toBe(false)
  expect(receiptsB.some((receipt) => receipt.run_id.startsWith("tenant-a"))).toBe(false)
  expect(ledgerA.every((entry) => !ledgerB.some((other) => other.id === entry.id))).toBe(true)
})
