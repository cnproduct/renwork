import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { getInferenceStatus, setInferenceEnabled } from "../../inference.js"
import { getOrCreateRenCreditWallet, listMemberRenCreditTaskReceipts, listRenCreditLedger } from "../../rencredit-ledger.js"
import { resolveRenworkModelAccess } from "../../renwork-access.js"
import { jsonValidator, orgRoleRoute } from "../../middleware/index.js"
import { forbiddenSchema, invalidRequestSchema, jsonResponse, unauthorizedSchema } from "../../openapi.js"
import type { OrgRouteVariables } from "./shared.js"
import { ensureOrganizationAdmin, orgAccessFailureStatus } from "./shared.js"
import { getRenworkSubscriptionRequest } from "../../renwork-subscription-request.js"

const inferenceSettingsSchema = z.object({
  enabled: z.boolean(),
  tier: z.enum(["tier1", "tier2"]).optional(),
})

const inferenceUsageBucketSchema = z.object({
  windowType: z.enum(["five_hour", "weekly", "monthly"]),
  windowStartAt: z.string(),
  windowEndAt: z.string(),
  limitAmount: z.number(),
  usedAmount: z.number(),
})

const inferenceStatusSchema = z.object({
  enabled: z.boolean(),
  tier: z.enum(["tier1", "tier2"]),
  memberCount: z.number(),
  proxyBaseUrl: z.string(),
  upstreamProviderConfigured: z.boolean(),
  subscribed: z.boolean().optional(),
  subscriptionRequest: z.object({
    id: z.string(),
    status: z.literal("pending"),
    catalogVersion: z.string(),
    planId: z.string(),
    offerId: z.string(),
    requestedBy: z.string(),
    requestedAt: z.string(),
  }).nullable().optional(),
  buckets: z.array(inferenceUsageBucketSchema),
}).meta({ ref: "InferenceStatus" })

const inferenceStatusResponseSchema = z.object({
  inference: inferenceStatusSchema,
}).meta({ ref: "InferenceStatusResponse" })

const inferenceProviderMissingSchema = z.object({
  error: z.literal("openrouter_management_api_key_missing"),
  message: z.string(),
}).meta({ ref: "InferenceProviderMissingError" })

const renCreditTokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
})

const renCreditTaskReceiptSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  model_sku: z.string(),
  billing_mode: z.enum(["token_metered", "free"]),
  status: z.enum(["reserved", "captured", "released"]),
  reserved_microcredits: z.number().int().nonnegative(),
  captured_microcredits: z.number().int().nonnegative(),
  released_microcredits: z.number().int().nonnegative(),
  actual_usage: renCreditTokenUsageSchema.nullable(),
  has_result: z.boolean(),
  created_at: z.string(),
  settled_at: z.string().nullable(),
})

const renCreditLedgerRecordSchema = z.object({
  id: z.string(),
  reservation_id: z.string().nullable(),
  entry_type: z.enum(["grant", "reserve", "capture", "release", "refund", "adjustment"]),
  amount_microcredits: z.number().int(),
  available_delta_microcredits: z.number().int(),
  reserved_delta_microcredits: z.number().int(),
  available_balance_after: z.number().int(),
  reserved_balance_after: z.number().int().nonnegative(),
  wallet_version_after: z.number().int().nonnegative(),
  reason_code: z.string(),
  created_at: z.string(),
})

export function registerOrgInferenceRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.get(
    "/v1/rencredit/wallet",
    orgRoleRoute(["member"]),
    async (c) => {
      const payload = c.get("organizationContext")
      const wallet = await getOrCreateRenCreditWallet(payload.organization.id)
      return c.json({
        ok: true,
        wallet,
      })
    },
  )

  app.get(
    "/v1/rencredit/receipts",
    describeRoute({
      tags: ["RenCredit"],
      summary: "List the current member's task receipts",
      description: "Returns sanitized RenCredit task receipts scoped to the signed-in member and active organization.",
      responses: {
        200: jsonResponse("Task receipts returned successfully.", z.object({ ok: z.literal(true), receipts: z.array(renCreditTaskReceiptSchema) })),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
      },
    }),
    orgRoleRoute(["member"]),
    async (c) => {
      const payload = c.get("organizationContext")
      const rawLimit = Number(c.req.query("limit") ?? "20")
      const limit = Number.isSafeInteger(rawLimit) ? rawLimit : 20
      const receipts = await listMemberRenCreditTaskReceipts({
        organizationId: payload.organization.id,
        memberId: payload.currentMember.id,
        limit,
      })
      return c.json({ ok: true as const, receipts })
    },
  )

  app.get(
    "/v1/rencredit/ledger",
    describeRoute({
      tags: ["RenCredit"],
      summary: "List the organization RenCredit ledger",
      description: "Returns sanitized append-only wallet movements for workspace administrators.",
      responses: {
        200: jsonResponse("Ledger entries returned successfully.", z.object({ ok: z.literal(true), entries: z.array(renCreditLedgerRecordSchema) })),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can inspect the organization ledger.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const payload = c.get("organizationContext")
      const rawLimit = Number(c.req.query("limit") ?? "50")
      const limit = Number.isSafeInteger(rawLimit) ? rawLimit : 50
      const entries = await listRenCreditLedger(payload.organization.id, limit)
      return c.json({ ok: true, entries })
    },
  )

  app.get(
    "/v1/inference",
    describeRoute({
      tags: ["Inference"],
      summary: "Get inference settings",
      description: "Returns RenWork Models enablement and limit context for the active organization.",
      responses: {
        200: jsonResponse("Inference settings returned successfully.", inferenceStatusResponseSchema),
        401: jsonResponse("The caller must be signed in to read inference settings.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can read inference settings.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    async (c) => {
      const payload = c.get("organizationContext")
      const access = await resolveRenworkModelAccess({
        organizationId: payload.organization.id,
        metadata: payload.organization.metadata,
      })
      return c.json({
        inference: {
          ...await getInferenceStatus(payload.organization.id),
          subscribed: access.allowed,
          subscriptionRequest: await getRenworkSubscriptionRequest(payload.organization.id),
        },
      })
    },
  )

  app.patch(
    "/v1/inference",
    describeRoute({
      tags: ["Inference"],
      summary: "Update inference settings",
      description: "Enables or disables RenWork Models for the active organization.",
      responses: {
        200: jsonResponse("Inference settings updated successfully.", inferenceStatusResponseSchema),
        400: jsonResponse("The inference settings request was invalid.", z.union([invalidRequestSchema, inferenceProviderMissingSchema])),
        401: jsonResponse("The caller must be signed in to update inference settings.", unauthorizedSchema),
        403: jsonResponse("Only workspace owners and admins can update inference settings.", forbiddenSchema),
      },
    }),
    orgRoleRoute(["admin"]),
    jsonValidator(inferenceSettingsSchema),
    async (c) => {
      const permission = ensureOrganizationAdmin(c, "Only workspace owners and admins can update inference settings.")
      if (!permission.ok) {
        return c.json(permission.response, orgAccessFailureStatus(permission.response))
      }

      const payload = c.get("organizationContext")
      const input = c.req.valid("json")

      if (input.enabled) {
        const access = await resolveRenworkModelAccess({
          organizationId: payload.organization.id,
          metadata: payload.organization.metadata,
        })
        if (!access.allowed) {
          return c.json({
            inference: {
              ...await getInferenceStatus(payload.organization.id),
              subscribed: false,
            },
          })
        }
      }

      try {
        const inference = await setInferenceEnabled({
          organizationId: payload.organization.id,
          enabled: input.enabled,
          tier: input.tier,
        })
        const access = await resolveRenworkModelAccess({
          organizationId: payload.organization.id,
          metadata: payload.organization.metadata,
        })
        return c.json({ inference: { ...inference, subscribed: access.allowed } })
      } catch (error) {
        if (error instanceof Error && error.message === "openrouter_management_api_key_missing") {
          return c.json({
            error: "openrouter_management_api_key_missing",
            message: "Set OPENROUTER_MANAGEMENT_API_KEY on Den API before enabling RenWork Models.",
          }, 400)
        }
        throw error
      }
    },
  )
}
