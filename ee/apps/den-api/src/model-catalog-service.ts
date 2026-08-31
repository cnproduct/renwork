import {
  RENWORK_BILLING_MODES,
  RENWORK_MODEL_TIERS,
  RENWORK_PROVIDER_KINDS,
  RENWORK_PROVIDER_PROTOCOLS,
  RENWORK_PROVIDER_AUTH_MODES,
  RENWORK_PROVIDER_CREDENTIAL_STORES,
  RENWORK_PROVIDER_EXECUTION_SCOPES,
  RENWORK_PROVIDER_SHARING_SCOPES,
  RENWORK_ROUTE_SOURCES,
} from "@openwork/rencredit-metering"
import { z } from "zod"
import { env } from "./env.js"

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
  authMode: z.enum(RENWORK_PROVIDER_AUTH_MODES).optional(),
  credentialStore: z.enum(RENWORK_PROVIDER_CREDENTIAL_STORES).optional(),
  executionScope: z.enum(RENWORK_PROVIDER_EXECUTION_SCOPES).optional(),
  sharingScope: z.enum(RENWORK_PROVIDER_SHARING_SCOPES).optional(),
  deviceOAuthPolicy: z.object({
    maxDevicesPerUser: z.number().int().positive(),
    maxConcurrentRunsPerUser: z.number().int().positive(),
  }).nullable().optional(),
  enabled: z.boolean(),
  health: z.enum(["unknown", "healthy", "degraded", "offline"]),
}).transform((provider) => {
  const authMode = provider.authMode ?? (provider.credentialRef ? "service_secret" : "none")
  const personalRuntime = provider.kind === "runtime" || provider.kind === "local"
  return {
    ...provider,
    authMode,
    credentialStore: provider.credentialStore ?? (authMode === "service_secret" ? "server_secret" : authMode === "device_oauth" ? "device_vault" : "none"),
    executionScope: provider.executionScope ?? (personalRuntime ? "personal_device" : "cloud_gateway"),
    sharingScope: provider.sharingScope ?? (personalRuntime ? "user_private" : "organization"),
    deviceOAuthPolicy: provider.deviceOAuthPolicy ?? (authMode === "device_oauth" ? { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 } : null),
  }
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

export const modelCatalogSchema = z.object({
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

export async function requestModelCatalog(path: string, init?: RequestInit) {
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
