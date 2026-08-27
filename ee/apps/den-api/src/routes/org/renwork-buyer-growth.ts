import {
  renworkBuyerGatewayUnavailableSchema,
  renworkBuyerSearchRequestSchema,
  renworkBuyerSearchResponseSchema,
  renworkBuyerUnlockQuoteRequestSchema,
  renworkBuyerUnlockQuoteResponseSchema,
  renworkBuyerUnlockRequestSchema,
  renworkBuyerUnlockResponseSchema,
  type RenworkBuyerGatewayUnavailable,
} from "@openwork/types/renwork-buyer-growth"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { orgMemberRoute } from "../../middleware/index.js"
import { jsonResponse, unauthorizedSchema } from "../../openapi.js"
import type { OrgRouteVariables } from "./shared.js"

const invalidRequestSchema = z.object({
  error: z.literal("invalid_request"),
  message: z.string(),
}).meta({ ref: "RenworkBuyerGrowthInvalidRequest" })

const gatewayUnavailableResponseSchema = renworkBuyerGatewayUnavailableSchema.meta({
  ref: "RenworkBuyerGatewayUnavailable",
})

function gatewayUnavailable(): RenworkBuyerGatewayUnavailable {
  return {
    error: "provider_gateway_unavailable",
    message: "RenWork 买家数据服务尚未启用。管理员完成数据服务授权与云端配置后再试。",
  }
}

export function registerRenworkBuyerGrowthRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.post(
    "/v1/renwork/buyer-growth/search",
    describeRoute({
      tags: ["RenWork Buyer Growth"],
      summary: "Find prioritized buyer company previews",
      description: "Returns free, evidence-graded company and masked decision-maker previews without exposing supplier routing.",
      responses: {
        200: jsonResponse("Free buyer previews returned successfully.", renworkBuyerSearchResponseSchema),
        400: jsonResponse("The search request is invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
        503: jsonResponse("The buyer data gateway is not configured.", gatewayUnavailableResponseSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const parsed = renworkBuyerSearchRequestSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: "invalid_request", message: "产品、目标市场、客户类型与 Workspace 均为必填项。" }, 400)
      }
      return c.json(gatewayUnavailable(), 503)
    },
  )

  app.post(
    "/v1/renwork/buyer-growth/quote",
    describeRoute({
      tags: ["RenWork Buyer Growth"],
      summary: "Quote a verified contact unlock",
      description: "Returns the authoritative RenCredit quote or an already-unlocked result before any charge is reserved.",
      responses: {
        200: jsonResponse("Unlock quote returned successfully.", renworkBuyerUnlockQuoteResponseSchema),
        400: jsonResponse("The quote request is invalid.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
        503: jsonResponse("The buyer data gateway is not configured.", gatewayUnavailableResponseSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const parsed = renworkBuyerUnlockQuoteRequestSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: "invalid_request", message: "企业、联系人、字段与幂等键不完整。" }, 400)
      }
      return c.json(gatewayUnavailable(), 503)
    },
  )

  app.post(
    "/v1/renwork/buyer-growth/unlock",
    describeRoute({
      tags: ["RenWork Buyer Growth"],
      summary: "Unlock a verified contact after explicit approval",
      description: "Requires explicit approval and returns either one captured successful delivery or a released no-charge receipt.",
      responses: {
        200: jsonResponse("Unlock delivery or release receipt returned successfully.", renworkBuyerUnlockResponseSchema),
        400: jsonResponse("The unlock request is invalid or approval is absent.", invalidRequestSchema),
        401: jsonResponse("The caller must be signed in.", unauthorizedSchema),
        503: jsonResponse("The buyer data gateway is not configured.", gatewayUnavailableResponseSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const parsed = renworkBuyerUnlockRequestSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: "invalid_request", message: "必须明确确认本次解锁，并提交有效报价与幂等键。" }, 400)
      }
      return c.json(gatewayUnavailable(), 503)
    },
  )
}
