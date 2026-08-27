import { expect, test } from "bun:test"
import {
  renworkBuyerSearchResponseSchema,
  renworkBuyerUnlockQuoteResponseSchema,
  renworkBuyerUnlockRequestSchema,
  renworkBuyerUnlockResponseSchema,
} from "@openwork/types/renwork-buyer-growth"

const verifiedContact = {
  contactId: "contact-1",
  name: "Alex Morgan",
  role: "Purchasing Director",
  email: "alex@example.test",
  phone: null,
  verificationStatus: "verified",
  verifiedAt: "2026-08-26T18:00:00.000Z",
  sourceSummary: "企业公开信息与联系方式验证结果",
}

const quote = {
  schemaVersion: 1,
  quoteId: "quote-1",
  catalogVersion: "renwork-pilot-2026-08-26.1",
  operationCode: "BUYER_EMAIL_UNLOCK",
  event: "buyer_email_unlock",
  idempotencyKey: "quote-idempotency-1",
  resultKey: "workspace-1:company-1:contact-1:email",
  amount: 8,
  status: "quoted",
  expiresAt: "2026-08-26T18:05:00.000Z",
  message: "有效结果成功交付后扣费；无结果、超时、隐私停止或取消均不扣费。",
}

test("free buyer previews preserve evidence grades and mask contacts", () => {
  const response = renworkBuyerSearchResponseSchema.parse({
    schemaVersion: 1,
    queryId: "query-1",
    generatedAt: "2026-08-26T18:00:00.000Z",
    charge: "free",
    evidenceNotice: "联系人仅证明职业身份与可联系性，不单独证明采购或交易。",
    companies: [{
      companyId: "company-1",
      companyName: "Example Import GmbH",
      country: "Germany",
      website: "https://example.test",
      matchScore: 86,
      matchReasons: ["产品品类与目标市场匹配"],
      evidence: [
        {
          id: "evidence-1",
          grade: "E1",
          assertion: "company_identity",
          summary: "企业官网身份线索",
          sourceSummary: "企业公开网站",
          observedAt: "2026-08-26T17:00:00.000Z",
        },
        {
          id: "evidence-2",
          grade: "E2",
          assertion: "product_fit",
          summary: "公开产品目录显示品类匹配",
          sourceSummary: "公开产品目录",
          observedAt: "2026-08-26T17:00:00.000Z",
        },
        {
          id: "evidence-3",
          grade: "E3",
          assertion: "buyer_signal",
          summary: "独立业务证据支持潜在采购角色",
          sourceSummary: "许可范围内的业务证据摘要",
          observedAt: "2026-08-26T17:00:00.000Z",
        },
      ],
      riskFlags: ["尚未确认近期采购计划"],
      contacts: [{
        contactId: "contact-1",
        maskedName: "A*** M*****",
        role: "Purchasing Director",
        availability: { verifiedEmail: true, verifiedPhone: false },
      }],
    }],
  })

  expect(response.charge).toBe("free")
  expect(response.companies[0]?.evidence.map((item) => item.grade)).toEqual(["E1", "E2", "E3"])
  expect(JSON.stringify(response.companies[0]?.contacts)).not.toContain("alex@example.test")
  expect(response.evidenceNotice).toContain("不单独证明采购或交易")
})

test("a quote requires explicit approval and states both no-result and duplicate protections", () => {
  const response = renworkBuyerUnlockQuoteResponseSchema.parse({
    status: "quoted",
    quote,
    protections: {
      noResultNoCharge: true,
      duplicateUnlockFree: true,
      explicitApprovalRequired: true,
    },
  })
  expect(response.status).toBe("quoted")
  if (response.status !== "quoted") throw new Error("expected quoted response")
  expect(response.protections).toEqual({
    noResultNoCharge: true,
    duplicateUnlockFree: true,
    explicitApprovalRequired: true,
  })
  expect(renworkBuyerUnlockRequestSchema.safeParse({
    workspaceId: "workspace-1",
    quoteId: "quote-1",
    approval: false,
    idempotencyKey: "unlock-1",
  }).success).toBe(false)
})

test("successful delivery captures once while repeat viewing costs zero", () => {
  const delivered = renworkBuyerUnlockResponseSchema.parse({
    status: "delivered",
    contact: verifiedContact,
    receipt: {
      schemaVersion: 1,
      receiptId: "receipt-captured-1",
      quoteId: "quote-1",
      walletId: "wallet-1",
      operationCode: "BUYER_EMAIL_UNLOCK",
      idempotencyKey: "unlock-idempotency-1",
      resultKey: "workspace-1:company-1:contact-1:email",
      state: "captured",
      amount: 8,
      occurredAt: "2026-08-26T18:01:00.000Z",
      releaseReason: null,
    },
    savedToWorkspace: true,
  })
  const repeated = renworkBuyerUnlockQuoteResponseSchema.parse({
    status: "already_unlocked",
    contact: verifiedContact,
    originalReceiptId: "receipt-captured-1",
    chargedAmount: 0,
  })

  expect(delivered.status).toBe("delivered")
  expect(delivered.receipt.state).toBe("captured")
  expect(repeated.status).toBe("already_unlocked")
  expect(repeated.chargedAmount).toBe(0)
})

test("no result releases the reservation and leaves the balance unchanged", () => {
  const released = renworkBuyerUnlockResponseSchema.parse({
    status: "released",
    receipt: {
      schemaVersion: 1,
      receiptId: "receipt-released-1",
      quoteId: "quote-1",
      walletId: "wallet-1",
      operationCode: "BUYER_EMAIL_UNLOCK",
      idempotencyKey: "unlock-idempotency-1",
      resultKey: "workspace-1:company-1:contact-1:email",
      state: "released",
      amount: 8,
      occurredAt: "2026-08-26T18:01:00.000Z",
      releaseReason: "no_result",
    },
    reason: "no_result",
    balanceChanged: false,
  })

  expect(released.status).toBe("released")
  expect(released.receipt.state).toBe("released")
  expect(released.balanceChanged).toBe(false)
})
