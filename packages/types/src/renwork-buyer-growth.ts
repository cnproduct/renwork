import { z } from "zod"
import { renworkCreditQuoteSchema, renworkCreditReceiptSchema } from "./renwork-commerce"

const identifierSchema = z.string().trim().min(1).max(160)

export const renworkBuyerSearchRequestSchema = z.object({
  product: z.string().trim().min(2).max(240),
  market: z.string().trim().min(2).max(160),
  customerType: z.string().trim().min(2).max(240),
  workspaceId: identifierSchema,
})
export type RenworkBuyerSearchRequest = z.infer<typeof renworkBuyerSearchRequestSchema>

export const renworkBuyerEvidenceSchema = z.object({
  id: identifierSchema,
  grade: z.enum(["E1", "E2", "E3"]),
  assertion: z.enum(["company_identity", "product_fit", "buyer_signal", "contact_identity"]),
  summary: z.string().trim().min(1).max(320),
  sourceSummary: z.string().trim().min(1).max(160),
  observedAt: z.string().datetime(),
})
export type RenworkBuyerEvidence = z.infer<typeof renworkBuyerEvidenceSchema>

export const renworkMaskedContactSchema = z.object({
  contactId: identifierSchema,
  maskedName: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  availability: z.object({
    verifiedEmail: z.boolean(),
    verifiedPhone: z.boolean(),
  }),
})
export type RenworkMaskedContact = z.infer<typeof renworkMaskedContactSchema>

export const renworkBuyerCompanyPreviewSchema = z.object({
  companyId: identifierSchema,
  companyName: z.string().trim().min(1).max(200),
  country: z.string().trim().min(1).max(120),
  website: z.string().url().nullable(),
  matchScore: z.number().int().min(0).max(100),
  matchReasons: z.array(z.string().trim().min(1).max(240)).min(1),
  evidence: z.array(renworkBuyerEvidenceSchema).min(1),
  riskFlags: z.array(z.string().trim().min(1).max(240)),
  contacts: z.array(renworkMaskedContactSchema),
})
export type RenworkBuyerCompanyPreview = z.infer<typeof renworkBuyerCompanyPreviewSchema>

export const renworkBuyerSearchResponseSchema = z.object({
  schemaVersion: z.literal(1),
  queryId: identifierSchema,
  generatedAt: z.string().datetime(),
  charge: z.literal("free"),
  companies: z.array(renworkBuyerCompanyPreviewSchema),
  evidenceNotice: z.string().trim().min(1).max(320),
})
export type RenworkBuyerSearchResponse = z.infer<typeof renworkBuyerSearchResponseSchema>

export const renworkVerifiedContactSchema = z.object({
  contactId: identifierSchema,
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  email: z.string().email().nullable(),
  phone: z.string().trim().min(5).max(80).nullable(),
  verificationStatus: z.enum(["verified", "partially_verified"]),
  verifiedAt: z.string().datetime(),
  sourceSummary: z.string().trim().min(1).max(240),
})
export type RenworkVerifiedContact = z.infer<typeof renworkVerifiedContactSchema>

export const renworkBuyerUnlockQuoteRequestSchema = z.object({
  workspaceId: identifierSchema,
  companyId: identifierSchema,
  contactId: identifierSchema,
  fields: z.array(z.enum(["email", "phone"])).min(1),
  idempotencyKey: identifierSchema,
})
export type RenworkBuyerUnlockQuoteRequest = z.infer<typeof renworkBuyerUnlockQuoteRequestSchema>

export const renworkBuyerUnlockQuoteResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("quoted"),
    quote: renworkCreditQuoteSchema,
    protections: z.object({
      noResultNoCharge: z.literal(true),
      duplicateUnlockFree: z.literal(true),
      explicitApprovalRequired: z.literal(true),
    }),
  }),
  z.object({
    status: z.literal("already_unlocked"),
    contact: renworkVerifiedContactSchema,
    originalReceiptId: identifierSchema,
    chargedAmount: z.literal(0),
  }),
])
export type RenworkBuyerUnlockQuoteResponse = z.infer<typeof renworkBuyerUnlockQuoteResponseSchema>

export const renworkBuyerUnlockRequestSchema = z.object({
  workspaceId: identifierSchema,
  quoteId: identifierSchema,
  approval: z.literal(true),
  idempotencyKey: identifierSchema,
})
export type RenworkBuyerUnlockRequest = z.infer<typeof renworkBuyerUnlockRequestSchema>

export const renworkBuyerUnlockResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("delivered"),
    contact: renworkVerifiedContactSchema,
    receipt: renworkCreditReceiptSchema.refine((receipt) => receipt.state === "captured", {
      message: "A delivered contact requires a captured receipt",
    }),
    savedToWorkspace: z.boolean(),
  }),
  z.object({
    status: z.literal("released"),
    receipt: renworkCreditReceiptSchema.refine((receipt) => receipt.state === "released", {
      message: "A failed delivery requires a released receipt",
    }),
    reason: z.enum(["user_canceled", "no_result", "upstream_failure", "timeout", "privacy_stop"]),
    balanceChanged: z.literal(false),
  }),
])
export type RenworkBuyerUnlockResponse = z.infer<typeof renworkBuyerUnlockResponseSchema>

export const renworkBuyerGatewayUnavailableSchema = z.object({
  error: z.literal("provider_gateway_unavailable"),
  message: z.string().trim().min(1).max(320),
})
export type RenworkBuyerGatewayUnavailable = z.infer<typeof renworkBuyerGatewayUnavailableSchema>
