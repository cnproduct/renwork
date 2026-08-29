import { z } from "zod"

const identifierSchema = z.string().trim().min(1).max(160)
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const billingIntervalSchema = z.enum(["monthly", "annual"])

export const renworkPlanAudienceSchema = z.enum(["personal", "enterprise"])
export type RenworkPlanAudience = z.infer<typeof renworkPlanAudienceSchema>

export const renworkPlanFeaturesSchema = z.object({
  localFreeCore: z.literal(false),
  managedCloud: z.boolean(),
  officialPlugins: z.boolean(),
  buyerGrowth: z.boolean(),
  sharedWorkspace: z.boolean(),
  sharedRenCreditPool: z.boolean(),
  roleManagement: z.boolean(),
  adminAudit: z.boolean(),
  privateDeployment: z.boolean(),
})
export type RenworkPlanFeatures = z.infer<typeof renworkPlanFeaturesSchema>

export const renworkPlanOfferSchema = z.discriminatedUnion("purchaseMode", [
  z.object({
    id: identifierSchema,
    purchaseMode: z.literal("request_access"),
    billingInterval: billingIntervalSchema,
    currency: currencySchema,
    priceMinor: z.number().int().positive(),
    monthlyEquivalentPriceMinor: z.number().int().positive().nullable(),
    includedRenCredits: z.number().int().nonnegative(),
    cta: z.literal("request_access"),
  }),
  z.object({
    id: identifierSchema,
    purchaseMode: z.literal("free"),
    billingInterval: z.null(),
    currency: currencySchema,
    priceMinor: z.literal(0),
    includedRenCredits: z.number().int().nonnegative(),
    cta: z.literal("current"),
  }),
  z.object({
    id: identifierSchema,
    purchaseMode: z.literal("request_trial"),
    billingInterval: billingIntervalSchema,
    currency: currencySchema.nullable(),
    priceMinor: z.null(),
    includedRenCredits: z.number().int().nonnegative().nullable(),
    cta: z.literal("request_trial"),
  }),
  z.object({
    id: identifierSchema,
    purchaseMode: z.literal("contact_sales"),
    billingInterval: z.null(),
    currency: currencySchema.nullable(),
    priceMinor: z.null(),
    includedRenCredits: z.number().int().nonnegative().nullable(),
    cta: z.literal("contact_sales"),
  }),
  z.object({
    id: identifierSchema,
    purchaseMode: z.literal("checkout"),
    billingInterval: billingIntervalSchema,
    currency: currencySchema,
    priceMinor: z.number().int().positive(),
    includedRenCredits: z.number().int().nonnegative(),
    cta: z.literal("checkout"),
  }),
])
export type RenworkPlanOffer = z.infer<typeof renworkPlanOfferSchema>

export const renworkPlanSchema = z.object({
  id: identifierSchema,
  audience: renworkPlanAudienceSchema,
  displayName: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(240),
  badge: z.string().trim().min(1).max(32).nullable().optional(),
  recommended: z.boolean().optional(),
  seatLimit: z.number().int().positive().nullable(),
  qualityModelLimit: z.object({
    calls: z.number().int().positive().nullable(),
    windowHours: z.number().int().positive(),
    fairUse: z.boolean(),
  }).nullable().optional(),
  features: renworkPlanFeaturesSchema,
  offers: z.array(renworkPlanOfferSchema).min(1),
})
export type RenworkPlan = z.infer<typeof renworkPlanSchema>

export const renworkCreditEventSchema = z.enum([
  "buyer_company_preview",
  "buyer_company_enrichment",
  "buyer_email_unlock",
  "buyer_email_verification",
  "buyer_phone_unlock",
  "buyer_decision_maker_profile",
  "buyer_research_bundle",
  "workflow_productization",
])
export type RenworkCreditEvent = z.infer<typeof renworkCreditEventSchema>

export const renworkCreditPolicySchema = z.object({
  event: renworkCreditEventSchema,
  operationCode: identifierSchema,
  chargeTrigger: z.enum(["free", "successful_delivery"]),
  priceSource: z.literal("authoritative_catalog"),
})
export type RenworkCreditPolicy = z.infer<typeof renworkCreditPolicySchema>

export const renworkPlanCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: identifierSchema,
  status: z.enum(["pilot", "active"]),
  effectiveAt: z.string().datetime(),
  plans: z.array(renworkPlanSchema).min(1),
  creditPolicies: z.array(renworkCreditPolicySchema).min(1),
}).superRefine((catalog, context) => {
  const planIds = new Set<string>()
  const offerIds = new Set<string>()
  for (const [planIndex, plan] of catalog.plans.entries()) {
    if (planIds.has(plan.id)) {
      context.addIssue({ code: "custom", message: `Duplicate plan id: ${plan.id}`, path: ["plans", planIndex, "id"] })
    }
    planIds.add(plan.id)
    for (const [offerIndex, offer] of plan.offers.entries()) {
      if (offerIds.has(offer.id)) {
        context.addIssue({ code: "custom", message: `Duplicate offer id: ${offer.id}`, path: ["plans", planIndex, "offers", offerIndex, "id"] })
      }
      offerIds.add(offer.id)
    }
  }

  const events = new Set<string>()
  const operationCodes = new Set<string>()
  for (const [policyIndex, policy] of catalog.creditPolicies.entries()) {
    if (events.has(policy.event)) {
      context.addIssue({ code: "custom", message: `Duplicate credit event: ${policy.event}`, path: ["creditPolicies", policyIndex, "event"] })
    }
    if (operationCodes.has(policy.operationCode)) {
      context.addIssue({ code: "custom", message: `Duplicate operation code: ${policy.operationCode}`, path: ["creditPolicies", policyIndex, "operationCode"] })
    }
    events.add(policy.event)
    operationCodes.add(policy.operationCode)
  }
})
export type RenworkPlanCatalog = z.infer<typeof renworkPlanCatalogSchema>

const personalEntitlementScopeSchema = z.object({
  kind: z.literal("personal"),
  accountId: identifierSchema,
})

const enterpriseEntitlementScopeSchema = z.object({
  kind: z.literal("enterprise"),
  tenantId: identifierSchema,
  role: z.enum(["owner", "admin", "member"]),
})

export const renworkEntitlementSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: identifierSchema,
  snapshotId: identifierSchema,
  generatedAt: z.string().datetime(),
  scope: z.discriminatedUnion("kind", [
    personalEntitlementScopeSchema,
    enterpriseEntitlementScopeSchema,
  ]),
  planId: identifierSchema,
  offerId: identifierSchema,
  subscriptionStatus: z.enum(["free", "trialing", "active", "past_due", "canceled", "sales_only"]),
  currentPeriodEndsAt: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  features: renworkPlanFeaturesSchema,
  renCredit: z.object({
    walletId: identifierSchema,
    shared: z.boolean(),
    balance: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    memberLimit: z.number().int().nonnegative().nullable(),
  }),
}).superRefine((snapshot, context) => {
  if (snapshot.renCredit.available !== snapshot.renCredit.balance - snapshot.renCredit.reserved) {
    context.addIssue({
      code: "custom",
      message: "RenCredit available balance must equal balance minus reserved",
      path: ["renCredit", "available"],
    })
  }
  if (snapshot.scope.kind === "personal" && snapshot.renCredit.shared) {
    context.addIssue({
      code: "custom",
      message: "A personal entitlement cannot expose a shared RenCredit wallet",
      path: ["renCredit", "shared"],
    })
  }
})
export type RenworkEntitlementSnapshot = z.infer<typeof renworkEntitlementSnapshotSchema>

export const renworkCreditQuoteSchema = z.object({
  schemaVersion: z.literal(1),
  quoteId: identifierSchema,
  catalogVersion: identifierSchema,
  operationCode: identifierSchema,
  event: renworkCreditEventSchema,
  idempotencyKey: identifierSchema,
  resultKey: identifierSchema,
  amount: z.number().int().positive(),
  status: z.literal("quoted"),
  expiresAt: z.string().datetime(),
  message: z.string().trim().min(1).max(240),
})
export type RenworkCreditQuote = z.infer<typeof renworkCreditQuoteSchema>

export const renworkCreditReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  receiptId: identifierSchema,
  quoteId: identifierSchema,
  walletId: identifierSchema,
  operationCode: identifierSchema,
  idempotencyKey: identifierSchema,
  resultKey: identifierSchema,
  state: z.enum(["reserved", "captured", "released"]),
  amount: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  releaseReason: z.enum(["user_canceled", "no_result", "upstream_failure", "timeout", "privacy_stop"]).nullable(),
}).superRefine((receipt, context) => {
  if (receipt.state === "released" && receipt.releaseReason === null) {
    context.addIssue({ code: "custom", message: "A released reservation requires a reason", path: ["releaseReason"] })
  }
  if (receipt.state !== "released" && receipt.releaseReason !== null) {
    context.addIssue({ code: "custom", message: "Only a released reservation can carry a release reason", path: ["releaseReason"] })
  }
})
export type RenworkCreditReceipt = z.infer<typeof renworkCreditReceiptSchema>
