import { eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable } from "@openwork-ee/den-db/schema"
import {
  EMPTY_TOKEN_USAGE,
  calculateRenCreditMicroCharge,
  findPublishedAdminModel,
  modelAllowedForPlan,
  normalizeOpenAiUsage,
  validateAdminModelCatalog,
  type RenWorkAdminModelCatalog,
  type RenWorkAdminProvider,
  type RenWorkTokenUsage,
} from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { db } from "../db.js"
import { parseOrganizationPlan } from "../entitlements.js"
import { env } from "../env.js"
import { publicRoute } from "../middleware/index.js"
import { appLogger } from "../observability/logger.js"
import { readOrganizationModelPolicy, resolveMemberMonthlyBudget } from "../organization-model-policy.js"
import { accessAllowsModel, resolveRenworkModelAccess } from "../renwork-access.js"
import {
  authenticateInferenceKey,
  releaseInferenceCredits,
  reserveInferenceCredits,
  settleInferenceCredits,
} from "../rencredit-ledger.js"

type JsonRecord = Record<string, unknown>

const logger = appLogger.child({ component: "inference_gateway" })

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function bearerToken(value: string | undefined) {
  if (!value?.startsWith("Bearer ")) return null
  return value.slice(7).trim() || null
}

function safePositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback
}

export function estimateOpenAiRequestUsage(body: JsonRecord): RenWorkTokenUsage {
  const serializedInput = JSON.stringify({ messages: body.messages ?? [], tools: body.tools ?? [] })
  const inputTokens = Math.max(1, Math.ceil(serializedInput.length / 3))
  const outputBudget = safePositiveInteger(body.max_completion_tokens, safePositiveInteger(body.max_tokens, 4096))
  return {
    inputTokens,
    outputTokens: outputBudget,
    reasoningTokens: outputBudget,
    cacheReadTokens: 0,
    cacheWriteTokens: inputTokens,
  }
}

function providerSecretEnvironmentName(reference: string) {
  if (reference.startsWith("env://")) return reference.slice("env://".length)
  if (reference.startsWith("secret://")) {
    return `RENWORK_SECRET_${reference.slice("secret://".length).replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`
  }
  return null
}

function providerCredential(provider: RenWorkAdminProvider) {
  if (!provider.credentialRef) return null
  const environmentName = providerSecretEnvironmentName(provider.credentialRef)
  return environmentName ? process.env[environmentName]?.trim() || null : null
}

function chatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "")
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`
}

async function loadProductionCatalog() {
  const config = env.modelCatalogAdmin
  if (!config.baseUrl || !config.token) throw new Error("MODEL_CATALOG_ADMIN_NOT_CONFIGURED")
  const response = await fetch(`${config.baseUrl}/v1/admin/models/catalog`, {
    headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`MODEL_CATALOG_UNAVAILABLE:${response.status}`)
  const catalog = await response.json() as RenWorkAdminModelCatalog
  validateAdminModelCatalog(catalog)
  if (catalog.status !== "active") throw new Error("MODEL_CATALOG_NOT_ACTIVE")
  return catalog
}

function streamEventData(event: string) {
  return event.split("\n").filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim()).join("")
}

function extractStreamEvent(event: string) {
  const data = streamEventData(event)
  if (!data || data === "[DONE]") return null
  try {
    const parsed = JSON.parse(data) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function sanitizeStreamEvent(event: string, modelSku: string) {
  const trimmed = event.trim()
  if (!trimmed) return ""
  if (streamEventData(event) === "[DONE]") return ""
  const parsed = extractStreamEvent(event)
  if (!parsed) return `${event}\n\n`
  return `data: ${JSON.stringify({ ...parsed, model: modelSku })}\n\n`
}

function responseHasResult(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  return choices.some((choice) => isRecord(choice) && (
    isRecord(choice.message) && (
      typeof choice.message.content === "string" && choice.message.content.length > 0
      || Array.isArray(choice.message.tool_calls) && choice.message.tool_calls.length > 0
    )
    || isRecord(choice.delta) && (
      typeof choice.delta.content === "string" && choice.delta.content.length > 0
      || Array.isArray(choice.delta.tool_calls) && choice.delta.tool_calls.length > 0
    )
  ))
}

function copySafeUpstreamHeaders(upstream: Response) {
  const headers = new Headers()
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/json")
  headers.set("cache-control", "no-store")
  const requestId = upstream.headers.get("x-request-id")
  if (requestId) headers.set("x-renwork-provider-request-id", requestId)
  return headers
}

function safeUpstreamErrorDetails(raw: string) {
  const fallback = raw.trim().slice(0, 1_000)
  if (!fallback) return { providerErrorCode: null, providerErrorMessage: null }
  try {
    const parsed = JSON.parse(fallback) as unknown
    if (!isRecord(parsed)) return { providerErrorCode: null, providerErrorMessage: fallback }
    const error = isRecord(parsed.error) ? parsed.error : parsed
    return {
      providerErrorCode: typeof error.code === "string" ? error.code.slice(0, 160) : null,
      providerErrorMessage: typeof error.message === "string" ? error.message.slice(0, 1_000) : fallback,
    }
  } catch {
    return { providerErrorCode: null, providerErrorMessage: fallback }
  }
}

function summarizeToolSchemas(body: JsonRecord) {
  const tools = Array.isArray(body.tools) ? body.tools : []
  return tools.map((tool) => {
    if (!isRecord(tool)) return { name: null, parametersType: typeof tool, suspiciousKeys: [] as string[] }
    const definition = isRecord(tool.function) ? tool.function : null
    const parameters = definition && isRecord(definition.parameters) ? definition.parameters : null
    const suspiciousKeys = parameters
      ? Object.keys(parameters).filter((key) => key.startsWith("_") || ["def", "shape", "parse", "safeParse"].includes(key)).slice(0, 8)
      : []
    return {
      name: definition && typeof definition.name === "string" ? definition.name.slice(0, 160) : null,
      parametersType: parameters && typeof parameters.type === "string" ? parameters.type : parameters ? "object" : "missing",
      suspiciousKeys,
    }
  })
}

function buildUpstreamBody(body: JsonRecord, upstreamModelId: string) {
  const upstreamBody: JsonRecord = { ...body, model: upstreamModelId }
  // OpenCode includes a local response-usage accumulator on requests. It is
  // not part of the OpenAI Chat Completions request schema and strict relays
  // such as OpenCode Go reject the whole request when it is forwarded.
  delete upstreamBody.usage
  if (body.stream === true) {
    upstreamBody.stream_options = {
      ...(isRecord(body.stream_options) ? body.stream_options : {}),
      include_usage: true,
    }
  }
  return upstreamBody
}

export function registerInferenceGatewayRoutes<T extends { Variables: Record<string, unknown> }>(app: Hono<T>) {
  app.post("/api/v1/chat/completions", publicRoute, async (c) => {
    const apiKey = bearerToken(c.req.header("Authorization"))
    if (!apiKey) return c.json({ error: { code: "UNAUTHORIZED", message: "A RenWork inference key is required." } }, 401)
    const principal = await authenticateInferenceKey(apiKey)
    if (!principal) return c.json({ error: { code: "UNAUTHORIZED", message: "The RenWork inference key is invalid or revoked." } }, 401)

    const body = await c.req.json().catch(() => null)
    if (!isRecord(body) || typeof body.model !== "string") {
      return c.json({ error: { code: "VALIDATION_FAILED", message: "model and a valid JSON request body are required." } }, 400)
    }
    const explicitIdempotencyKey = c.req.header("Idempotency-Key")?.trim()
    const desktopClient = c.req.header("X-RenWork-Client")?.trim().toLowerCase() === "desktop"
    const runId = c.req.header("X-RenWork-Run-Id")?.trim() || randomUUID()
    const idempotencyKey = explicitIdempotencyKey || (desktopClient
      ? `desktop:${principal.inferenceKeyId}:${runId}`
      : null)
    if (!idempotencyKey) {
      return c.json({ error: { code: "IDEMPOTENCY_KEY_REQUIRED", message: "Idempotency-Key is required for metered inference." } }, 400)
    }

    let catalog: RenWorkAdminModelCatalog
    try {
      catalog = await loadProductionCatalog()
    } catch {
      return c.json({ error: { code: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model routing is temporarily unavailable." } }, 503)
    }

    let model
    try {
      model = findPublishedAdminModel(catalog, body.model)
    } catch {
      return c.json({ error: { code: "MODEL_NOT_AVAILABLE", message: "The selected RenWork model is not available." } }, 404)
    }
    const [organization] = await db.select({ metadata: OrganizationTable.metadata }).from(OrganizationTable)
      .where(eq(OrganizationTable.id, principal.organizationId)).limit(1)
    const inferenceMetadata = isRecord(organization?.metadata?.inference) ? organization.metadata.inference : null
    const access = await resolveRenworkModelAccess({
      organizationId: principal.organizationId,
      metadata: organization?.metadata,
    })
    if (!access.allowed) {
      return c.json({ error: { code: "SUBSCRIPTION_REQUIRED", message: "An active RenWork subscription or temporary access grant is required." } }, 402)
    }
    if (access.source === "subscription" && inferenceMetadata?.enabled !== true) {
      return c.json({ error: { code: "INFERENCE_DISABLED", message: "RenWork inference is disabled for this organization." } }, 403)
    }
    if (!accessAllowsModel(access, model.sku)) {
      return c.json({ error: { code: "MODEL_NOT_INCLUDED_IN_GRANT", message: "This model is not included in the temporary access grant." } }, 403)
    }
    const plan = parseOrganizationPlan(organization?.metadata).tier
    if (access.source === "subscription" && !modelAllowedForPlan(model, plan)) {
      return c.json({ error: { code: "PLAN_UPGRADE_REQUIRED", message: "This model is not included in the current plan." } }, 402)
    }
    const modelPolicy = readOrganizationModelPolicy(organization?.metadata)
    if (modelPolicy.allowedModelSkus && !modelPolicy.allowedModelSkus.includes(model.sku)) {
      return c.json({ error: { code: "MODEL_NOT_ALLOWED_BY_ORGANIZATION", message: "This model is not enabled by the organization owner." } }, 403)
    }

    const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]))
    const route = model.routes.filter((candidate) => candidate.enabled)
      .filter((candidate) => {
        const provider = providers.get(candidate.providerId)
        return provider?.enabled && provider.health !== "offline" && ["openai_compatible", "opencode"].includes(provider.protocol)
      }).sort((left, right) => left.priority - right.priority)[0]
    const provider = route ? providers.get(route.providerId) : null
    if (!route || !provider?.baseUrl) {
      return c.json({ error: { code: "MODEL_ROUTE_UNAVAILABLE", message: "No healthy RenWork route is available for this model." } }, 503)
    }
    const credential = providerCredential(provider)
    if (provider.credentialRef && !credential) {
      return c.json({ error: { code: "MODEL_ROUTE_UNAVAILABLE", message: "The selected RenWork route is not configured." } }, 503)
    }

    const estimatedUsage = estimateOpenAiRequestUsage(body)
    const billingMode = catalog.billingPolicy[route.source]
    const reservedMicroCredits = billingMode === "free" ? 0 : calculateRenCreditMicroCharge(estimatedUsage, model)
    let reservation
    try {
      const reserved = await reserveInferenceCredits({
        ...principal,
        runId,
        idempotencyKey,
        catalogVersion: catalog.version,
        model,
        route,
        providerId: provider.id,
        billingMode,
        estimatedUsage,
        reservedMicroCredits,
        budgets: {
          organizationDailyMicroCredits: modelPolicy.dailyBudgetMicroCredits,
          organizationMonthlyMicroCredits: modelPolicy.monthlyBudgetMicroCredits,
          memberMonthlyMicroCredits: resolveMemberMonthlyBudget(modelPolicy, principal.memberId),
        },
        expiresAt: new Date(Date.now() + 30 * 60_000),
      })
      if (reserved.replayed) {
        return c.json({ error: { code: "IDEMPOTENT_REQUEST_REPLAYED", message: "This inference request was already accepted." } }, 409)
      }
      reservation = reserved.reservation
    } catch (error) {
      const code = error instanceof Error ? error.message : "RENCREDIT_RESERVATION_FAILED"
      const paymentRequiredCodes = new Set([
        "INSUFFICIENT_RENCREDIT",
        "RENCREDIT_WALLET_UNAVAILABLE",
        "ORGANIZATION_DAILY_BUDGET_EXCEEDED",
        "ORGANIZATION_MONTHLY_BUDGET_EXCEEDED",
        "MEMBER_MONTHLY_QUOTA_EXCEEDED",
      ])
      const status = paymentRequiredCodes.has(code) ? 402 : 409
      const message = code === "INSUFFICIENT_RENCREDIT" || code === "RENCREDIT_WALLET_UNAVAILABLE"
        ? "RenCredit balance is insufficient."
        : status === 402
          ? "The organization RenCredit budget or member quota has been reached."
          : "The inference request could not be reserved."
      return c.json({ error: { code, message } }, status)
    }

    const upstreamBody = buildUpstreamBody(body, route.upstreamModelId)
    const headers = new Headers({ "content-type": "application/json", accept: body.stream === true ? "text/event-stream" : "application/json" })
    if (credential) headers.set("authorization", `Bearer ${credential}`)

    let upstream: Response
    try {
      upstream = await fetch(chatCompletionsUrl(provider.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
        signal: c.req.raw.signal,
      })
    } catch {
      await releaseInferenceCredits({ reservationId: reservation.id, failureCode: "UPSTREAM_NETWORK_ERROR" })
      return c.json({ error: { code: "UPSTREAM_UNAVAILABLE", message: "The RenWork model route is temporarily unavailable." } }, 502)
    }
    if (!upstream.ok) {
      const upstreamError = await upstream.text().catch(() => "")
      logger.warn("RenWork upstream inference rejected request", {
        organization_id: principal.organizationId,
        member_id: principal.memberId,
        provider_id: provider.id,
        route_id: route.id,
        model_sku: model.sku,
        upstream_model_id: route.upstreamModelId,
        upstream_status: upstream.status,
        request_keys: Object.keys(upstreamBody).sort(),
        tools: summarizeToolSchemas(upstreamBody),
        ...safeUpstreamErrorDetails(upstreamError),
      })
      await releaseInferenceCredits({ reservationId: reservation.id, failureCode: `UPSTREAM_HTTP_${upstream.status}` })
      return c.json({ error: { code: "UPSTREAM_ERROR", message: "The RenWork model route could not complete the request." } }, upstream.status >= 500 ? 502 : 400)
    }

    if (body.stream !== true) {
      const payload = await upstream.json().catch(() => null)
      if (!isRecord(payload)) {
        await releaseInferenceCredits({ reservationId: reservation.id, failureCode: "UPSTREAM_INVALID_RESPONSE" })
        return c.json({ error: { code: "UPSTREAM_INVALID_RESPONSE", message: "The RenWork model returned an invalid response." } }, 502)
      }
      const usageReported = isRecord(payload.usage)
      const usage = usageReported ? normalizeOpenAiUsage(payload.usage) : estimatedUsage
      const hasResult = responseHasResult(payload)
      await settleInferenceCredits({
        reservationId: reservation.id,
        usage,
        providerResponseId: typeof payload.id === "string" ? payload.id : `run:${runId}`,
        accuracy: usageReported ? "reported" : "estimated",
        hasResult,
      })
      return new Response(JSON.stringify({ ...payload, model: model.sku }), { status: 200, headers: copySafeUpstreamHeaders(upstream) })
    }

    if (!upstream.body) {
      await releaseInferenceCredits({ reservationId: reservation.id, failureCode: "UPSTREAM_EMPTY_STREAM" })
      return c.json({ error: { code: "UPSTREAM_INVALID_RESPONSE", message: "The RenWork model returned an empty stream." } }, 502)
    }
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let usage = { ...EMPTY_TOKEN_USAGE }
    let usageReported = false
    let providerResponseId = `run:${runId}`
    let hasResult = false
    let finalized = false
    const observeEvent = (event: string) => {
      const parsed = extractStreamEvent(event)
      if (!parsed) return
      if (typeof parsed.id === "string") providerResponseId = parsed.id
      if (isRecord(parsed.usage)) { usage = normalizeOpenAiUsage(parsed.usage); usageReported = true }
      hasResult ||= responseHasResult(parsed)
    }
    const settleOnce = async () => {
      if (finalized) return
      finalized = true
      const finalUsage = usageReported ? usage : estimatedUsage
      await settleInferenceCredits({ reservationId: reservation.id, usage: finalUsage, providerResponseId, accuracy: usageReported ? "reported" : "estimated", hasResult })
    }
    const releaseOnce = async (failureCode: string) => {
      if (finalized) return
      finalized = true
      await releaseInferenceCredits({ reservationId: reservation.id, failureCode })
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            while (true) {
              const next = await reader.read()
              if (next.done) {
                buffer += decoder.decode()
                const finalEvents = buffer.split(/\n\n/)
                for (const event of finalEvents) observeEvent(event)
                const sanitized = finalEvents.map((event) => sanitizeStreamEvent(event, model.sku)).join("")
                if (sanitized) controller.enqueue(new TextEncoder().encode(sanitized))
                await settleOnce()
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
                controller.close()
                return
              }
              buffer += decoder.decode(next.value, { stream: true })
              const events = buffer.split(/\n\n/)
              buffer = events.pop() ?? ""
              for (const event of events) observeEvent(event)
              const sanitized = events.map((event) => sanitizeStreamEvent(event, model.sku)).join("")
              if (sanitized) controller.enqueue(new TextEncoder().encode(sanitized))
            }
          } catch (error) {
            await releaseOnce("STREAM_ABORTED").catch(() => undefined)
            controller.error(error)
          }
        })()
      },
      async cancel() {
        await reader.cancel().catch(() => undefined)
        await releaseOnce("CLIENT_ABORTED").catch(() => undefined)
      },
    })
    return new Response(stream, { status: 200, headers: copySafeUpstreamHeaders(upstream) })
  })
}
