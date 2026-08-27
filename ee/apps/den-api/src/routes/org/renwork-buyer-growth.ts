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
import { env } from "../../env.js"
import { orgMemberRoute } from "../../middleware/index.js"
import { jsonResponse, unauthorizedSchema } from "../../openapi.js"
import { HunterBuyerSearchService } from "../../renwork-growth/hunter-buyer-search-service.js"
import { resolveHunterProviderAccess } from "../../renwork-growth/providers/hunter-configuration.js"
import { HunterProviderError, HunterRestAdapter } from "../../renwork-growth/providers/hunter.js"
import type { OrgRouteVariables } from "./shared.js"

const invalidRequestSchema = z.object({
  error: z.literal("invalid_request"),
  message: z.string(),
}).meta({ ref: "RenworkBuyerGrowthInvalidRequest" })

const gatewayUnavailableResponseSchema = renworkBuyerGatewayUnavailableSchema.meta({
  ref: "RenworkBuyerGatewayUnavailable",
})

function gatewayUnavailable(message = "RenWork 买家数据服务尚未启用。管理员完成数据服务授权与云端配置后再试。"): RenworkBuyerGatewayUnavailable {
  return {
    error: "provider_gateway_unavailable",
    message,
  }
}

let hunterSearchService: HunterBuyerSearchService | null = null

function resolveHunterSearchService(organizationId: string): HunterBuyerSearchService | RenworkBuyerGatewayUnavailable {
  const config = env.renworkBuyerProvider
  const access = resolveHunterProviderAccess({
    mode: config.mode,
    apiKey: config.hunterApiKey,
    identitySecret: env.dbEncryptionKey,
    allowedOrganizationId: config.hunterAllowedOrganizationId,
    officialPoolLicensed: config.hunterOfficialPoolLicensed,
  }, organizationId)
  if (!access.enabled) {
    if (access.reason === "credentials_missing") {
      return gatewayUnavailable("RenWork 买家数据服务尚未完成服务端凭据配置。请联系管理员后重试。")
    }
    if (access.reason === "organization_not_authorized") {
      return gatewayUnavailable("当前企业尚未获得该买家数据服务授权。请联系管理员确认企业授权范围。")
    }
    if (access.reason === "license_unavailable") {
      return gatewayUnavailable("RenWork 官方买家数据服务的商业授权尚未启用。")
    }
    return gatewayUnavailable()
  }
  if (!hunterSearchService) {
    hunterSearchService = new HunterBuyerSearchService(
      new HunterRestAdapter({ apiKey: access.apiKey }),
      access.identitySecret,
    )
  }
  return hunterSearchService
}

function isGatewayUnavailable(
  value: HunterBuyerSearchService | RenworkBuyerGatewayUnavailable,
): value is RenworkBuyerGatewayUnavailable {
  return "error" in value
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
        429: jsonResponse("The buyer data service is rate or usage limited.", gatewayUnavailableResponseSchema),
        451: jsonResponse("The requested data is unavailable for privacy or legal reasons.", gatewayUnavailableResponseSchema),
        502: jsonResponse("The upstream buyer data service returned an invalid response.", gatewayUnavailableResponseSchema),
        503: jsonResponse("The buyer data gateway is not configured.", gatewayUnavailableResponseSchema),
        504: jsonResponse("The upstream buyer data service timed out.", gatewayUnavailableResponseSchema),
      },
    }),
    orgMemberRoute(),
    async (c) => {
      const parsed = renworkBuyerSearchRequestSchema.safeParse(await c.req.json().catch(() => null))
      if (!parsed.success) {
        return c.json({ error: "invalid_request", message: "产品、目标市场、客户类型与 Workspace 均为必填项。" }, 400)
      }
      const organizationId = c.get("organizationContext").organization.id
      const service = resolveHunterSearchService(organizationId)
      if (isGatewayUnavailable(service)) return c.json(service, 503)
      try {
        return c.json(await service.search({ organizationId, request: parsed.data }))
      } catch (error) {
        if (!(error instanceof HunterProviderError)) throw error
        if (error.code === "rate_limited" || error.code === "usage_limit") {
          if (error.retryAfterSeconds !== null) c.header("Retry-After", String(error.retryAfterSeconds))
          return c.json(gatewayUnavailable("买家数据服务当前请求较多或上游额度不足，本次未产生 RenCredit 扣费。"), 429)
        }
        if (error.code === "privacy_stop") {
          return c.json(gatewayUnavailable("该数据受隐私或法律限制，RenWork 已停止处理，本次不扣费。"), 451)
        }
        if (error.code === "timeout") {
          return c.json(gatewayUnavailable("买家数据服务响应超时，本次不扣费，请稍后重试。"), 504)
        }
        if (error.code === "authentication_failed") {
          return c.json(gatewayUnavailable("买家数据服务的服务端授权已失效，请联系管理员更新。"), 503)
        }
        return c.json(gatewayUnavailable("买家数据服务暂时无法返回可验证结果，本次不扣费。"), 502)
      }
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
      return c.json(gatewayUnavailable("联系人报价与扣费账本尚未完成生产配置，本次未产生任何扣费。"), 503)
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
      return c.json(gatewayUnavailable("联系人解锁交易链路尚未完成生产配置，本次未产生任何扣费。"), 503)
    },
  )
}
