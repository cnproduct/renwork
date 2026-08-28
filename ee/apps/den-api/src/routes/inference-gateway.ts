import { eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable } from "@openwork-ee/den-db/schema"
import {
  EMPTY_TOKEN_USAGE,
  calculateRenCreditMicroCharge,
  findPublishedAdminModel,
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
import {
  authenticateInferenceKey,
  releaseInferenceCredits,
  reserveInferenceCredits,
  settleInferenceCredits,
} from "../rencredit-ledger.js"

type JsonRecord = Record<string, unknown>

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

function extractStreamEvent(event: string) {
  const data = event.split("\n").filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim()).join("")
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
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim()
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
    if (inferenceMetadata?.enabled !== true) {
      return c.json({ error: { code: "INFERENCE_DISABLED", message: "RenWork inference is disabled for this organization." } }, 403)
    }
    const plan = parseOrganizationPlan(organization?.metadata).tier
    const allowedPlans = new Set(model.allowedPlanIds)
    const planAllowed = allowedPlans.size === 0 || allowedPlans.has(plan)
      || plan === "team" && allowedPlans.has("individual")
      || plan === "free" && allowedPlans.has("individual")
    if (!planAllowed) return c.json({ error: { code: "PLAN_UPGRADE_REQUIRED", message: "This model is not included in the current plan." } }, 402)

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
    const runId = c.req.header("X-RenWork-Run-Id")?.trim() || randomUUID()
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
        expiresAt: new Date(Date.now() + 30 * 60_000),
      })
      if (reserved.replayed) {
        return c.json({ error: { code: "IDEMPOTENT_REQUEST_REPLAYED", message: "This inference request was already accepted." } }, 409)
      }
      reservation = reserved.reservation
    } catch (error) {
      const code = error instanceof Error ? error.message : "RENCREDIT_RESERVATION_FAILED"
      const status = code === "INSUFFICIENT_RENCREDIT" || code === "RENCREDIT_WALLET_UNAVAILABLE" ? 402 : 409
      return c.json({ error: { code, message: status === 402 ? "RenCredit balance is insufficient." : "The inference request could not be reserved." } }, status)
    }

    const upstreamBody: JsonRecord = { ...body, model: route.upstreamModelId }
    if (body.stream === true) upstreamBody.stream_options = { ...(isRecord(body.stream_options) ? body.stream_options : {}), include_usage: true }
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
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await reader.read()
          if (next.done) {
            buffer += decoder.decode()
            for (const event of buffer.split(/\n\n/)) {
              const parsed = extractStreamEvent(event)
              if (!parsed) continue
              if (typeof parsed.id === "string") providerResponseId = parsed.id
              if (isRecord(parsed.usage)) { usage = normalizeOpenAiUsage(parsed.usage); usageReported = true }
              hasResult ||= responseHasResult(parsed)
            }
            const finalUsage = usageReported ? usage : estimatedUsage
            await settleInferenceCredits({ reservationId: reservation.id, usage: finalUsage, providerResponseId, accuracy: usageReported ? "reported" : "estimated", hasResult })
            if (buffer) controller.enqueue(new TextEncoder().encode(sanitizeStreamEvent(buffer, model.sku)))
            controller.close()
            return
          }
          const text = decoder.decode(next.value, { stream: true })
          buffer += text
          const events = buffer.split(/\n\n/)
          buffer = events.pop() ?? ""
          for (const event of events) {
            const parsed = extractStreamEvent(event)
            if (!parsed) continue
            if (typeof parsed.id === "string") providerResponseId = parsed.id
            if (isRecord(parsed.usage)) { usage = normalizeOpenAiUsage(parsed.usage); usageReported = true }
            hasResult ||= responseHasResult(parsed)
          }
          const sanitized = events.map((event) => sanitizeStreamEvent(event, model.sku)).join("")
          if (sanitized) controller.enqueue(new TextEncoder().encode(sanitized))
        } catch (error) {
          await releaseInferenceCredits({ reservationId: reservation.id, failureCode: "STREAM_ABORTED" }).catch(() => undefined)
          controller.error(error)
        }
      },
      async cancel() {
        await reader.cancel().catch(() => undefined)
        await releaseInferenceCredits({ reservationId: reservation.id, failureCode: "CLIENT_ABORTED" }).catch(() => undefined)
      },
    })
    return new Response(stream, { status: 200, headers: copySafeUpstreamHeaders(upstream) })
  })
}
