import { and, eq } from "@openwork-ee/den-db/drizzle"
import {
  OrganizationTable,
  RenCreditRuntimeDeviceTable,
} from "@openwork-ee/den-db/schema"
import {
  calculateRenCreditMicroCharge,
  canonicalLocalRuntimeReceiptPayload,
  findPublishedAdminModel,
  modelAllowedForPlan,
  parseSignedLocalRuntimeReceipt,
  validateAdminModelCatalog,
  type RenWorkAdminModelCatalog,
  type RenWorkTokenUsage,
} from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { createHash, createPublicKey, randomUUID, verify } from "node:crypto"
import { db } from "../db.js"
import { parseOrganizationPlan } from "../entitlements.js"
import { env } from "../env.js"
import { adminRoute, publicRoute } from "../middleware/index.js"
import { readOrganizationModelPolicy, resolveMemberMonthlyBudget } from "../organization-model-policy.js"
import { accessAllowsModel, resolveRenworkModelAccess } from "../renwork-access.js"
import {
  authenticateInferenceKey,
  getInferenceReservationForPrincipal,
  releaseInferenceCredits,
  reserveInferenceCredits,
  settleInferenceCredits,
  type InferencePrincipal,
} from "../rencredit-ledger.js"

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function bearerToken(value: string | undefined) {
  if (!value?.startsWith("Bearer ")) return null
  return value.slice(7).trim() || null
}

function validText(value: unknown, max = 255): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max
}

function validUsage(value: unknown): value is RenWorkTokenUsage {
  if (!isRecord(value)) return false
  return ["inputTokens", "outputTokens", "reasoningTokens", "cacheReadTokens", "cacheWriteTokens"]
    .every((key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
}

function exactKeys(record: JsonRecord, allowed: readonly string[]) {
  const keys = Object.keys(record).sort()
  const expected = [...allowed].sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}

async function principalForRequest(authorization: string | undefined) {
  const apiKey = bearerToken(authorization)
  return apiKey ? authenticateInferenceKey(apiKey) : null
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

async function localMeteringAccess(principal: InferencePrincipal, modelSku: string) {
  const catalog = await loadProductionCatalog()
  const model = findPublishedAdminModel(catalog, modelSku)
  const [organization] = await db.select({ metadata: OrganizationTable.metadata }).from(OrganizationTable)
    .where(eq(OrganizationTable.id, principal.organizationId)).limit(1)
  const inferenceMetadata = isRecord(organization?.metadata?.inference) ? organization.metadata.inference : null
  const access = await resolveRenworkModelAccess({ organizationId: principal.organizationId, metadata: organization?.metadata })
  if (!access.allowed) throw new Error("SUBSCRIPTION_REQUIRED")
  if (access.source === "subscription" && inferenceMetadata?.enabled !== true) throw new Error("INFERENCE_DISABLED")
  if (!accessAllowsModel(access, model.sku)) throw new Error("MODEL_NOT_INCLUDED_IN_GRANT")
  const plan = parseOrganizationPlan(organization?.metadata).tier
  if (access.source === "subscription" && !modelAllowedForPlan(model, plan)) throw new Error("PLAN_UPGRADE_REQUIRED")
  const policy = readOrganizationModelPolicy(organization?.metadata)
  if (policy.allowedModelSkus && !policy.allowedModelSkus.includes(model.sku)) {
    throw new Error("MODEL_NOT_ALLOWED_BY_ORGANIZATION")
  }
  const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]))
  const route = model.routes.filter((candidate) => candidate.enabled && ["local", "byok"].includes(candidate.source))
    .filter((candidate) => {
      const provider = providers.get(candidate.providerId)
      return provider?.enabled && provider.health !== "offline"
    }).sort((left, right) => left.priority - right.priority)[0]
  if (!route) throw new Error("LOCAL_MODEL_ROUTE_NOT_GRANTED")
  return { catalog, model, route, policy }
}

function canonicalPublicKey(input: string) {
  const key = createPublicKey(input)
  if (key.asymmetricKeyType !== "ed25519") throw new Error("DEVICE_KEY_MUST_BE_ED25519")
  const pem = key.export({ format: "pem", type: "spki" }).toString()
  const der = key.export({ format: "der", type: "spki" })
  const fingerprint = createHash("sha256").update(new Uint8Array(der)).digest("hex")
  return { key, pem, fingerprint }
}

function statusForMeteringError(code: string) {
  if (["SUBSCRIPTION_REQUIRED", "PLAN_UPGRADE_REQUIRED", "INSUFFICIENT_RENCREDIT", "RENCREDIT_WALLET_UNAVAILABLE", "ORGANIZATION_DAILY_BUDGET_EXCEEDED", "ORGANIZATION_MONTHLY_BUDGET_EXCEEDED", "MEMBER_MONTHLY_QUOTA_EXCEEDED"].includes(code)) return 402
  if (["INFERENCE_DISABLED", "MODEL_NOT_INCLUDED_IN_GRANT", "MODEL_NOT_ALLOWED_BY_ORGANIZATION", "LOCAL_MODEL_ROUTE_NOT_GRANTED"].includes(code)) return 403
  if (code === "MODEL_CATALOG_UNAVAILABLE") return 503
  return 409
}

export function registerMeteredRuntimeRoutes<T extends { Variables: Record<string, unknown> }>(app: Hono<T>) {
  app.get("/v1/admin/metered-runtime/devices", adminRoute(), async (c) => {
    const organizationId = c.req.query("organizationId")?.trim()
    const devices = organizationId
      ? await db.select().from(RenCreditRuntimeDeviceTable).where(eq(RenCreditRuntimeDeviceTable.organization_id, organizationId as never))
      : await db.select().from(RenCreditRuntimeDeviceTable)
    return c.json({ devices: devices.map((device) => ({
      id: device.id,
      organizationId: device.organization_id,
      memberId: device.org_membership_id,
      deviceId: device.device_id,
      publicKeyFingerprint: device.public_key_fingerprint,
      status: device.status,
      lastSeenAt: device.last_seen_at,
      createdAt: device.created_at,
    })) })
  })

  app.patch("/v1/admin/metered-runtime/devices/:registrationId", adminRoute(), async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!isRecord(body) || !exactKeys(body, ["status"]) || (body.status !== "active" && body.status !== "revoked")) {
      return c.json({ error: { code: "VALIDATION_FAILED" } }, 400)
    }
    const registrationId = c.req.param("registrationId")
    const [device] = await db.select().from(RenCreditRuntimeDeviceTable)
      .where(eq(RenCreditRuntimeDeviceTable.id, registrationId)).limit(1)
    if (!device) return c.json({ error: { code: "LOCAL_RUNTIME_DEVICE_NOT_FOUND" } }, 404)
    await db.update(RenCreditRuntimeDeviceTable).set({
      status: body.status,
      revoked_at: body.status === "revoked" ? new Date() : null,
    }).where(eq(RenCreditRuntimeDeviceTable.id, registrationId))
    return c.json({ id: registrationId, status: body.status })
  })

  app.put("/api/v1/metered-runtime/devices/:deviceId", publicRoute, async (c) => {
    const principal = await principalForRequest(c.req.header("Authorization"))
    if (!principal) return c.json({ error: { code: "UNAUTHORIZED" } }, 401)
    const deviceId = c.req.param("deviceId")
    const body = await c.req.json().catch(() => null)
    if (!validText(deviceId) || !isRecord(body) || !validText(body.publicKeyPem, 2048)) {
      return c.json({ error: { code: "VALIDATION_FAILED" } }, 400)
    }
    let publicKey
    try { publicKey = canonicalPublicKey(body.publicKeyPem) } catch (error) {
      return c.json({ error: { code: error instanceof Error ? error.message : "DEVICE_KEY_INVALID" } }, 400)
    }
    const [existing] = await db.select().from(RenCreditRuntimeDeviceTable).where(and(
      eq(RenCreditRuntimeDeviceTable.organization_id, principal.organizationId),
      eq(RenCreditRuntimeDeviceTable.org_membership_id, principal.memberId),
      eq(RenCreditRuntimeDeviceTable.device_id, deviceId),
    )).limit(1)
    if (existing?.public_key_fingerprint === publicKey.fingerprint) {
      await db.update(RenCreditRuntimeDeviceTable).set({ last_seen_at: new Date() })
        .where(eq(RenCreditRuntimeDeviceTable.id, existing.id))
      return c.json({ deviceId, publicKeyFingerprint: publicKey.fingerprint, status: existing.status })
    }
    const id = existing?.id ?? randomUUID()
    const values = {
        organization_id: principal.organizationId,
        org_membership_id: principal.memberId,
        inference_key_id: principal.inferenceKeyId,
        device_id: deviceId,
        public_key_pem: publicKey.pem,
        public_key_fingerprint: publicKey.fingerprint,
        status: "pending" as const,
        revoked_at: null,
        last_seen_at: new Date(),
    }
    if (existing) {
      await db.update(RenCreditRuntimeDeviceTable).set({
      inference_key_id: principal.inferenceKeyId,
      public_key_pem: publicKey.pem,
      public_key_fingerprint: publicKey.fingerprint,
      status: "pending",
      revoked_at: null,
      last_seen_at: new Date(),
      }).where(eq(RenCreditRuntimeDeviceTable.id, existing.id))
    } else {
      await db.insert(RenCreditRuntimeDeviceTable).values({ id, ...values })
    }
    return c.json({ deviceId, publicKeyFingerprint: publicKey.fingerprint, status: "pending" }, 202)
  })

  app.post("/api/v1/metered-runtime/reservations", publicRoute, async (c) => {
    const principal = await principalForRequest(c.req.header("Authorization"))
    if (!principal) return c.json({ error: { code: "UNAUTHORIZED" } }, 401)
    const body = await c.req.json().catch(() => null)
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim()
    if (!isRecord(body) || !exactKeys(body, ["deviceId", "runId", "modelSku", "estimatedUsage"]) || !idempotencyKey || !validText(body.deviceId) || !validText(body.runId) || !validText(body.modelSku) || !validUsage(body.estimatedUsage)) {
      return c.json({ error: { code: "VALIDATION_FAILED" } }, 400)
    }
    try {
      const [device] = await db.select({ id: RenCreditRuntimeDeviceTable.id }).from(RenCreditRuntimeDeviceTable).where(and(
        eq(RenCreditRuntimeDeviceTable.organization_id, principal.organizationId),
        eq(RenCreditRuntimeDeviceTable.org_membership_id, principal.memberId),
        eq(RenCreditRuntimeDeviceTable.inference_key_id, principal.inferenceKeyId),
        eq(RenCreditRuntimeDeviceTable.device_id, body.deviceId),
        eq(RenCreditRuntimeDeviceTable.status, "active"),
      )).limit(1)
      if (!device) throw new Error("LOCAL_RUNTIME_DEVICE_NOT_APPROVED")
      const { catalog, model, route, policy } = await localMeteringAccess(principal, body.modelSku)
      const billingMode = catalog.billingPolicy[route.source]
      const reservedMicroCredits = billingMode === "free" ? 0 : calculateRenCreditMicroCharge(body.estimatedUsage, model)
      const reserved = await reserveInferenceCredits({
        ...principal,
        runId: body.runId,
        idempotencyKey,
        catalogVersion: catalog.version,
        model,
        route,
        providerId: route.providerId,
        billingMode,
        estimatedUsage: body.estimatedUsage,
        reservedMicroCredits,
        budgets: {
          organizationDailyMicroCredits: policy.dailyBudgetMicroCredits,
          organizationMonthlyMicroCredits: policy.monthlyBudgetMicroCredits,
          memberMonthlyMicroCredits: resolveMemberMonthlyBudget(policy, principal.memberId),
        },
        expiresAt: new Date(Date.now() + 30 * 60_000),
      })
      if (reserved.replayed) return c.json({ error: { code: "IDEMPOTENT_REQUEST_REPLAYED" } }, 409)
      return c.json({
        reservationId: reserved.reservation.id,
        runId: reserved.reservation.run_id,
        modelSku: reserved.reservation.model_sku,
        reservedMicroCredits: reserved.reservation.reserved_microcredits,
        expiresAt: reserved.reservation.expires_at,
        execution: {
          providerID: route.providerId,
          modelID: route.upstreamModelId,
        },
      }, 201)
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0]! : "RENCREDIT_RESERVATION_FAILED"
      return c.json({ error: { code } }, statusForMeteringError(code) as 402)
    }
  })

  app.post("/api/v1/metered-runtime/settlements", publicRoute, async (c) => {
    const principal = await principalForRequest(c.req.header("Authorization"))
    if (!principal) return c.json({ error: { code: "UNAUTHORIZED" } }, 401)
    let receipt
    try { receipt = parseSignedLocalRuntimeReceipt(await c.req.json()) } catch (error) {
      return c.json({ error: { code: error instanceof Error ? error.message : "LOCAL_RUNTIME_RECEIPT_INVALID" } }, 400)
    }
    const measuredAt = Date.parse(receipt.payload.measuredAt)
    if (measuredAt < Date.now() - 10 * 60_000 || measuredAt > Date.now() + 60_000) {
      return c.json({ error: { code: "LOCAL_RUNTIME_RECEIPT_STALE" } }, 409)
    }
    const reservation = await getInferenceReservationForPrincipal({ ...principal, reservationId: receipt.payload.reservationId })
    if (!reservation) return c.json({ error: { code: "RENCREDIT_RESERVATION_NOT_FOUND" } }, 404)
    if (reservation.run_id !== receipt.payload.runId || reservation.model_sku !== receipt.payload.modelSku) {
      return c.json({ error: { code: "LOCAL_RUNTIME_RECEIPT_MISMATCH" } }, 409)
    }
    const [device] = await db.select().from(RenCreditRuntimeDeviceTable).where(and(
      eq(RenCreditRuntimeDeviceTable.organization_id, principal.organizationId),
      eq(RenCreditRuntimeDeviceTable.org_membership_id, principal.memberId),
      eq(RenCreditRuntimeDeviceTable.inference_key_id, principal.inferenceKeyId),
      eq(RenCreditRuntimeDeviceTable.device_id, receipt.payload.deviceId),
      eq(RenCreditRuntimeDeviceTable.status, "active"),
    )).limit(1)
    if (!device) return c.json({ error: { code: "LOCAL_RUNTIME_DEVICE_NOT_APPROVED" } }, 403)
    let signatureValid = false
    try {
      signatureValid = verify(
        null,
        new TextEncoder().encode(canonicalLocalRuntimeReceiptPayload(receipt.payload)),
        createPublicKey(device.public_key_pem),
        new Uint8Array(Buffer.from(receipt.signature, "base64")),
      )
    } catch { signatureValid = false }
    if (!signatureValid) return c.json({ error: { code: "LOCAL_RUNTIME_RECEIPT_SIGNATURE_INVALID" } }, 403)
    const settled = await settleInferenceCredits({
      reservationId: reservation.id,
      usage: receipt.payload.usage,
      providerResponseId: receipt.payload.providerResponseId,
      accuracy: receipt.payload.accuracy,
      hasResult: receipt.payload.hasResult,
    })
    await db.update(RenCreditRuntimeDeviceTable).set({ last_seen_at: new Date() }).where(eq(RenCreditRuntimeDeviceTable.id, device.id))
    return c.json({
      reservationId: settled.id,
      status: settled.status,
      capturedMicroCredits: settled.captured_microcredits,
      releasedMicroCredits: settled.released_microcredits,
    })
  })

  app.post("/api/v1/metered-runtime/reservations/:reservationId/release", publicRoute, async (c) => {
    const principal = await principalForRequest(c.req.header("Authorization"))
    if (!principal) return c.json({ error: { code: "UNAUTHORIZED" } }, 401)
    const reservation = await getInferenceReservationForPrincipal({ ...principal, reservationId: c.req.param("reservationId") })
    if (!reservation) return c.json({ error: { code: "RENCREDIT_RESERVATION_NOT_FOUND" } }, 404)
    const body = await c.req.json().catch(() => null)
    const failureCode = isRecord(body) && validText(body.failureCode, 128) ? body.failureCode : "LOCAL_RUNTIME_ABORTED"
    const released = await releaseInferenceCredits({ reservationId: reservation.id, failureCode })
    return c.json({ reservationId: released.id, status: released.status, releasedMicroCredits: released.released_microcredits })
  })
}
