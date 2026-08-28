import {
  RENWORK_BILLING_MODES,
  RENWORK_MODEL_TIERS,
  RENWORK_PROVIDER_KINDS,
  RENWORK_PROVIDER_PROTOCOLS,
  RENWORK_ROUTE_SOURCES,
  toPublicModelCatalog,
  validateAdminModelCatalog,
} from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { env } from "../../env.js"
import { adminRoute } from "../../middleware/index.js"
import { forbiddenSchema, jsonResponse, unauthorizedSchema } from "../../openapi.js"
import type { AuthContextVariables } from "../../session.js"

const rateCardSchema = z.object({
  inputMicroCreditsPerMillion: z.number().int().nonnegative(),
  outputMicroCreditsPerMillion: z.number().int().nonnegative(),
  reasoningMicroCreditsPerMillion: z.number().int().nonnegative(),
  cacheReadMicroCreditsPerMillion: z.number().int().nonnegative(),
  cacheWriteMicroCreditsPerMillion: z.number().int().nonnegative(),
})

const providerSchema = z.object({
  id: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  kind: z.enum(RENWORK_PROVIDER_KINDS),
  protocol: z.enum(RENWORK_PROVIDER_PROTOCOLS),
  baseUrl: z.string().url().nullable(),
  credentialRef: z.string().regex(/^(secret|env):\/\/[A-Za-z0-9_./-]+$/).nullable(),
  enabled: z.boolean(),
  health: z.enum(["unknown", "healthy", "degraded", "offline"]),
})

const routeSchema = z.object({
  id: z.string().trim().min(1),
  providerId: z.string().trim().min(1),
  upstreamModelId: z.string().trim().min(1),
  priority: z.number().int().nonnegative(),
  enabled: z.boolean(),
  source: z.enum(RENWORK_ROUTE_SOURCES),
})

const promotionSchema = z.object({
  label: z.string().trim().min(1),
  multiplierBps: z.number().int().min(0).max(10_000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
})

const modelSchema = z.object({
  sku: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  description: z.string(),
  tier: z.enum(RENWORK_MODEL_TIERS),
  status: z.enum(["draft", "published", "paused", "retired"]),
  autoEligible: z.boolean(),
  contextWindow: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  sortOrder: z.number().int().nonnegative(),
  displayMultiplierBps: z.number().int().nonnegative(),
  priceMultiplierBps: z.number().int().nonnegative(),
  rates: rateCardSchema,
  promotion: promotionSchema.nullable(),
  allowedPlanIds: z.array(z.string()),
  routes: z.array(routeSchema),
})

const modelCatalogSchema = z.object({
  version: z.string().trim().min(1),
  status: z.enum(["draft", "active", "retired"]),
  currency: z.literal("REN_CREDIT"),
  billingPolicy: z.object({
    official: z.enum(RENWORK_BILLING_MODES),
    byok: z.enum(RENWORK_BILLING_MODES),
    local: z.enum(RENWORK_BILLING_MODES),
  }),
  updatedAt: z.string().datetime(),
  providers: z.array(providerSchema),
  models: z.array(modelSchema),
})

const updateCatalogSchema = z.object({
  expectedVersion: z.string().trim().min(1),
  catalog: modelCatalogSchema,
})

const adminCatalogResponseSchema = z.object({
  catalog: modelCatalogSchema,
  publicCatalog: z.object({}).passthrough(),
})

const providerTestResponseSchema = z.object({
  ok: z.boolean(),
  providerId: z.string(),
  health: z.enum(["healthy", "degraded", "offline"]),
  statusCode: z.number().int().nullable(),
  latencyMs: z.number().int().nonnegative(),
  message: z.string(),
})

const unavailableSchema = z.object({
  error: z.string(),
  message: z.string(),
})

function catalogAdminConfig() {
  const { baseUrl, token } = env.modelCatalogAdmin
  return baseUrl && token ? { baseUrl, token } : null
}

async function readUpstreamPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { error: "MODEL_CATALOG_INVALID_RESPONSE", message: text.slice(0, 300) }
  }
}

async function requestModelCatalog(path: string, init?: RequestInit) {
  const config = catalogAdminConfig()
  if (!config) {
    return {
      configured: false as const,
      response: null,
      payload: { error: "MODEL_CATALOG_ADMIN_NOT_CONFIGURED", message: "Configure RENWORK_MODEL_CATALOG_BASE_URL and RENWORK_MODEL_CATALOG_ADMIN_TOKEN on Den API." },
    }
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(12_000),
  })
  return { configured: true as const, response, payload: await readUpstreamPayload(response) }
}

export function registerAdminModelCatalogRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get(
    "/v1/admin/model-catalog",
    describeRoute({
      tags: ["Admin"],
      summary: "Get the RenWork global model and RenCredit catalog",
      responses: {
        200: jsonResponse("The private and member-safe model catalogs were returned.", adminCatalogResponseSchema),
        401: jsonResponse("The caller must be authenticated.", unauthorizedSchema),
        403: jsonResponse("The authenticated user is not a platform admin.", forbiddenSchema),
        503: jsonResponse("The model catalog service is not configured or unavailable.", unavailableSchema),
      },
    }),
    adminRoute(),
    async (c) => {
      try {
        const upstream = await requestModelCatalog("/v1/admin/models/catalog")
        if (!upstream.configured) return c.json(upstream.payload, 503)
        if (!upstream.response.ok) {
          return c.json({ error: "MODEL_CATALOG_UPSTREAM_ERROR", message: `Model catalog service returned ${upstream.response.status}.` }, 503)
        }
        const parsed = modelCatalogSchema.safeParse(upstream.payload)
        if (!parsed.success) {
          return c.json({ error: "MODEL_CATALOG_INVALID_RESPONSE", message: "Model catalog service returned an invalid catalog." }, 503)
        }
        validateAdminModelCatalog(parsed.data)
        return c.json({ catalog: parsed.data, publicCatalog: toPublicModelCatalog(parsed.data) })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Model catalog service is unavailable."
        return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message }, 503)
      }
    },
  )

  app.put(
    "/v1/admin/model-catalog",
    describeRoute({
      tags: ["Admin"],
      summary: "Publish the RenWork global model and RenCredit catalog",
      responses: {
        200: jsonResponse("The model catalog was published.", adminCatalogResponseSchema),
        401: jsonResponse("The caller must be authenticated.", unauthorizedSchema),
        403: jsonResponse("The authenticated user is not a platform admin.", forbiddenSchema),
        503: jsonResponse("The model catalog service is not configured or unavailable.", unavailableSchema),
      },
    }),
    adminRoute(),
    async (c) => {
      const body = await c.req.json().catch(() => null)
      const parsedBody = updateCatalogSchema.safeParse(body)
      if (!parsedBody.success) {
        return c.json({ error: "VALIDATION_FAILED", message: parsedBody.error.issues[0]?.message ?? "Invalid model catalog." }, 400)
      }
      try {
        validateAdminModelCatalog(parsedBody.data.catalog)
        const upstream = await requestModelCatalog("/v1/admin/models/catalog", {
          method: "PUT",
          body: JSON.stringify(parsedBody.data),
        })
        if (!upstream.configured) return c.json(upstream.payload, 503)
        if (!upstream.response.ok) {
          const errorPayload = z.object({ error: z.string().optional() }).passthrough().safeParse(upstream.payload)
          const errorCode = errorPayload.success ? errorPayload.data.error : null
          const status = upstream.response.status === 409 ? 409 : 503
          return c.json({ error: errorCode ?? "MODEL_CATALOG_UPSTREAM_ERROR", message: `Model catalog service returned ${upstream.response.status}.` }, status)
        }
        const parsedCatalog = modelCatalogSchema.safeParse(upstream.payload)
        if (!parsedCatalog.success) {
          return c.json({ error: "MODEL_CATALOG_INVALID_RESPONSE", message: "Model catalog service returned an invalid catalog." }, 503)
        }
        return c.json({ catalog: parsedCatalog.data, publicCatalog: toPublicModelCatalog(parsedCatalog.data) })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Model catalog update failed."
        return c.json({ error: "MODEL_CATALOG_UPDATE_FAILED", message }, 503)
      }
    },
  )

  app.post(
    "/v1/admin/model-catalog/providers/:providerId/test",
    describeRoute({
      tags: ["Admin"],
      summary: "Test a private RenWork provider route",
      responses: {
        200: jsonResponse("The provider connectivity result was returned.", providerTestResponseSchema),
        401: jsonResponse("The caller must be authenticated.", unauthorizedSchema),
        403: jsonResponse("The authenticated user is not a platform admin.", forbiddenSchema),
        503: jsonResponse("The model catalog service is not configured or unavailable.", unavailableSchema),
      },
    }),
    adminRoute(),
    async (c) => {
      const providerId = c.req.param("providerId").trim()
      if (!providerId) return c.json({ error: "VALIDATION_FAILED", message: "Provider id is required." }, 400)
      try {
        const upstream = await requestModelCatalog(`/v1/admin/models/providers/${encodeURIComponent(providerId)}/test`, { method: "POST" })
        if (!upstream.configured) return c.json(upstream.payload, 503)
        const parsed = providerTestResponseSchema.safeParse(upstream.payload)
        if (!parsed.success) {
          return c.json({ error: "MODEL_PROVIDER_INVALID_RESPONSE", message: "Provider test returned an invalid response." }, 503)
        }
        return c.json(parsed.data, upstream.response.ok ? 200 : 503)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider test failed."
        return c.json({ error: "MODEL_PROVIDER_TEST_FAILED", message }, 503)
      }
    },
  )
}
