import { calculateRenCreditMicroCharge } from "@openwork/rencredit-metering"
import type { RenWorkTokenUsage } from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { orgRoleRoute } from "../../middleware/index.js"
import { normalizeOrganizationMetadata } from "../../organization-limits.js"
import { modelAllowedForMember, readOrganizationModelPolicy, resolveMemberMonthlyBudget } from "../../organization-model-policy.js"
import { accessAllowsModel, resolveRenworkModelAccess } from "../../renwork-access.js"
import { releaseInferenceCredits, reserveInferenceCredits, settleInferenceCredits } from "../../rencredit-ledger.js"
import { isWeijianSubscriptionCliOrganization, subscriptionCliAccessForMember, subscriptionCliModelForMember } from "../../subscription-cli-policy.js"
import type { OrgRouteVariables } from "./shared.js"
import { ensureOrganizationAdmin, orgAccessFailureStatus } from "./shared.js"

const taskSchema = z.object({
  prompt: z.string().trim().min(1).max(50_000),
  modelSku: z.string().trim().min(1).max(160),
})

const workerUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
})

const workerResultSchema = z.object({
  text: z.string().min(1),
  model: z.literal("gpt-5.6-sol"),
  threadId: z.string().min(1),
  usage: workerUsageSchema,
})

function configuredWorker() {
  const baseUrl = process.env.RENWORK_WEIJIAN_CODEX_WORKER_URL?.trim()
  const token = process.env.RENWORK_WEIJIAN_CODEX_WORKER_TOKEN?.trim()
  if (!baseUrl || !token) return null
  const url = new URL(baseUrl)
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  return { baseUrl: url.toString().replace(/\/$/, ""), token }
}

async function workerRequest(path: string, method: "GET" | "POST", body?: unknown, timeoutMs = 20_000) {
  const worker = configuredWorker()
  if (!worker) throw new Error("CODEX_CLOUD_NOT_CONFIGURED")
  const response = await fetch(`${worker.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${worker.token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error("CODEX_CLOUD_UNAVAILABLE")
  return payload
}

function isWeijian(context: NonNullable<OrgRouteVariables["organizationContext"]>) {
  return isWeijianSubscriptionCliOrganization({
    organizationId: context.organization.id,
    organizationName: context.organization.name,
  })
}

function grantedCloudModel(context: NonNullable<OrgRouteVariables["organizationContext"]>) {
  const metadata = normalizeOrganizationMetadata(context.organization.metadata).metadata
  const policy = subscriptionCliAccessForMember({
    organizationId: context.organization.id,
    organizationName: context.organization.name,
    metadata,
    memberId: context.currentMember.id,
  })
  if (metadata?.inference && (typeof metadata.inference !== "object" || Array.isArray(metadata.inference)
    || (metadata.inference as Record<string, unknown>).enabled !== true)) return null
  return policy?.models.find((item) => item.runtime === "codex" && item.upstreamModelId === "gpt-5.6-sol") ?? null
}

function estimatedUsage(prompt: string): RenWorkTokenUsage {
  return {
    inputTokens: Math.max(1, Math.ceil(prompt.length / 3)),
    outputTokens: 4096,
    reasoningTokens: 4096,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
}

export function registerOrgSubscriptionCodexRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.get("/v1/subscription-codex", orgRoleRoute(["admin"]), async (c) => {
    const context = c.get("organizationContext")
    if (!isWeijian(context)) return c.json({ error: "not_found" }, 404)
    try {
      const status = await workerRequest("/status", "GET")
      if (!status || typeof status !== "object" || Array.isArray(status)) throw new Error("Invalid worker status")
      c.header("Cache-Control", "private, no-store")
      return c.json({ ...status, modelSku: grantedCloudModel(context)?.sku ?? null })
    } catch {
      return c.json({ state: "unavailable" }, 503)
    }
  })

  app.post("/v1/subscription-codex/connect", orgRoleRoute(["admin"]), async (c) => {
    const context = c.get("organizationContext")
    if (!isWeijian(context)) return c.json({ error: "not_found" }, 404)
    const permission = ensureOrganizationAdmin(c, "Only a freshly signed-in organization administrator can connect ChatGPT.")
    if (!permission.ok) return c.json(permission.response, orgAccessFailureStatus(permission.response))
    if (!grantedCloudModel(context)) return c.json({ error: "model_not_granted" }, 403)
    try {
      const status = await workerRequest("/login/start", "POST")
      if (!status || typeof status !== "object" || Array.isArray(status)) throw new Error("Invalid worker status")
      c.header("Cache-Control", "private, no-store")
      return c.json({ ...status, modelSku: grantedCloudModel(context)?.sku ?? null })
    } catch {
      return c.json({ error: "codex_cloud_unavailable" }, 503)
    }
  })

  app.get("/v1/subscription-codex/connect", orgRoleRoute(["admin"]), async (c) => {
    const context = c.get("organizationContext")
    if (!isWeijian(context)) return c.json({ error: "not_found" }, 404)
    try {
      const status = await workerRequest("/login/poll", "GET")
      if (!status || typeof status !== "object" || Array.isArray(status)) throw new Error("Invalid worker status")
      c.header("Cache-Control", "private, no-store")
      return c.json({ ...status, modelSku: grantedCloudModel(context)?.sku ?? null })
    } catch {
      return c.json({ state: "unavailable" }, 503)
    }
  })

  app.delete("/v1/subscription-codex/connect", orgRoleRoute(["admin"]), async (c) => {
    const context = c.get("organizationContext")
    if (!isWeijian(context)) return c.json({ error: "not_found" }, 404)
    const permission = ensureOrganizationAdmin(c, "Only a freshly signed-in organization administrator can disconnect ChatGPT.")
    if (!permission.ok) return c.json(permission.response, orgAccessFailureStatus(permission.response))
    try {
      return c.json(await workerRequest("/disconnect", "POST"))
    } catch {
      return c.json({ error: "codex_cloud_unavailable" }, 503)
    }
  })

  app.post("/v1/subscription-codex/tasks", orgRoleRoute(["member"]), async (c) => {
    const context = c.get("organizationContext")
    if (!isWeijian(context)) return c.json({ error: "not_found" }, 404)
    const metadata = normalizeOrganizationMetadata(context.organization.metadata).metadata
    const parsed = taskSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: "invalid_request" }, 400)
    const { prompt, modelSku } = parsed.data
    const granted = subscriptionCliModelForMember({
      organizationId: context.organization.id,
      organizationName: context.organization.name,
      metadata,
      memberId: context.currentMember.id,
      modelSku,
    })
    if (!granted || granted.model.routes[0]?.upstreamModelId !== "gpt-5.6-sol") {
      return c.json({ error: "model_not_granted" }, 403)
    }
    const access = await resolveRenworkModelAccess({
      organizationId: context.organization.id,
      metadata,
    })
    const organizationPolicy = readOrganizationModelPolicy(metadata)
    const inference = metadata?.inference
    if (access.source === "subscription" && (typeof inference !== "object" || inference === null
      || Array.isArray(inference) || (inference as Record<string, unknown>).enabled !== true)) {
      return c.json({ error: "inference_not_enabled" }, 403)
    }
    if (!access.allowed || !accessAllowsModel(access, modelSku)
      || (organizationPolicy.allowedModelSkus && !organizationPolicy.allowedModelSkus.includes(modelSku))
      || !modelAllowedForMember(organizationPolicy, context.currentMember.id, modelSku)) {
      return c.json({ error: "model_not_granted" }, 403)
    }
    let status: unknown
    try { status = await workerRequest("/status", "GET") } catch { return c.json({ error: "codex_cloud_unavailable" }, 503) }
    if (!status || typeof status !== "object" || !("state" in status) || status.state !== "connected") {
      return c.json({ error: "chatgpt_login_required" }, 409)
    }
    const route = granted.model.routes[0]
    if (!route) return c.json({ error: "model_not_granted" }, 403)
    const runId = randomUUID()
    const estimate = estimatedUsage(prompt)
    let reserved
    try {
      reserved = await reserveInferenceCredits({
        organizationId: context.organization.id,
        memberId: context.currentMember.id,
        inferenceKeyId: null,
        runId,
        idempotencyKey: c.req.header("Idempotency-Key")?.trim() || runId,
        catalogVersion: `subscription-cloud:${context.organization.id}:${modelSku}`,
        model: granted.model,
        route,
        providerId: "codex-subscription-cloud",
        billingMode: "token_metered",
        estimatedUsage: estimate,
        reservedMicroCredits: calculateRenCreditMicroCharge(estimate, granted.model),
        budgets: {
          organizationDailyMicroCredits: organizationPolicy.dailyBudgetMicroCredits,
          organizationMonthlyMicroCredits: organizationPolicy.monthlyBudgetMicroCredits,
          memberMonthlyMicroCredits: resolveMemberMonthlyBudget(organizationPolicy, context.currentMember.id),
        },
        maxConcurrentRunsPerUser: 1,
        expiresAt: new Date(Date.now() + 12 * 60_000),
      })
    } catch (error) {
      const code = error instanceof Error ? error.message : "RENCREDIT_RESERVATION_FAILED"
      return c.json({ error: code }, code === "INSUFFICIENT_RENCREDIT" ? 402 : 409)
    }
    if (reserved.replayed) return c.json({ error: "idempotent_request_replayed" }, 409)
    let result: z.infer<typeof workerResultSchema>
    try {
      result = workerResultSchema.parse(await workerRequest("/run", "POST", { prompt }, 11 * 60_000))
    } catch {
      await releaseInferenceCredits({ reservationId: reserved.reservation.id, failureCode: "CODEX_CLOUD_RUN_FAILED" })
      return c.json({ error: "codex_cloud_run_failed" }, 502)
    }
    try {
      const settlement = await settleInferenceCredits({
        reservationId: reserved.reservation.id,
        usage: result.usage,
        providerResponseId: result.threadId,
        accuracy: "reported",
        hasResult: true,
      })
      return c.json({
        text: result.text,
        modelSku,
        usage: result.usage,
        renCredit: { reservationId: settlement.id, capturedMicroCredits: settlement.captured_microcredits },
      })
    } catch {
      return c.json({ error: "rencredit_settlement_pending", reservationId: reserved.reservation.id }, 503)
    }
  })
}
