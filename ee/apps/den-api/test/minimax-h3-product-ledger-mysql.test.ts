import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { afterAll, beforeAll, expect, test } from "bun:test"

const mysqlUrl = process.env.RENCREDIT_LEDGER_TEST_DATABASE_URL

if (!mysqlUrl) {
  test.skip("MiniMax H3 product ledger needs RENCREDIT_LEDGER_TEST_DATABASE_URL", () => undefined)
} else {
  process.env.DATABASE_URL = mysqlUrl
  process.env.DB_MODE = "mysql"
  process.env.DEN_DB_ENCRYPTION_KEY = "h3-product-ledger-test-encryption-key-1234567890"
  process.env.BETTER_AUTH_SECRET = "h3-product-ledger-test-auth-secret-1234567890"
  process.env.BETTER_AUTH_URL = "https://den.example.test"
  process.env.DEN_API_PUBLIC_URL = "https://api.den.example.test"

  const organizationAId = createDenTypeId("organization")
  const organizationBId = createDenTypeId("organization")
  const userAId = createDenTypeId("user")
  const userBId = createDenTypeId("user")
  const memberAId = createDenTypeId("member")
  const memberBId = createDenTypeId("member")

  let db: typeof import("../src/db.js").db
  let drizzle: typeof import("@openwork-ee/den-db/drizzle")
  let schema: typeof import("@openwork-ee/den-db/schema")
  let ledger: typeof import("../src/rencredit-ledger.js")

  async function clearRows() {
    const organizationRows = drizzle.or(
      drizzle.eq(schema.OrganizationTable.id, organizationAId),
      drizzle.eq(schema.OrganizationTable.id, organizationBId),
    )
    const userRows = drizzle.or(
      drizzle.eq(schema.AuthUserTable.id, userAId),
      drizzle.eq(schema.AuthUserTable.id, userBId),
    )
    const tenantRows = <T extends { organization_id: unknown }>(table: T) => drizzle.or(
      drizzle.eq(table.organization_id as never, organizationAId),
      drizzle.eq(table.organization_id as never, organizationBId),
    )

    await db.delete(schema.RenCreditLedgerEntryTable).where(tenantRows(schema.RenCreditLedgerEntryTable))
    await db.delete(schema.RenCreditReservationTable).where(tenantRows(schema.RenCreditReservationTable))
    await db.delete(schema.RenCreditWalletTable).where(tenantRows(schema.RenCreditWalletTable))
    await db.delete(schema.MemberTable).where(drizzle.or(
      drizzle.eq(schema.MemberTable.organizationId, organizationAId),
      drizzle.eq(schema.MemberTable.organizationId, organizationBId),
    ))
    await db.delete(schema.OrganizationTable).where(organizationRows)
    await db.delete(schema.AuthUserTable).where(userRows)
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
      { id: userAId, name: "H3 Tenant A", email: `h3-a-${userAId}@example.test`, emailVerified: true },
      { id: userBId, name: "H3 Tenant B", email: `h3-b-${userBId}@example.test`, emailVerified: true },
    ])
    await db.insert(schema.OrganizationTable).values([
      { id: organizationAId, name: "H3 Tenant A", slug: `h3-a-${organizationAId}`, desktopAppRestrictions: {} },
      { id: organizationBId, name: "H3 Tenant B", slug: `h3-b-${organizationBId}`, desktopAppRestrictions: {} },
    ])
    await db.insert(schema.MemberTable).values([
      { id: memberAId, organizationId: organizationAId, userId: userAId, role: "owner" },
      { id: memberBId, organizationId: organizationBId, userId: userBId, role: "owner" },
    ])
    await Promise.all([
      ledger.grantRenCredit({ organizationId: organizationAId, amountMicroCredits: 1_000_000, idempotencyKey: "h3-grant", reasonCode: "H3_TEST_GRANT" }),
      ledger.grantRenCredit({ organizationId: organizationBId, amountMicroCredits: 1_000_000, idempotencyKey: "h3-grant", reasonCode: "H3_TEST_GRANT" }),
    ])
  })

  afterAll(async () => {
    if (db && drizzle && schema) await clearRows()
  })

  const reserve = (input: {
    organizationId: typeof organizationAId
    memberId: typeof memberAId
    runId: string
    idempotencyKey: string
    amount: number
  }) => ledger.reserveProductCredits({
    organizationId: input.organizationId,
    memberId: input.memberId,
    runId: input.runId,
    idempotencyKey: input.idempotencyKey,
    productSku: "renwork-video-minimax-h3",
    priceVersion: "h3-phase1-test-v1",
    providerId: "metaso-minimax-h3",
    reservedMicroCredits: input.amount,
    expiresAt: new Date(Date.now() + 60_000),
    pricingSnapshot: { kind: "fixed_outcome", durationSeconds: 4 },
    maxConcurrentRunsPerUser: 1,
  })

  test("product outcomes isolate tenants and settle idempotently without token billing", async () => {
    const firstA = await reserve({
      organizationId: organizationAId,
      memberId: memberAId,
      runId: "tenant-a-valid",
      idempotencyKey: "shared-h3-key",
      amount: 200_000,
    })
    const replayA = await reserve({
      organizationId: organizationAId,
      memberId: memberAId,
      runId: "tenant-a-valid",
      idempotencyKey: "shared-h3-key",
      amount: 200_000,
    })
    expect(firstA.replayed).toBe(false)
    expect(replayA.replayed).toBe(true)
    expect(replayA.reservation.id).toBe(firstA.reservation.id)
    expect(await ledger.getRenCreditWallet(organizationAId)).toMatchObject({
      available_microcredits: 800_000,
      reserved_microcredits: 200_000,
    })

    const firstB = await reserve({
      organizationId: organizationBId,
      memberId: memberBId,
      runId: "tenant-b-separate",
      idempotencyKey: "shared-h3-key",
      amount: 200_000,
    })
    expect(firstB.replayed).toBe(false)
    expect(firstB.reservation.id).not.toBe(firstA.reservation.id)

    const resultHash = "a".repeat(64)
    await ledger.captureProductCredits({
      reservationId: firstA.reservation.id,
      providerResponseId: "provider-task-valid",
      resultHash,
    })
    await ledger.captureProductCredits({
      reservationId: firstA.reservation.id,
      providerResponseId: "provider-task-valid-replay",
      resultHash,
    })
    await expect(ledger.releaseProductCredits({
      reservationId: firstA.reservation.id,
      failureCode: "MUST_CONFLICT",
    })).rejects.toThrow("RENCREDIT_SETTLEMENT_CONFLICT")
    expect(await ledger.getRenCreditWallet(organizationAId)).toMatchObject({
      available_microcredits: 800_000,
      reserved_microcredits: 0,
    })

    const active = await reserve({
      organizationId: organizationAId,
      memberId: memberAId,
      runId: "tenant-a-active",
      idempotencyKey: "tenant-a-active",
      amount: 100_000,
    })
    await expect(reserve({
      organizationId: organizationAId,
      memberId: memberAId,
      runId: "tenant-a-concurrent",
      idempotencyKey: "tenant-a-concurrent",
      amount: 100_000,
    })).rejects.toThrow("PRODUCT_CONCURRENCY_EXCEEDED")
    await ledger.releaseProductCredits({ reservationId: active.reservation.id, failureCode: "TEST_RELEASE_ACTIVE" })

    const failed = await reserve({
      organizationId: organizationAId,
      memberId: memberAId,
      runId: "tenant-a-failed",
      idempotencyKey: "tenant-a-failed",
      amount: 150_000,
    })
    await ledger.releaseProductCredits({ reservationId: failed.reservation.id, failureCode: "PROVIDER_FAILED" })
    await expect(ledger.captureProductCredits({
      reservationId: failed.reservation.id,
      providerResponseId: "late-result",
      resultHash,
    })).rejects.toThrow("RENCREDIT_SETTLEMENT_CONFLICT")

    await ledger.releaseProductCredits({ reservationId: firstB.reservation.id, failureCode: "TENANT_B_RELEASE" })
    expect(await ledger.getRenCreditWallet(organizationAId)).toMatchObject({
      available_microcredits: 800_000,
      reserved_microcredits: 0,
    })
    expect(await ledger.getRenCreditWallet(organizationBId)).toMatchObject({
      available_microcredits: 1_000_000,
      reserved_microcredits: 0,
    })

    const [receiptsA, receiptsB] = await Promise.all([
      ledger.listMemberRenCreditTaskReceipts({ organizationId: organizationAId, memberId: memberAId }),
      ledger.listMemberRenCreditTaskReceipts({ organizationId: organizationBId, memberId: memberBId }),
    ])
    expect(receiptsA.some((receipt) => receipt.run_id === "tenant-b-separate")).toBe(false)
    expect(receiptsB).toHaveLength(1)
    expect(receiptsB[0]?.run_id).toBe("tenant-b-separate")
    expect(receiptsA.find((receipt) => receipt.run_id === "tenant-a-valid")).toMatchObject({
      billing_mode: "outcome_metered",
      status: "captured",
      captured_microcredits: 200_000,
      released_microcredits: 0,
    })
    expect(receiptsA.find((receipt) => receipt.run_id === "tenant-a-failed")).toMatchObject({
      status: "released",
      captured_microcredits: 0,
      released_microcredits: 150_000,
    })
  })
}
