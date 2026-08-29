import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { getCloudWorkerBillingStatus } from "../../billing/polar.js"
import { createInferenceCheckoutSession, createInferencePortalSession, createSeatCheckoutSession, getOrgBillingSummary, syncSeatCheckoutSession } from "../../stripe-billing.js"
import { orgRoleRoute } from "../../middleware/index.js"
import { forbiddenSchema, jsonResponse, unauthorizedSchema } from "../../openapi.js"
import { getRequiredUserEmail } from "../../user.js"
import { env } from "../../env.js"
import { ORGANIZATION_SUPER_ADMIN_ROLE, organizationRoleValueSatisfies } from "../../organization-role-hierarchy.js"
import type { OrgRouteVariables } from "./shared.js"
import { ensureOrganizationAdmin, ensureOrganizationSuperAdmin, orgAccessFailureStatus } from "./shared.js"
import { createRenworkSubscriptionRequest } from "../../renwork-subscription-request.js"

const stripeBillingResponseSchema = z.object({}).passthrough().meta({ ref: "OrgStripeBillingResponse" })
const stripeCheckoutRequestSchema = z.object({ type: z.enum(["inference", "seat"]).optional() })
const stripeCheckoutResponseSchema = z.object({ url: z.string() }).meta({ ref: "OrgStripeCheckoutResponse" })
const stripeCheckoutSyncRequestSchema = z.object({ sessionId: z.string().trim().min(1) })
const stripeCheckoutSyncResponseSchema = z.object({ synced: z.boolean() }).meta({ ref: "OrgStripeCheckoutSyncResponse" })
const stripePortalResponseSchema = z.object({ url: z.string() }).meta({ ref: "OrgStripePortalResponse" })
const renworkAccessRequestSchema = z.object({ offerId: z.string().trim().min(1).max(160) })
const renworkAccessRequestResponseSchema = z.object({
  ok: z.literal(true),
  created: z.boolean(),
  request: z.object({
    id: z.string(),
    status: z.literal("pending"),
    catalogVersion: z.string(),
    planId: z.string(),
    offerId: z.string(),
    requestedBy: z.string(),
    requestedAt: z.string(),
  }),
})

function getRequestOrigin(c: { req: { raw: Request } }) {
  const url = new URL(c.req.raw.url)
  const forwardedProto = c.req.raw.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = c.req.raw.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  if (forwardedHost) {
    return `${forwardedProto || url.protocol.replace(/:$/, "")}://${forwardedHost}`
  }
  return `${url.protocol}//${url.host}`
}

function billingReturnUrl(c: { req: { raw: Request } }) {
  return `${getRequestOrigin(c)}/dashboard/billing`
}

function checkoutSuccessUrl(c: { req: { raw: Request } }) {
  // `return=models` sends the user back to the RenWork Models page after a
  // successful inference checkout — that's where they subscribed from and
  // where the unlocked value (the model lineup) is visible. The billing page
  // remains the status/portal view.
  return env.stripe.billingSuccessUrl ?? `${getRequestOrigin(c)}/dashboard/billing/stripe/checking?session_id={CHECKOUT_SESSION_ID}&return=models`
}

function appendSeatCheckoutParams(input: string) {
  const separator = input.includes("?") ? "&" : "?"
  const sessionParam = input.includes("session_id=") ? "" : "&session_id={CHECKOUT_SESSION_ID}"
  return `${input}${separator}stripe_checkout=seat${sessionParam}`
}

function seatCheckoutReturnUrl(c: { req: { raw: Request } }) {
  const configured = env.stripe.billingSuccessUrl ?? env.stripe.billingCancelUrl
  if (!configured) {
    return billingReturnUrl(c)
  }

  try {
    const url = new URL(configured, getRequestOrigin(c))
    if (url.pathname.includes("/dashboard/billing")) {
      url.pathname = "/dashboard/billing"
    }
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return billingReturnUrl(c)
  }
}

function seatCheckoutSuccessUrl(c: { req: { raw: Request } }) {
  return appendSeatCheckoutParams(seatCheckoutReturnUrl(c))
}

function checkoutCancelUrl(c: { req: { raw: Request } }) {
  return env.stripe.billingCancelUrl ?? billingReturnUrl(c)
}

export function registerOrgBillingRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.post(
    "/v1/renwork/commerce/access-requests",
    describeRoute({
      tags: ["RenWork Commerce"],
      summary: "Request a RenWork subscription plan",
      description: "Persists an organization plan request for platform-super-admin review without claiming that payment has completed.",
      responses: {
        200: jsonResponse("An existing matching request was returned.", renworkAccessRequestResponseSchema),
        201: jsonResponse("The subscription request was created.", renworkAccessRequestResponseSchema),
        400: jsonResponse("The selected offer cannot be requested.", stripeBillingResponseSchema),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can request a plan.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const permission = ensureOrganizationAdmin(c, "Only workspace owners and admins can request a RenWork plan.")
      if (!permission.ok) return c.json(permission.response, orgAccessFailureStatus(permission.response))

      const parsed = renworkAccessRequestSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) return c.json({ error: "invalid_request", message: "Select a valid RenWork plan offer." }, 400)

      const payload = c.get("organizationContext")
      const result = await createRenworkSubscriptionRequest({
        organizationId: payload.organization.id,
        requestedBy: c.get("user").id,
        offerId: parsed.data.offerId,
      })
      if (!result.ok) {
        const status = result.reason === "organization_not_found" ? 404 : 400
        return c.json({ error: result.reason, message: result.reason === "organization_not_found" ? "Organization not found." : "This RenWork offer is not available for access requests." }, status)
      }
      return c.json({ ok: true as const, created: result.created, request: result.request }, result.created ? 201 : 200)
    },
  )

  app.get(
    "/v1/billing",
    describeRoute({
      tags: ["Organizations"],
      hide: true,
      summary: "Get organization billing status",
      responses: {
        200: jsonResponse("Organization billing status returned successfully.", stripeBillingResponseSchema),
        401: jsonResponse("The caller must be signed in to read billing settings.", unauthorizedSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const user = c.get("user")
      const payload = c.get("organizationContext")
      const email = getRequiredUserEmail(user)
      const canManageBilling = organizationRoleValueSatisfies({
        roleValue: payload.currentMember.role,
        requiredRole: ORGANIZATION_SUPER_ADMIN_ROLE,
        isOwner: payload.currentMember.isOwner,
      })
      const billing = await getOrgBillingSummary({
        organizationId: payload.organization.id,
        includePortalUrl: canManageBilling,
        returnUrl: billingReturnUrl(c),
      })
      const polar = email
        ? await getCloudWorkerBillingStatus({
            userId: user.id,
            email,
            name: user.name ?? email,
          }, {
            includePortalUrl: canManageBilling,
            includeInvoices: false,
          }).catch(() => null)
        : null

      return c.json({ billing: { ...billing, polar } })
    },
  )

  app.post(
    "/v1/billing/stripe/checkout",
    describeRoute({
      tags: ["Organizations"],
      hide: true,
      summary: "Create Stripe Checkout session for RenWork Models",
      responses: {
        200: jsonResponse("Stripe Checkout session created successfully.", stripeCheckoutResponseSchema),
        401: jsonResponse("The caller must be signed in to start billing.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can start billing.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const permission = ensureOrganizationAdmin(c, "Only workspace owners and admins can start billing.")
      if (!permission.ok) {
        return c.json(permission.response, orgAccessFailureStatus(permission.response))
      }
      const user = c.get("user")
      const email = getRequiredUserEmail(user)
      if (!email) {
        return c.json({ error: "user_email_required" }, 400)
      }
      const body = await c.req.json().catch(() => ({}))
      const parsed = stripeCheckoutRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: "invalid_request", details: parsed.error }, 400)
      }
      const payload = c.get("organizationContext")
      const subscriptionType = parsed.data.type ?? "inference"
      const createCheckoutSession = subscriptionType === "seat" ? createSeatCheckoutSession : createInferenceCheckoutSession
      try {
        const session = await createCheckoutSession({
          organizationId: payload.organization.id,
          orgMemberId: payload.currentMember.id,
          email,
          name: user.name ?? email,
          successUrl: subscriptionType === "seat" ? seatCheckoutSuccessUrl(c) : checkoutSuccessUrl(c),
          cancelUrl: checkoutCancelUrl(c),
        })
        return c.json({ url: session.url })
      } catch (error) {
        if (error instanceof Error && ["stripe_secret_key_missing", "stripe_inference_price_id_missing", "stripe_seat_price_id_missing"].includes(error.message)) {
          return c.json({
            error: "subscription_checkout_unavailable",
            message: "Online payment is not configured for this offer. Choose a plan and submit an access request instead.",
          }, 503)
        }
        throw error
      }
    },
  )

  app.post(
    "/v1/billing/stripe/portal",
    describeRoute({
      tags: ["Organizations"],
      hide: true,
      summary: "Create Stripe billing portal session for RenWork Models",
      responses: {
        200: jsonResponse("Stripe billing portal session created successfully.", stripePortalResponseSchema),
        401: jsonResponse("The caller must be signed in to manage billing.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and super-admins can manage billing.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["super-admin"]),
    async (c) => {
      const permission = ensureOrganizationSuperAdmin(c, "Only workspace owners and super-admins can manage billing.")
      if (!permission.ok) {
        return c.json(permission.response, orgAccessFailureStatus(permission.response))
      }
      const payload = c.get("organizationContext")
      const session = await createInferencePortalSession({
        organizationId: payload.organization.id,
        returnUrl: billingReturnUrl(c),
      })
      return c.json({ url: session.url })
    },
  )

  app.post(
    "/v1/billing/stripe/checkout/sync",
    describeRoute({
      tags: ["Organizations"],
      hide: true,
      summary: "Sync a completed Stripe Checkout session",
      responses: {
        200: jsonResponse("Stripe Checkout session synced successfully.", stripeCheckoutSyncResponseSchema),
        401: jsonResponse("The caller must be signed in to sync billing.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can sync billing.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const permission = ensureOrganizationAdmin(c, "Only workspace owners and admins can sync billing.")
      if (!permission.ok) {
        return c.json(permission.response, orgAccessFailureStatus(permission.response))
      }
      const body = await c.req.json().catch(() => ({}))
      const parsed = stripeCheckoutSyncRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: "invalid_request", details: parsed.error }, 400)
      }
      const payload = c.get("organizationContext")
      const row = await syncSeatCheckoutSession({
        organizationId: payload.organization.id,
        sessionId: parsed.data.sessionId,
      }).catch((error) => {
        if (error instanceof Error && (error.message === "stripe_checkout_session_org_mismatch" || error.message.includes("No such checkout.session"))) {
          return "org_mismatch"
        }
        throw error
      })
      if (row === "org_mismatch") {
        return c.json({ error: "stripe_checkout_session_not_found" }, 404)
      }
      return c.json({ synced: Boolean(row) })
    },
  )
}
