import { and, desc, eq, gte, isNull, lt } from "@openwork-ee/den-db/drizzle"
import {
  InferenceKeyTable,
  MemberTable,
  RenCreditLedgerEntryTable,
  RenCreditReservationTable,
  RenCreditUsageEventTable,
  RenCreditWalletTable,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId } from "@openwork-ee/utils/typeid"
import type { RenWorkAdminModel, RenWorkAdminModelRoute, RenWorkTokenUsage } from "@openwork/rencredit-metering"
import { calculateRenCreditMicroCharge } from "@openwork/rencredit-metering"
import { createHash } from "node:crypto"
import { db } from "./db.js"

type OrganizationId = typeof RenCreditWalletTable.$inferSelect.organization_id
type MemberId = typeof InferenceKeyTable.$inferSelect.org_membership_id
type InferenceKeyId = typeof InferenceKeyTable.$inferSelect.id
type ReservationId = typeof RenCreditReservationTable.$inferSelect.id

export type RenCreditTaskReceipt = {
  id: string
  run_id: string
  model_sku: string
  billing_mode: "token_metered" | "free"
  status: "reserved" | "captured" | "released"
  reserved_microcredits: number
  captured_microcredits: number
  released_microcredits: number
  actual_usage: RenWorkTokenUsage | null
  has_result: boolean
  created_at: string
  settled_at: string | null
}

export type RenCreditLedgerRecord = {
  id: string
  reservation_id: string | null
  entry_type: "grant" | "reserve" | "capture" | "release" | "refund" | "adjustment"
  amount_microcredits: number
  available_delta_microcredits: number
  reserved_delta_microcredits: number
  available_balance_after: number
  reserved_balance_after: number
  wallet_version_after: number
  reason_code: string
  created_at: string
}

export type InferencePrincipal = {
  organizationId: OrganizationId
  memberId: MemberId
  inferenceKeyId: InferenceKeyId
}

export type ReserveInferenceInput = InferencePrincipal & {
  runId: string
  idempotencyKey: string
  catalogVersion: string
  model: RenWorkAdminModel
  route: RenWorkAdminModelRoute
  providerId: string
  billingMode: "token_metered" | "free"
  estimatedUsage: RenWorkTokenUsage
  reservedMicroCredits: number
  expiresAt: Date
  budgets?: {
    organizationDailyMicroCredits: number | null
    organizationMonthlyMicroCredits: number | null
    memberMonthlyMicroCredits: number | null
  }
}

function hashInferenceKey(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function assertMicroCredits(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer.`)
}

function safeDate(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function safeTokenUsage(value: unknown): RenWorkTokenUsage | null {
  if (!value || typeof value !== "object") return null
  const usage = value as Record<string, unknown>
  const keys = ["inputTokens", "outputTokens", "reasoningTokens", "cacheReadTokens", "cacheWriteTokens"] as const
  if (!keys.every((key) => Number.isSafeInteger(usage[key]) && (usage[key] as number) >= 0)) return null
  return {
    inputTokens: usage.inputTokens as number,
    outputTokens: usage.outputTokens as number,
    reasoningTokens: usage.reasoningTokens as number,
    cacheReadTokens: usage.cacheReadTokens as number,
    cacheWriteTokens: usage.cacheWriteTokens as number,
  }
}

export async function authenticateInferenceKey(key: string): Promise<InferencePrincipal | null> {
  const [row] = await db
    .select({
      organizationId: InferenceKeyTable.organization_id,
      memberId: InferenceKeyTable.org_membership_id,
      inferenceKeyId: InferenceKeyTable.id,
    })
    .from(InferenceKeyTable)
    .innerJoin(MemberTable, eq(InferenceKeyTable.org_membership_id, MemberTable.id))
    .where(and(
      eq(InferenceKeyTable.key_hash, hashInferenceKey(key)),
      eq(InferenceKeyTable.status, "active"),
      eq(MemberTable.organizationId, InferenceKeyTable.organization_id),
      isNull(MemberTable.removedAt),
    ))
    .limit(1)
  return row ?? null
}

export async function getRenCreditWallet(organizationId: OrganizationId) {
  const [wallet] = await db.select().from(RenCreditWalletTable).where(eq(RenCreditWalletTable.organization_id, organizationId)).limit(1)
  return wallet ?? null
}

/**
 * Returns the organization's durable wallet, creating the zero-balance row on
 * first access. Production callers must never synthesize an in-memory wallet:
 * this MySQL row and its immutable ledger entries are the RenCredit source of
 * truth for every product surface.
 */
export async function getOrCreateRenCreditWallet(organizationId: OrganizationId) {
  await db.insert(RenCreditWalletTable).values({ organization_id: organizationId }).onDuplicateKeyUpdate({
    set: { organization_id: organizationId },
  })
  const wallet = await getRenCreditWallet(organizationId)
  if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
  return wallet
}

export async function listRenCreditLedger(organizationId: OrganizationId, limit = 50): Promise<RenCreditLedgerRecord[]> {
  const rows = await db
    .select({
      id: RenCreditLedgerEntryTable.id,
      reservation_id: RenCreditLedgerEntryTable.reservation_id,
      entry_type: RenCreditLedgerEntryTable.entry_type,
      amount_microcredits: RenCreditLedgerEntryTable.amount_microcredits,
      available_delta_microcredits: RenCreditLedgerEntryTable.available_delta_microcredits,
      reserved_delta_microcredits: RenCreditLedgerEntryTable.reserved_delta_microcredits,
      available_balance_after: RenCreditLedgerEntryTable.available_balance_after,
      reserved_balance_after: RenCreditLedgerEntryTable.reserved_balance_after,
      wallet_version_after: RenCreditLedgerEntryTable.wallet_version_after,
      reason_code: RenCreditLedgerEntryTable.reason_code,
      created_at: RenCreditLedgerEntryTable.created_at,
    })
    .from(RenCreditLedgerEntryTable)
    .where(eq(RenCreditLedgerEntryTable.organization_id, organizationId))
    .orderBy(desc(RenCreditLedgerEntryTable.created_at))
    .limit(Math.max(1, Math.min(200, limit)))
  return rows.map((row) => ({ ...row, created_at: safeDate(row.created_at)! }))
}

/**
 * Returns only the signed-in member's task receipts. Provider routing,
 * credentials, pricing snapshots and idempotency keys intentionally never
 * cross this boundary.
 */
export async function listMemberRenCreditTaskReceipts(input: {
  organizationId: OrganizationId
  memberId: MemberId
  limit?: number
}): Promise<RenCreditTaskReceipt[]> {
  const rows = await db
    .select({
      id: RenCreditReservationTable.id,
      run_id: RenCreditReservationTable.run_id,
      model_sku: RenCreditReservationTable.model_sku,
      billing_mode: RenCreditReservationTable.billing_mode,
      status: RenCreditReservationTable.status,
      reserved_microcredits: RenCreditReservationTable.reserved_microcredits,
      captured_microcredits: RenCreditReservationTable.captured_microcredits,
      released_microcredits: RenCreditReservationTable.released_microcredits,
      actual_usage: RenCreditReservationTable.actual_usage,
      has_result: RenCreditReservationTable.has_result,
      created_at: RenCreditReservationTable.created_at,
      settled_at: RenCreditReservationTable.settled_at,
    })
    .from(RenCreditReservationTable)
    .where(and(
      eq(RenCreditReservationTable.organization_id, input.organizationId),
      eq(RenCreditReservationTable.org_membership_id, input.memberId),
    ))
    .orderBy(desc(RenCreditReservationTable.created_at))
    .limit(Math.max(1, Math.min(100, input.limit ?? 20)))

  return rows.map((row) => ({
    ...row,
    billing_mode: row.billing_mode === "free" ? "free" : "token_metered",
    actual_usage: safeTokenUsage(row.actual_usage),
    created_at: safeDate(row.created_at)!,
    settled_at: safeDate(row.settled_at),
  }))
}

export async function grantRenCredit(input: {
  organizationId: OrganizationId
  amountMicroCredits: number
  idempotencyKey: string
  reasonCode: string
  metadata?: Record<string, unknown>
}) {
  assertMicroCredits(input.amountMicroCredits, "amountMicroCredits")
  if (input.amountMicroCredits === 0) throw new Error("amountMicroCredits must be positive.")

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(RenCreditLedgerEntryTable).where(and(
      eq(RenCreditLedgerEntryTable.organization_id, input.organizationId),
      eq(RenCreditLedgerEntryTable.idempotency_key, input.idempotencyKey),
    )).limit(1)
    if (existing) {
      const [wallet] = await tx.select().from(RenCreditWalletTable)
        .where(eq(RenCreditWalletTable.organization_id, input.organizationId)).limit(1)
      return wallet ?? null
    }

    await tx.insert(RenCreditWalletTable).values({ organization_id: input.organizationId }).onDuplicateKeyUpdate({
      set: { organization_id: input.organizationId },
    })
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, input.organizationId)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    const available = wallet.available_microcredits + input.amountMicroCredits
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({ available_microcredits: available, version })
      .where(eq(RenCreditWalletTable.organization_id, input.organizationId))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"),
      organization_id: input.organizationId,
      reservation_id: null,
      entry_type: "grant",
      idempotency_key: input.idempotencyKey,
      amount_microcredits: input.amountMicroCredits,
      available_delta_microcredits: input.amountMicroCredits,
      reserved_delta_microcredits: 0,
      available_balance_after: available,
      reserved_balance_after: wallet.reserved_microcredits,
      wallet_version_after: version,
      reason_code: input.reasonCode,
      metadata: input.metadata ?? null,
    })
    return { ...wallet, available_microcredits: available, version }
  })
}

export async function reserveInferenceCredits(input: ReserveInferenceInput) {
  assertMicroCredits(input.reservedMicroCredits, "reservedMicroCredits")
  return db.transaction(async (tx) => {
    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, input.organizationId)).for("update").limit(1)
    const [existing] = await tx.select().from(RenCreditReservationTable).where(and(
      eq(RenCreditReservationTable.organization_id, input.organizationId),
      eq(RenCreditReservationTable.idempotency_key, input.idempotencyKey),
    )).for("update").limit(1)
    if (existing) return { reservation: existing, replayed: true as const }

    if (!wallet || wallet.status !== "active") throw new Error("RENCREDIT_WALLET_UNAVAILABLE")
    if (wallet.available_microcredits < input.reservedMicroCredits) throw new Error("INSUFFICIENT_RENCREDIT")

    const now = new Date()
    const dayStart = new Date(now)
    dayStart.setUTCHours(0, 0, 0, 0)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const committedSince = async (start: Date, memberId?: MemberId) => {
      // A locking read is deliberate: under MySQL REPEATABLE READ a plain
      // aggregate could reuse a snapshot from before this transaction waited
      // on the wallet row and admit two concurrent requests over the limit.
      const rows = await tx.select({
        status: RenCreditReservationTable.status,
        reserved: RenCreditReservationTable.reserved_microcredits,
        captured: RenCreditReservationTable.captured_microcredits,
      })
        .from(RenCreditReservationTable)
        .where(and(
          eq(RenCreditReservationTable.organization_id, input.organizationId),
          gte(RenCreditReservationTable.created_at, start),
          ...(memberId ? [eq(RenCreditReservationTable.org_membership_id, memberId)] : []),
        )).for("update")
      return rows.reduce((total, row) => total + (
        row.status === "reserved" ? row.reserved : row.status === "captured" ? row.captured : 0
      ), 0)
    }
    const budgets = input.budgets
    if (input.reservedMicroCredits > 0 && budgets?.organizationDailyMicroCredits !== null && budgets?.organizationDailyMicroCredits !== undefined) {
      const committed = await committedSince(dayStart)
      if (committed + input.reservedMicroCredits > budgets.organizationDailyMicroCredits) {
        throw new Error("ORGANIZATION_DAILY_BUDGET_EXCEEDED")
      }
    }
    if (
      input.reservedMicroCredits > 0 && (
        budgets?.organizationMonthlyMicroCredits !== null && budgets?.organizationMonthlyMicroCredits !== undefined
        || budgets?.memberMonthlyMicroCredits !== null && budgets?.memberMonthlyMicroCredits !== undefined
      )
    ) {
      const organizationCommitted = await committedSince(monthStart)
      if (
        budgets?.organizationMonthlyMicroCredits !== null &&
        budgets?.organizationMonthlyMicroCredits !== undefined &&
        organizationCommitted + input.reservedMicroCredits > budgets.organizationMonthlyMicroCredits
      ) {
        throw new Error("ORGANIZATION_MONTHLY_BUDGET_EXCEEDED")
      }
      if (budgets?.memberMonthlyMicroCredits !== null && budgets?.memberMonthlyMicroCredits !== undefined) {
        const memberCommitted = await committedSince(monthStart, input.memberId)
        if (memberCommitted + input.reservedMicroCredits > budgets.memberMonthlyMicroCredits) {
          throw new Error("MEMBER_MONTHLY_QUOTA_EXCEEDED")
        }
      }
    }

    const reservationId = createDenTypeId("renCreditReservation")
    const available = wallet.available_microcredits - input.reservedMicroCredits
    const reserved = wallet.reserved_microcredits + input.reservedMicroCredits
    const version = wallet.version + 1
    await tx.update(RenCreditWalletTable).set({
      available_microcredits: available,
      reserved_microcredits: reserved,
      version,
    }).where(eq(RenCreditWalletTable.organization_id, input.organizationId))
    await tx.insert(RenCreditReservationTable).values({
      id: reservationId,
      organization_id: input.organizationId,
      org_membership_id: input.memberId,
      inference_key_id: input.inferenceKeyId,
      run_id: input.runId,
      idempotency_key: input.idempotencyKey,
      model_sku: input.model.sku,
      catalog_version: input.catalogVersion,
      route_id: input.route.id,
      provider_id: input.providerId,
      upstream_model_id: input.route.upstreamModelId,
      billing_mode: input.billingMode,
      reserved_microcredits: input.reservedMicroCredits,
      estimated_usage: input.estimatedUsage,
      pricing_snapshot: {
        rates: input.model.rates,
        priceMultiplierBps: input.model.priceMultiplierBps,
        promotion: input.model.promotion,
        routeSource: input.route.source,
      },
      expires_at: input.expiresAt,
    })
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"),
      organization_id: input.organizationId,
      reservation_id: reservationId,
      entry_type: "reserve",
      idempotency_key: `${input.idempotencyKey}:reserve`,
      amount_microcredits: input.reservedMicroCredits,
      available_delta_microcredits: -input.reservedMicroCredits,
      reserved_delta_microcredits: input.reservedMicroCredits,
      available_balance_after: available,
      reserved_balance_after: reserved,
      wallet_version_after: version,
      reason_code: "INFERENCE_TOKEN_RESERVE",
      metadata: { runId: input.runId, modelSku: input.model.sku, catalogVersion: input.catalogVersion },
    })
    const [created] = await tx.select().from(RenCreditReservationTable).where(eq(RenCreditReservationTable.id, reservationId)).limit(1)
    if (!created) throw new Error("RENCREDIT_RESERVATION_CREATE_FAILED")
    return { reservation: created, replayed: false as const }
  })
}

export async function settleInferenceCredits(input: {
  reservationId: ReservationId
  usage: RenWorkTokenUsage
  providerResponseId: string
  accuracy: "reported" | "estimated" | "tokenizer"
  hasResult: boolean
}) {
  return db.transaction(async (tx) => {
    const [reservation] = await tx.select().from(RenCreditReservationTable)
      .where(eq(RenCreditReservationTable.id, input.reservationId)).for("update").limit(1)
    if (!reservation) throw new Error("RENCREDIT_RESERVATION_NOT_FOUND")
    if (reservation.status !== "reserved") return reservation

    const [wallet] = await tx.select().from(RenCreditWalletTable)
      .where(eq(RenCreditWalletTable.organization_id, reservation.organization_id)).for("update").limit(1)
    if (!wallet) throw new Error("RENCREDIT_WALLET_UNAVAILABLE")

    const snapshot = reservation.pricing_snapshot as Pick<RenWorkAdminModel, "rates" | "priceMultiplierBps" | "promotion">
    const computed = reservation.billing_mode === "free" || !input.hasResult
      ? 0
      : calculateRenCreditMicroCharge(input.usage, snapshot, reservation.created_at)
    const captured = computed
    const released = Math.max(0, reservation.reserved_microcredits - captured)
    const additionalCharge = Math.max(0, captured - reservation.reserved_microcredits)
    const nextStatus = input.hasResult ? "captured" as const : "released" as const
    // Provider-reported usage is authoritative even if it exceeds the estimate.
    // A negative available balance represents debt and blocks the next reserve.
    const available = wallet.available_microcredits + released - additionalCharge
    const reserved = wallet.reserved_microcredits - reservation.reserved_microcredits
    const version = wallet.version + 1

    if (input.hasResult) {
      await tx.insert(RenCreditUsageEventTable).values({
        id: createDenTypeId("renCreditUsageEvent"),
        organization_id: reservation.organization_id,
        reservation_id: reservation.id,
        provider_response_id: input.providerResponseId,
        provider_id: reservation.provider_id,
        model_sku: reservation.model_sku,
        input_tokens: input.usage.inputTokens,
        output_tokens: input.usage.outputTokens,
        reasoning_tokens: input.usage.reasoningTokens,
        cache_read_tokens: input.usage.cacheReadTokens,
        cache_write_tokens: input.usage.cacheWriteTokens,
        accuracy: input.accuracy,
        occurred_at: new Date(),
      })
    }
    await tx.update(RenCreditWalletTable).set({
      available_microcredits: available,
      reserved_microcredits: reserved,
      version,
    }).where(eq(RenCreditWalletTable.organization_id, reservation.organization_id))
    await tx.update(RenCreditReservationTable).set({
      status: nextStatus,
      captured_microcredits: captured,
      released_microcredits: released,
      actual_usage: input.usage,
      provider_response_id: input.providerResponseId,
      has_result: input.hasResult,
      settled_at: new Date(),
    }).where(eq(RenCreditReservationTable.id, reservation.id))
    await tx.insert(RenCreditLedgerEntryTable).values({
      id: createDenTypeId("renCreditLedgerEntry"),
      organization_id: reservation.organization_id,
      reservation_id: reservation.id,
      entry_type: input.hasResult ? "capture" : "release",
      idempotency_key: `${reservation.id}:settle`,
      amount_microcredits: captured,
      available_delta_microcredits: released - additionalCharge,
      reserved_delta_microcredits: -reservation.reserved_microcredits,
      available_balance_after: available,
      reserved_balance_after: reserved,
      wallet_version_after: version,
      reason_code: input.hasResult ? "INFERENCE_TOKEN_CAPTURE" : "INFERENCE_NO_RESULT_RELEASE",
      metadata: { providerResponseId: input.providerResponseId, usage: input.usage },
    })
    return { ...reservation, status: nextStatus, captured_microcredits: captured, released_microcredits: released }
  })
}

export async function getInferenceReservationForPrincipal(input: InferencePrincipal & { reservationId: string }) {
  const [reservation] = await db.select().from(RenCreditReservationTable).where(and(
    eq(RenCreditReservationTable.id, input.reservationId as ReservationId),
    eq(RenCreditReservationTable.organization_id, input.organizationId),
    eq(RenCreditReservationTable.org_membership_id, input.memberId),
    eq(RenCreditReservationTable.inference_key_id, input.inferenceKeyId),
  )).limit(1)
  return reservation ?? null
}

export async function releaseInferenceCredits(input: { reservationId: ReservationId; failureCode: string }) {
  const zeroUsage: RenWorkTokenUsage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  const settled = await settleInferenceCredits({
    reservationId: input.reservationId,
    usage: zeroUsage,
    providerResponseId: `failed:${input.reservationId}`,
    accuracy: "estimated",
    hasResult: false,
  })
  if (settled.status === "released") {
    await db.update(RenCreditReservationTable).set({ failure_code: input.failureCode }).where(eq(RenCreditReservationTable.id, input.reservationId))
  }
  return settled
}

export async function releaseExpiredInferenceReservations(limit = 100, now = new Date()) {
  const expired = await db.select({ id: RenCreditReservationTable.id }).from(RenCreditReservationTable).where(and(
    eq(RenCreditReservationTable.status, "reserved"),
    lt(RenCreditReservationTable.expires_at, now),
  )).limit(Math.max(1, Math.min(500, limit)))
  const results = await Promise.allSettled(expired.map((reservation) => releaseInferenceCredits({
    reservationId: reservation.id,
    failureCode: "RESERVATION_EXPIRED",
  })))
  return {
    scanned: expired.length,
    released: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  }
}

export function startRenCreditReservationSweep() {
  const configured = Number(process.env.RENCREDIT_RESERVATION_SWEEP_INTERVAL_MS ?? "60000")
  const intervalMs = Number.isSafeInteger(configured) && configured >= 10_000 ? configured : 60_000
  let stopped = false
  let running = false
  const run = async () => {
    if (stopped || running) return
    running = true
    try {
      await releaseExpiredInferenceReservations()
    } catch (error) {
      console.error("[rencredit] reservation sweep failed", error)
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
