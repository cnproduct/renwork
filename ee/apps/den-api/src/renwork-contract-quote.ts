import { and, desc, eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable, RenworkContractQuoteTable } from "@openwork-ee/den-db/schema"
import { createDenTypeId } from "@openwork-ee/utils/typeid"
import { db } from "./db.js"

type OrganizationId = typeof OrganizationTable.$inferSelect.id
type UserId = typeof RenworkContractQuoteTable.$inferSelect.created_by_user_id
type QuoteId = typeof RenworkContractQuoteTable.$inferSelect.id
type BillingInterval = typeof RenworkContractQuoteTable.$inferInsert.billing_interval

export type ContractQuoteTerms = {
  amountMinor: number
  includedRenCredits: number
  seatLimit: number
  billingInterval: BillingInterval
  contractReference: string
  note?: string | null
}

export async function createRenworkContractQuote(input: ContractQuoteTerms & {
  organizationId: OrganizationId
  actorUserId: UserId
}) {
  return db.transaction(async (tx) => {
    const [organization] = await tx.select({ id: OrganizationTable.id }).from(OrganizationTable)
      .where(eq(OrganizationTable.id, input.organizationId)).for("update").limit(1)
    if (!organization) throw new Error("RENWORK_ORGANIZATION_NOT_FOUND")

    const id = createDenTypeId("renworkContractQuote")
    const values: typeof RenworkContractQuoteTable.$inferInsert = {
      id,
      organization_id: input.organizationId,
      created_by_user_id: input.actorUserId,
      amount_minor: input.amountMinor,
      included_rencredits: input.includedRenCredits,
      seat_limit: input.seatLimit,
      billing_interval: input.billingInterval,
      contract_reference: input.contractReference,
      note: input.note ?? null,
    }
    await tx.insert(RenworkContractQuoteTable).values(values)
    return { ...values, status: "draft" as const }
  })
}

export async function updateRenworkContractQuote(input: ContractQuoteTerms & {
  quoteId: QuoteId
  actorUserId: UserId
}) {
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(RenworkContractQuoteTable)
      .where(eq(RenworkContractQuoteTable.id, input.quoteId)).for("update").limit(1)
    if (!quote) throw new Error("RENWORK_CONTRACT_QUOTE_NOT_FOUND")
    if (quote.status !== "draft") throw new Error("RENWORK_CONTRACT_QUOTE_NOT_EDITABLE")

    await tx.update(RenworkContractQuoteTable).set({
      amount_minor: input.amountMinor,
      included_rencredits: input.includedRenCredits,
      seat_limit: input.seatLimit,
      billing_interval: input.billingInterval,
      contract_reference: input.contractReference,
      note: input.note ?? null,
    }).where(eq(RenworkContractQuoteTable.id, input.quoteId))

    return {
      ...quote,
      amount_minor: input.amountMinor,
      included_rencredits: input.includedRenCredits,
      seat_limit: input.seatLimit,
      billing_interval: input.billingInterval,
      contract_reference: input.contractReference,
      note: input.note ?? null,
    }
  })
}

export async function approveRenworkContractQuote(input: {
  quoteId: QuoteId
  actorUserId: UserId
  now?: Date
}) {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(RenworkContractQuoteTable)
      .where(eq(RenworkContractQuoteTable.id, input.quoteId)).for("update").limit(1)
    if (!quote) throw new Error("RENWORK_CONTRACT_QUOTE_NOT_FOUND")
    if (quote.status === "approved" || quote.status === "published") return { quote, replayed: true as const }
    if (quote.status !== "draft") throw new Error("RENWORK_CONTRACT_QUOTE_NOT_APPROVABLE")
    if (quote.created_by_user_id === input.actorUserId) throw new Error("RENWORK_CONTRACT_SECOND_ADMIN_REQUIRED")

    await tx.update(RenworkContractQuoteTable).set({
      status: "approved",
      approved_by_user_id: input.actorUserId,
      approved_at: now,
    }).where(eq(RenworkContractQuoteTable.id, input.quoteId))
    return {
      quote: { ...quote, status: "approved" as const, approved_by_user_id: input.actorUserId, approved_at: now },
      replayed: false as const,
    }
  })
}

export async function publishRenworkContractQuote(input: {
  quoteId: QuoteId
  actorUserId: UserId
  now?: Date
}) {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(RenworkContractQuoteTable)
      .where(eq(RenworkContractQuoteTable.id, input.quoteId)).for("update").limit(1)
    if (!quote) throw new Error("RENWORK_CONTRACT_QUOTE_NOT_FOUND")
    if (quote.status === "published") return { quote, replayed: true as const }
    if (quote.status !== "approved" || !quote.approved_by_user_id || quote.approved_by_user_id === quote.created_by_user_id) {
      throw new Error("RENWORK_CONTRACT_QUOTE_NOT_APPROVED")
    }

    await tx.update(RenworkContractQuoteTable).set({
      status: "published",
      published_by_user_id: input.actorUserId,
      published_at: now,
    }).where(eq(RenworkContractQuoteTable.id, input.quoteId))
    return {
      quote: { ...quote, status: "published" as const, published_by_user_id: input.actorUserId, published_at: now },
      replayed: false as const,
    }
  })
}

export async function revokeRenworkContractQuote(input: {
  quoteId: QuoteId
  actorUserId: UserId
  reason: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(RenworkContractQuoteTable)
      .where(eq(RenworkContractQuoteTable.id, input.quoteId)).for("update").limit(1)
    if (!quote) throw new Error("RENWORK_CONTRACT_QUOTE_NOT_FOUND")
    if (quote.status === "revoked") return { quote, replayed: true as const }
    await tx.update(RenworkContractQuoteTable).set({
      status: "revoked",
      revoked_at: now,
      revoke_reason: input.reason,
    }).where(eq(RenworkContractQuoteTable.id, input.quoteId))
    return {
      quote: { ...quote, status: "revoked" as const, revoked_at: now, revoke_reason: input.reason },
      replayed: false as const,
    }
  })
}

export async function listRenworkContractQuotes(input: { organizationId?: OrganizationId; limit?: number }) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50))
  const query = db.select().from(RenworkContractQuoteTable)
  return input.organizationId
    ? query.where(eq(RenworkContractQuoteTable.organization_id, input.organizationId)).orderBy(desc(RenworkContractQuoteTable.created_at)).limit(limit)
    : query.orderBy(desc(RenworkContractQuoteTable.created_at)).limit(limit)
}

export async function listPublishedRenworkContractQuotes(organizationId: OrganizationId) {
  return db.select().from(RenworkContractQuoteTable).where(and(
    eq(RenworkContractQuoteTable.organization_id, organizationId),
    eq(RenworkContractQuoteTable.status, "published"),
  )).orderBy(desc(RenworkContractQuoteTable.published_at))
}
