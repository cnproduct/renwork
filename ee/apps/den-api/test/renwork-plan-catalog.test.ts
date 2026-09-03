import { expect, test } from "bun:test"
import {
  renworkCreditQuoteSchema,
  renworkCreditReceiptSchema,
  renworkEntitlementSnapshotSchema,
  renworkPlanCatalogSchema,
} from "@openwork/types/renwork-commerce"
import { getRenworkPlanCatalog } from "../src/renwork-growth/plan-catalog.js"

test("RenWork V14 catalog requires paid access and separates personal checkout from enterprise review", () => {
  const catalog = renworkPlanCatalogSchema.parse(getRenworkPlanCatalog())
  expect(catalog.status).toBe("active")
  expect(catalog.plans.every((plan) => !plan.features.localFreeCore)).toBe(true)
  expect(catalog.plans.some((plan) => plan.audience === "personal")).toBe(true)
  expect(catalog.plans.some((plan) => plan.audience === "enterprise")).toBe(true)
  expect(catalog.plans.filter((plan) => plan.audience === "personal").flatMap((plan) => plan.offers).every((offer) => offer.purchaseMode === "checkout")).toBe(true)
  expect(catalog.plans.filter((plan) => plan.audience === "enterprise").flatMap((plan) => plan.offers).every((offer) => offer.purchaseMode === "request_access" || offer.purchaseMode === "contact_sales")).toBe(true)
  expect(catalog.plans.flatMap((plan) => plan.offers).some((offer) => offer.purchaseMode === "free")).toBe(false)
})

test("RenWork catalog never exposes a provider or upstream credit contract", () => {
  const serialized = JSON.stringify(getRenworkPlanCatalog())
  expect(serialized).not.toMatch(/hunter|apollo|snov|api[_ -]?key|upstream[_ -]?credit/i)
})

test("buyer previews are free and unlock operations charge only on successful delivery", () => {
  const policies = getRenworkPlanCatalog().creditPolicies
  expect(policies.find((policy) => policy.event === "buyer_company_preview")?.chargeTrigger).toBe("free")
  for (const policy of policies.filter((item) => item.event !== "buyer_company_preview")) {
    expect(policy.chargeTrigger, policy.event).toBe("successful_delivery")
  }
})

test("entitlement snapshots distinguish subscription rights from RenCredit balances", () => {
  const snapshot = renworkEntitlementSnapshotSchema.parse({
    schemaVersion: 1,
    catalogVersion: getRenworkPlanCatalog().catalogVersion,
    snapshotId: "snapshot-personal-1",
    generatedAt: "2026-08-26T01:00:00.000Z",
    scope: { kind: "personal", accountId: "account-1" },
    planId: "personal-light",
    offerId: "personal-light-monthly",
    subscriptionStatus: "active",
    currentPeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    features: getRenworkPlanCatalog().plans[0]?.features,
    renCredit: {
      walletId: "wallet-personal-1",
      shared: false,
      balance: 100,
      reserved: 20,
      available: 80,
      memberLimit: null,
    },
  })
  expect(snapshot.features.localFreeCore).toBe(false)
  expect(snapshot.renCredit.available).toBe(80)
  expect(snapshot.subscriptionStatus).toBe("active")
})

test("RenCredit receipts model successful capture and failure release without supplier cost", () => {
  const quote = renworkCreditQuoteSchema.parse({
    schemaVersion: 1,
    quoteId: "quote-1",
    catalogVersion: getRenworkPlanCatalog().catalogVersion,
    operationCode: "BUYER_EMAIL_UNLOCK",
    event: "buyer_email_unlock",
    idempotencyKey: "tenant-workspace-person-email",
    resultKey: "normalized-person-email",
    amount: 10,
    status: "quoted",
    expiresAt: "2026-08-26T01:05:00.000Z",
    message: "有效邮箱成功交付后扣费，无有效结果不扣费。",
  })
  const captured = renworkCreditReceiptSchema.parse({
    schemaVersion: 1,
    receiptId: "receipt-captured-1",
    quoteId: quote.quoteId,
    walletId: "wallet-1",
    operationCode: quote.operationCode,
    idempotencyKey: quote.idempotencyKey,
    resultKey: quote.resultKey,
    state: "captured",
    amount: quote.amount,
    occurredAt: "2026-08-26T01:01:00.000Z",
    releaseReason: null,
  })
  const released = renworkCreditReceiptSchema.parse({
    ...captured,
    receiptId: "receipt-released-1",
    state: "released",
    releaseReason: "no_result",
  })
  expect(captured.state).toBe("captured")
  expect(released.state).toBe("released")
  expect(JSON.stringify(captured)).not.toMatch(/supplier|provider|cost/i)
})

test("invalid balance math and incomplete release receipts fail closed", () => {
  const features = getRenworkPlanCatalog().plans[0]?.features
  const invalidSnapshot = renworkEntitlementSnapshotSchema.safeParse({
    schemaVersion: 1,
    catalogVersion: getRenworkPlanCatalog().catalogVersion,
    snapshotId: "snapshot-invalid",
    generatedAt: "2026-08-26T01:00:00.000Z",
    scope: { kind: "personal", accountId: "account-1" },
    planId: "personal-light",
    offerId: "personal-light-monthly",
    subscriptionStatus: "active",
    currentPeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    features,
    renCredit: {
      walletId: "wallet-personal-1",
      shared: true,
      balance: 100,
      reserved: 20,
      available: 100,
      memberLimit: null,
    },
  })
  expect(invalidSnapshot.success).toBe(false)

  const invalidRelease = renworkCreditReceiptSchema.safeParse({
    schemaVersion: 1,
    receiptId: "receipt-invalid-release",
    quoteId: "quote-1",
    walletId: "wallet-1",
    operationCode: "BUYER_EMAIL_UNLOCK",
    idempotencyKey: "tenant-workspace-person-email",
    resultKey: "normalized-person-email",
    state: "released",
    amount: 10,
    occurredAt: "2026-08-26T01:01:00.000Z",
    releaseReason: null,
  })
  expect(invalidRelease.success).toBe(false)
})
