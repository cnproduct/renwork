import { randomUUID } from "node:crypto"
import {
  renworkCreditQuoteSchema,
  renworkCreditReceiptSchema,
  type RenworkCreditEvent,
  type RenworkCreditQuote,
  type RenworkCreditReceipt,
} from "@openwork/types/renwork-commerce"
import type { RenworkPlanCatalog } from "@openwork/types/renwork-commerce"

export type RenCreditScope =
  | { kind: "personal"; accountId: string }
  | { kind: "enterprise"; tenantId: string }

type Wallet = {
  id: string
  scopeKey: string
  shared: boolean
  balance: number
  reserved: number
  memberLimit: number | null
  memberCaptured: Map<string, number>
  memberReserved: Map<string, number>
}

type QuoteContext = {
  scopeKey: string
  walletId: string
  memberId: string
  event: RenworkCreditEvent
}

type StoredQuote = {
  quote: RenworkCreditQuote
  context: QuoteContext
}

export type CreateRenCreditWalletInput = {
  walletId: string
  scope: RenCreditScope
  shared: boolean
  balance: number
  memberLimit: number | null
}

export type CreateRenCreditQuoteInput = {
  walletId: string
  scope: RenCreditScope
  memberId: string
  event: RenworkCreditEvent
  idempotencyKey: string
  resultKey: string
}

export type ReleaseRenCreditInput = {
  quoteId: string
  reason: "user_canceled" | "no_result" | "upstream_failure" | "timeout" | "privacy_stop"
}

export type RenCreditWalletSnapshot = {
  walletId: string
  scopeKey: string
  shared: boolean
  balance: number
  reserved: number
  available: number
  memberLimit: number | null
}

export class RenCreditLedgerError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "RenCreditLedgerError"
  }
}

type LedgerOptions = {
  catalog: RenworkPlanCatalog
  resolveAmount: (operationCode: string) => number | null
  now?: () => Date
  idFactory?: (kind: "quote" | "receipt") => string
}

function scopeKey(scope: RenCreditScope): string {
  return scope.kind === "personal"
    ? `personal:${scope.accountId}`
    : `enterprise:${scope.tenantId}`
}

function memberValue(values: Map<string, number>, memberId: string): number {
  return values.get(memberId) ?? 0
}

export class InMemoryRenCreditLedger {
  private readonly wallets = new Map<string, Wallet>()
  private readonly quotes = new Map<string, StoredQuote>()
  private readonly quotesByIdempotencyKey = new Map<string, StoredQuote>()
  private readonly receiptsByQuote = new Map<string, RenworkCreditReceipt>()
  private readonly capturedByResult = new Map<string, RenworkCreditReceipt>()
  private readonly now: () => Date
  private readonly idFactory: (kind: "quote" | "receipt") => string

  constructor(private readonly options: LedgerOptions) {
    this.now = options.now ?? (() => new Date())
    this.idFactory = options.idFactory ?? ((kind) => `${kind}-${randomUUID()}`)
  }

  createWallet(input: CreateRenCreditWalletInput): RenCreditWalletSnapshot {
    if (this.wallets.has(input.walletId)) throw new RenCreditLedgerError("wallet_already_exists")
    if (!Number.isInteger(input.balance) || input.balance < 0) throw new RenCreditLedgerError("invalid_wallet_balance")
    if (input.memberLimit !== null && (!Number.isInteger(input.memberLimit) || input.memberLimit < 0)) {
      throw new RenCreditLedgerError("invalid_member_limit")
    }
    const wallet: Wallet = {
      id: input.walletId,
      scopeKey: scopeKey(input.scope),
      shared: input.shared,
      balance: input.balance,
      reserved: 0,
      memberLimit: input.memberLimit,
      memberCaptured: new Map(),
      memberReserved: new Map(),
    }
    this.wallets.set(wallet.id, wallet)
    return this.walletSnapshot(wallet)
  }

  getWallet(walletId: string, scope: RenCreditScope): RenCreditWalletSnapshot {
    return this.walletSnapshot(this.requireWallet(walletId, scope))
  }

  quote(input: CreateRenCreditQuoteInput): RenworkCreditQuote {
    const wallet = this.requireWallet(input.walletId, input.scope)
    const existing = this.quotesByIdempotencyKey.get(input.idempotencyKey)
    if (existing) {
      const matches = existing.context.scopeKey === wallet.scopeKey
        && existing.context.walletId === input.walletId
        && existing.context.memberId === input.memberId
        && existing.context.event === input.event
        && existing.quote.resultKey === input.resultKey
      if (!matches) throw new RenCreditLedgerError("idempotency_conflict")
      return existing.quote
    }

    const policy = this.options.catalog.creditPolicies.find((item) => item.event === input.event)
    if (!policy) throw new RenCreditLedgerError("operation_not_registered")
    if (policy.chargeTrigger === "free") throw new RenCreditLedgerError("rencredit_not_required")
    const amount = this.options.resolveAmount(policy.operationCode)
    if (amount === null || !Number.isInteger(amount) || amount <= 0) {
      throw new RenCreditLedgerError("operation_price_unavailable")
    }

    const quotedAt = this.now()
    const quote = renworkCreditQuoteSchema.parse({
      schemaVersion: 1,
      quoteId: this.idFactory("quote"),
      catalogVersion: this.options.catalog.catalogVersion,
      operationCode: policy.operationCode,
      event: policy.event,
      idempotencyKey: input.idempotencyKey,
      resultKey: input.resultKey,
      amount,
      status: "quoted",
      expiresAt: new Date(quotedAt.getTime() + 5 * 60 * 1000).toISOString(),
      message: "有效结果成功交付后扣费；无结果、超时、隐私停止或取消均不扣费。",
    })
    const stored = {
      quote,
      context: {
        scopeKey: wallet.scopeKey,
        walletId: wallet.id,
        memberId: input.memberId,
        event: input.event,
      },
    }
    this.quotes.set(quote.quoteId, stored)
    this.quotesByIdempotencyKey.set(quote.idempotencyKey, stored)
    return quote
  }

  reserve(quoteId: string): RenworkCreditReceipt {
    const stored = this.requireQuote(quoteId)
    const existing = this.receiptsByQuote.get(quoteId)
    if (existing) return existing

    const resultKey = this.capturedResultKey(stored)
    const priorCapture = this.capturedByResult.get(resultKey)
    if (priorCapture) return priorCapture

    const wallet = this.requireWalletByContext(stored.context)
    const now = this.now()
    if (now.getTime() >= new Date(stored.quote.expiresAt).getTime()) {
      throw new RenCreditLedgerError("quote_expired")
    }
    if (wallet.balance - wallet.reserved < stored.quote.amount) {
      throw new RenCreditLedgerError("insufficient_rencredit")
    }
    const memberUsed = memberValue(wallet.memberCaptured, stored.context.memberId)
      + memberValue(wallet.memberReserved, stored.context.memberId)
    if (wallet.memberLimit !== null && memberUsed + stored.quote.amount > wallet.memberLimit) {
      throw new RenCreditLedgerError("member_limit_exceeded")
    }

    wallet.reserved += stored.quote.amount
    wallet.memberReserved.set(
      stored.context.memberId,
      memberValue(wallet.memberReserved, stored.context.memberId) + stored.quote.amount,
    )
    const receipt = this.receipt(stored, "reserved", null)
    this.receiptsByQuote.set(quoteId, receipt)
    return receipt
  }

  capture(quoteId: string): RenworkCreditReceipt {
    const stored = this.requireQuote(quoteId)
    const existing = this.receiptsByQuote.get(quoteId)
    if (!existing) throw new RenCreditLedgerError("reservation_required")
    if (existing.state === "captured") return existing
    if (existing.state === "released") throw new RenCreditLedgerError("reservation_released")

    const priorCapture = this.capturedByResult.get(this.capturedResultKey(stored))
    if (priorCapture) {
      this.releaseReservedAmount(stored)
      this.receiptsByQuote.set(quoteId, priorCapture)
      return priorCapture
    }

    const wallet = this.requireWalletByContext(stored.context)
    wallet.balance -= stored.quote.amount
    this.releaseMemberReservation(wallet, stored.context.memberId, stored.quote.amount)
    wallet.reserved -= stored.quote.amount
    wallet.memberCaptured.set(
      stored.context.memberId,
      memberValue(wallet.memberCaptured, stored.context.memberId) + stored.quote.amount,
    )
    const receipt = this.receipt(stored, "captured", null)
    this.receiptsByQuote.set(quoteId, receipt)
    this.capturedByResult.set(this.capturedResultKey(stored), receipt)
    return receipt
  }

  release(input: ReleaseRenCreditInput): RenworkCreditReceipt {
    const stored = this.requireQuote(input.quoteId)
    const existing = this.receiptsByQuote.get(input.quoteId)
    if (!existing) throw new RenCreditLedgerError("reservation_required")
    if (existing.state === "released") return existing
    if (existing.state === "captured") throw new RenCreditLedgerError("result_already_captured")

    this.releaseReservedAmount(stored)
    const receipt = this.receipt(stored, "released", input.reason)
    this.receiptsByQuote.set(input.quoteId, receipt)
    return receipt
  }

  private receipt(
    stored: StoredQuote,
    state: "reserved" | "captured" | "released",
    releaseReason: ReleaseRenCreditInput["reason"] | null,
  ): RenworkCreditReceipt {
    return renworkCreditReceiptSchema.parse({
      schemaVersion: 1,
      receiptId: this.idFactory("receipt"),
      quoteId: stored.quote.quoteId,
      walletId: stored.context.walletId,
      operationCode: stored.quote.operationCode,
      idempotencyKey: stored.quote.idempotencyKey,
      resultKey: stored.quote.resultKey,
      state,
      amount: stored.quote.amount,
      occurredAt: this.now().toISOString(),
      releaseReason,
    })
  }

  private requireWallet(walletId: string, scope: RenCreditScope): Wallet {
    const wallet = this.wallets.get(walletId)
    if (!wallet) throw new RenCreditLedgerError("wallet_not_found")
    if (wallet.scopeKey !== scopeKey(scope)) throw new RenCreditLedgerError("wallet_scope_mismatch")
    return wallet
  }

  private requireWalletByContext(context: QuoteContext): Wallet {
    const wallet = this.wallets.get(context.walletId)
    if (!wallet || wallet.scopeKey !== context.scopeKey) throw new RenCreditLedgerError("wallet_scope_mismatch")
    return wallet
  }

  private requireQuote(quoteId: string): StoredQuote {
    const stored = this.quotes.get(quoteId)
    if (!stored) throw new RenCreditLedgerError("quote_not_found")
    return stored
  }

  private walletSnapshot(wallet: Wallet): RenCreditWalletSnapshot {
    return {
      walletId: wallet.id,
      scopeKey: wallet.scopeKey,
      shared: wallet.shared,
      balance: wallet.balance,
      reserved: wallet.reserved,
      available: wallet.balance - wallet.reserved,
      memberLimit: wallet.memberLimit,
    }
  }

  private capturedResultKey(stored: StoredQuote): string {
    return `${stored.context.scopeKey}:${stored.quote.operationCode}:${stored.quote.resultKey}`
  }

  private releaseReservedAmount(stored: StoredQuote): void {
    const wallet = this.requireWalletByContext(stored.context)
    wallet.reserved -= stored.quote.amount
    this.releaseMemberReservation(wallet, stored.context.memberId, stored.quote.amount)
  }

  private releaseMemberReservation(wallet: Wallet, memberId: string, amount: number): void {
    const next = memberValue(wallet.memberReserved, memberId) - amount
    if (next <= 0) wallet.memberReserved.delete(memberId)
    else wallet.memberReserved.set(memberId, next)
  }
}
