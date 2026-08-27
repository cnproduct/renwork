import { expect, test } from "bun:test"
import {
  InMemoryRenCreditLedger,
  RenCreditLedgerError,
  type RenCreditScope,
} from "../src/renwork-growth/in-memory-rencredit-ledger.js"
import { getRenworkPlanCatalog } from "../src/renwork-growth/plan-catalog.js"

const personalScope: RenCreditScope = { kind: "personal", accountId: "account-a" }
const enterpriseScope: RenCreditScope = { kind: "enterprise", tenantId: "tenant-a" }

function createLedger(memberLimit: number | null = null) {
  let nextId = 0
  const ledger = new InMemoryRenCreditLedger({
    catalog: getRenworkPlanCatalog(),
    resolveAmount: (operationCode) => operationCode === "BUYER_EMAIL_UNLOCK" ? 10 : null,
    now: () => new Date("2026-08-26T01:00:00.000Z"),
    idFactory: (kind) => `${kind}-${++nextId}`,
  })
  ledger.createWallet({
    walletId: "wallet-a",
    scope: personalScope,
    shared: false,
    balance: 100,
    memberLimit,
  })
  return ledger
}

function expectLedgerError(run: () => unknown, code: string) {
  try {
    run()
    throw new Error(`Expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(RenCreditLedgerError)
    if (error instanceof RenCreditLedgerError) expect(error.code).toBe(code)
  }
}

test("quote reserve and capture charge a successful result exactly once", () => {
  const ledger = createLedger()
  const quote = ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-person-1-email",
    resultKey: "person-1-email",
  })
  expect(ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-person-1-email",
    resultKey: "person-1-email",
  })).toEqual(quote)

  expect(ledger.reserve(quote.quoteId).state).toBe("reserved")
  expect(ledger.getWallet("wallet-a", personalScope)).toMatchObject({ balance: 100, reserved: 10, available: 90 })
  const captured = ledger.capture(quote.quoteId)
  expect(captured.state).toBe("captured")
  expect(ledger.capture(quote.quoteId)).toEqual(captured)
  expect(ledger.getWallet("wallet-a", personalScope)).toMatchObject({ balance: 90, reserved: 0, available: 90 })
})

test("a duplicate result is returned without a second charge", () => {
  const ledger = createLedger()
  const first = ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-first",
    resultKey: "person-1-email",
  })
  ledger.reserve(first.quoteId)
  const firstCapture = ledger.capture(first.quoteId)

  const repeated = ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-repeat",
    resultKey: "person-1-email",
  })
  expect(ledger.reserve(repeated.quoteId)).toEqual(firstCapture)
  expect(ledger.getWallet("wallet-a", personalScope)).toMatchObject({ balance: 90, reserved: 0, available: 90 })
})

test("no result releases the reservation and preserves the balance", () => {
  const ledger = createLedger()
  const quote = ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-no-result",
    resultKey: "person-2-email",
  })
  ledger.reserve(quote.quoteId)
  const released = ledger.release({ quoteId: quote.quoteId, reason: "no_result" })
  expect(released).toMatchObject({ state: "released", releaseReason: "no_result", amount: 10 })
  expect(ledger.release({ quoteId: quote.quoteId, reason: "no_result" })).toEqual(released)
  expect(ledger.getWallet("wallet-a", personalScope)).toMatchObject({ balance: 100, reserved: 0, available: 100 })
})

test("wallet scope and member limits fail closed", () => {
  const ledger = createLedger(5)
  expectLedgerError(() => ledger.getWallet("wallet-a", enterpriseScope), "wallet_scope_mismatch")
  const quote = ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_email_unlock",
    idempotencyKey: "unlock-over-limit",
    resultKey: "person-3-email",
  })
  expectLedgerError(() => ledger.reserve(quote.quoteId), "member_limit_exceeded")
})

test("free previews and unpriced operations never create a chargeable quote", () => {
  const ledger = createLedger()
  expectLedgerError(() => ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_company_preview",
    idempotencyKey: "preview-company-1",
    resultKey: "company-1",
  }), "rencredit_not_required")
  expectLedgerError(() => ledger.quote({
    walletId: "wallet-a",
    scope: personalScope,
    memberId: "account-a",
    event: "buyer_phone_unlock",
    idempotencyKey: "unlock-phone-1",
    resultKey: "person-1-phone",
  }), "operation_price_unavailable")
})
