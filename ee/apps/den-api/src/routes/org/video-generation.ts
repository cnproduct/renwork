import { createHash } from "node:crypto"
import { and, desc, eq, isNull, lte } from "@openwork-ee/den-db/drizzle"
import {
  RenCreditReservationTable,
  VideoGenerationAssetTable,
  VideoGenerationJobTable,
  VideoGenerationQuoteTable,
} from "@openwork-ee/den-db/schema"
import { createDenTypeId, normalizeDenTypeId } from "@openwork-ee/utils/typeid"
import {
  createVideoJobSchema,
  createVideoQuoteSchema,
  directH3Video,
  validateFirstFrameDimensions,
  videoGenerationInputSchema,
  type MemberVideoJob,
  type VideoGenerationInput,
} from "@openwork/minimax-h3-video"
import type { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import sharp from "sharp"
import type { Metadata as SharpMetadata } from "sharp"
import { z } from "zod"
import { organizationMinimaxH3VideoEnabled } from "../../capability-sources/minimax-h3-video-rollout.js"
import { db } from "../../db.js"
import { jsonValidator, orgRoleRoute } from "../../middleware/index.js"
import {
  createMetaSoH3ProviderFromEnvironment,
  H3ProviderError,
  type MetaSoH3Provider,
  validatePersistedVideoResult,
} from "../../minimax-h3-provider.js"
import {
  AI_PROVENANCE_EVIDENCE,
  videoJobApprovalBlockReason,
  videoJobCanAcceptCostEvidence,
  videoJobCanBeReleasedSafely,
  videoJobHasReviewableDelivery,
} from "../../minimax-h3-video-policy.js"
import { organizationHasCapability } from "../../organization-capabilities.js"
import {
  captureProductCredits,
  getOrCreateRenCreditWallet,
  releaseProductCredits,
  reserveProductCredits,
} from "../../rencredit-ledger.js"
import type { OrgRouteVariables } from "./shared.js"

const PROVIDER_ID = "metaso-minimax-h3"
const PRODUCT_SKU = "renwork-video-minimax-h3"
const FIRST_FRAME_MAX_BYTES = 10 * 1024 * 1024
const RESERVATION_TTL_MS = 30 * 60 * 1000
const QUOTE_TTL_MS = 15 * 60 * 1000
const ABANDONED_SUBMISSION_CLAIM_MS = 5 * 60 * 1000
// Persisted before capture as the exact audit code AI_GENERATED_PROVENANCE_PRESERVED.

type VideoJobRow = typeof VideoGenerationJobTable.$inferSelect
type ProviderFactory = () => MetaSoH3Provider

const idempotencyKeySchema = z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/)
const providerCostEvidenceSchema = z.discriminatedUnion("providerCostKind", [
  z.object({
    providerCostKind: z.literal("money"),
    providerCostMicrounits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    providerCostCurrency: z.string().trim().regex(/^[A-Z]{3}$/),
    costEvidenceReference: z.string().trim().min(1).max(512),
  }).strict(),
  z.object({
    providerCostKind: z.literal("provider_credits"),
    providerCostUnits: z.number().finite().nonnegative().max(1_000_000_000_000)
      .refine((value) => Number.isInteger(value * 1_000_000), "provider credits support at most 6 decimal places"),
    providerCostUnitCode: z.literal("METASO_H3_CREDIT"),
    costEvidenceReference: z.string().trim().min(1).max(512),
  }).strict(),
])
const videoReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(1).max(1000),
})

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

function configuredPrice() {
  const microCreditsPerSecond = Number(process.env.RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND)
  const priceVersion = process.env.RENWORK_H3_PRICE_VERSION?.trim()
  if (
    !Number.isSafeInteger(microCreditsPerSecond) ||
    microCreditsPerSecond <= 0 ||
    microCreditsPerSecond > Math.floor(Number.MAX_SAFE_INTEGER / 8) ||
    !priceVersion ||
    priceVersion.length > 128
  ) {
    throw new Error("VIDEO_PRICE_UNAVAILABLE")
  }
  return { microCreditsPerSecond, priceVersion }
}

function configuredLicenseEvidenceId() {
  const evidenceId = process.env.RENWORK_METASO_H3_LICENSE_EVIDENCE_ID?.trim()
  if (!evidenceId || evidenceId.length > 128) throw new Error("VIDEO_LICENSE_EVIDENCE_UNAVAILABLE")
  return evidenceId
}

function routeEnabled(metadata: Record<string, unknown> | string | null | undefined, organizationId: string) {
  return organizationMinimaxH3VideoEnabled(metadata, organizationId)
}

function organizationRouteEnabled(metadata: Record<string, unknown> | string | null | undefined) {
  return organizationHasCapability(metadata, "minimaxH3Video")
}

function normalizedId<Name extends "videoGenerationQuote" | "videoGenerationJob" | "videoGenerationAsset">(
  name: Name,
  value: string,
) {
  try {
    return normalizeDenTypeId(name, value)
  } catch {
    return null
  }
}

function dateString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function memberAssetUrl(assetId: string) {
  return `/v1/video-generation/assets/${encodeURIComponent(assetId)}`
}

async function memberJob(job: VideoJobRow): Promise<MemberVideoJob> {
  const [reservation] = await db.select({
    reserved: RenCreditReservationTable.reserved_microcredits,
    captured: RenCreditReservationTable.captured_microcredits,
  }).from(RenCreditReservationTable).where(eq(RenCreditReservationTable.id, job.rencredit_reservation_id)).limit(1)
  if (!reservation) throw new Error("RENCREDIT_RESERVATION_NOT_FOUND")
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    resolution: "768P",
    durationSeconds: job.duration_seconds,
    reservedMicroCredits: reservation.reserved,
    capturedMicroCredits: reservation.captured,
    settlementStatus: job.settlement_status,
    aiProvenanceStatus: job.ai_provenance_status,
    reviewStatus: job.review_status,
    assetUrl: job.result_asset_id ? memberAssetUrl(job.result_asset_id) : null,
    taskHash: job.task_hash,
    resultHash: job.result_hash,
    failureCode: job.failure_code,
    createdAt: dateString(job.created_at),
    updatedAt: dateString(job.updated_at),
  }
}

async function loadMemberJob(input: { organizationId: VideoJobRow["organization_id"]; memberId: VideoJobRow["org_membership_id"]; jobId: string }) {
  const jobId = normalizedId("videoGenerationJob", input.jobId)
  if (!jobId) return null
  const [job] = await db.select().from(VideoGenerationJobTable).where(and(
    eq(VideoGenerationJobTable.id, jobId),
    eq(VideoGenerationJobTable.organization_id, input.organizationId),
    eq(VideoGenerationJobTable.org_membership_id, input.memberId),
  )).limit(1)
  return job ?? null
}

async function loadFirstFrame(input: {
  organizationId: VideoJobRow["organization_id"]
  memberId: VideoJobRow["org_membership_id"]
  assetId: string
}) {
  const assetId = normalizedId("videoGenerationAsset", input.assetId)
  if (!assetId) return null
  const [asset] = await db.select().from(VideoGenerationAssetTable).where(and(
    eq(VideoGenerationAssetTable.id, assetId),
    eq(VideoGenerationAssetTable.organization_id, input.organizationId),
    eq(VideoGenerationAssetTable.org_membership_id, input.memberId),
    eq(VideoGenerationAssetTable.kind, "first_frame"),
  )).limit(1)
  return asset ?? null
}

function providerFailureCode(error: unknown) {
  return error instanceof H3ProviderError ? error.code : "PROVIDER_REQUEST_FAILED"
}

async function failJob(job: VideoJobRow, failureCode: string) {
  await releaseProductCredits({ reservationId: job.rencredit_reservation_id, failureCode })
  await db.delete(VideoGenerationAssetTable).where(and(
    eq(VideoGenerationAssetTable.organization_id, job.organization_id),
    eq(VideoGenerationAssetTable.org_membership_id, job.org_membership_id),
    eq(VideoGenerationAssetTable.job_id, job.id),
    eq(VideoGenerationAssetTable.kind, "result_video"),
  ))
  await db.update(VideoGenerationJobTable).set({
    status: "failed",
    settlement_status: "released",
    result_asset_id: null,
    result_hash: null,
    ai_provenance_status: "pending",
    ai_provenance_evidence: null,
    failure_code: failureCode,
    last_reconciled_at: new Date(),
  }).where(and(
    eq(VideoGenerationJobTable.id, job.id),
    eq(VideoGenerationJobTable.organization_id, job.organization_id),
  ))
  const failed = await loadMemberJob({ organizationId: job.organization_id, memberId: job.org_membership_id, jobId: job.id })
  if (!failed) throw new Error("VIDEO_JOB_NOT_FOUND")
  return failed
}

async function alignJobWithSettledReservation(job: VideoJobRow) {
  const [reservation] = await db.select({ status: RenCreditReservationTable.status })
    .from(RenCreditReservationTable)
    .where(and(
      eq(RenCreditReservationTable.id, job.rencredit_reservation_id),
      eq(RenCreditReservationTable.organization_id, job.organization_id),
    )).limit(1)
  if (!reservation) throw new Error("RENCREDIT_RESERVATION_NOT_FOUND")
  if (reservation.status === "reserved") return null

  if (reservation.status === "released") {
    await db.delete(VideoGenerationAssetTable).where(and(
      eq(VideoGenerationAssetTable.organization_id, job.organization_id),
      eq(VideoGenerationAssetTable.org_membership_id, job.org_membership_id),
      eq(VideoGenerationAssetTable.job_id, job.id),
      eq(VideoGenerationAssetTable.kind, "result_video"),
    ))
    await db.update(VideoGenerationJobTable).set({
      status: "failed",
      settlement_status: "released",
      result_asset_id: null,
      result_hash: null,
      ai_provenance_status: "pending",
      ai_provenance_evidence: null,
      failure_code: job.failure_code ?? "RENCREDIT_RESERVATION_RELEASED",
      last_reconciled_at: new Date(),
    }).where(and(
      eq(VideoGenerationJobTable.id, job.id),
      eq(VideoGenerationJobTable.organization_id, job.organization_id),
    ))
  } else {
    const [asset] = await db.select().from(VideoGenerationAssetTable).where(and(
      eq(VideoGenerationAssetTable.organization_id, job.organization_id),
      eq(VideoGenerationAssetTable.org_membership_id, job.org_membership_id),
      eq(VideoGenerationAssetTable.job_id, job.id),
      eq(VideoGenerationAssetTable.kind, "result_video"),
    )).limit(1)
    const persistedFailure = asset
      ? validatePersistedVideoResult({
        downloadedHash: asset.result_hash,
        persistedHash: asset.result_hash,
        persistedBytes: Uint8Array.from(asset.result_bytes),
        persistedByteLength: asset.byte_length,
      })
      : "RESULT_PERSISTENCE_INVALID"
    if (asset && persistedFailure === null && (job.result_hash === null || job.result_hash === asset.result_hash)) {
      await db.update(VideoGenerationJobTable).set({
        status: "succeeded",
        settlement_status: "captured",
        result_asset_id: asset.id,
        result_hash: asset.result_hash,
        ai_provenance_status: "preserved",
        ai_provenance_evidence: AI_PROVENANCE_EVIDENCE,
        failure_code: null,
        last_reconciled_at: new Date(),
      }).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, job.organization_id),
      ))
    } else {
      await db.update(VideoGenerationJobTable).set({
        status: "failed",
        settlement_status: "captured",
        failure_code: "CAPTURED_RESULT_ASSET_INVALID",
        last_reconciled_at: new Date(),
      }).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, job.organization_id),
      ))
    }
  }
  const [aligned] = await db.select().from(VideoGenerationJobTable).where(and(
    eq(VideoGenerationJobTable.id, job.id),
    eq(VideoGenerationJobTable.organization_id, job.organization_id),
  )).limit(1)
  if (!aligned) throw new Error("VIDEO_JOB_NOT_FOUND")
  return aligned
}

async function reconcileVideoJob(job: VideoJobRow, providerFactory: ProviderFactory) {
  const settledJob = await alignJobWithSettledReservation(job)
  if (settledJob) return settledJob
  if (job.status === "succeeded" || job.status === "failed") return job
  const [quote] = await db.select().from(VideoGenerationQuoteTable).where(and(
    eq(VideoGenerationQuoteTable.id, job.quote_id),
    eq(VideoGenerationQuoteTable.organization_id, job.organization_id),
    eq(VideoGenerationQuoteTable.org_membership_id, job.org_membership_id),
  )).limit(1)
  if (!quote) return failJob(job, "QUOTE_NOT_FOUND")
  const parsedInput = videoGenerationInputSchema.safeParse(quote.input_snapshot)
  if (!parsedInput.success) return failJob(job, "QUOTE_SNAPSHOT_INVALID")
  const provider = providerFactory()

  if (!job.provider_task_id) {
    const submissionClaim = createDenTypeId("request")
    await db.update(VideoGenerationJobTable).set({
      submission_claim: submissionClaim,
      submission_claimed_at: new Date(),
    }).where(and(
      eq(VideoGenerationJobTable.id, job.id),
      eq(VideoGenerationJobTable.organization_id, job.organization_id),
      isNull(VideoGenerationJobTable.provider_task_id),
      isNull(VideoGenerationJobTable.submission_claim),
    ))
    const [claimedJob] = await db.select().from(VideoGenerationJobTable).where(and(
      eq(VideoGenerationJobTable.id, job.id),
      eq(VideoGenerationJobTable.organization_id, job.organization_id),
    )).limit(1)
    if (!claimedJob) throw new Error("VIDEO_JOB_NOT_FOUND")
    if (claimedJob.submission_claim !== submissionClaim) return claimedJob

    let firstFrameReference: string | undefined
    if (parsedInput.data.mode === "first_frame_to_video") {
      const firstFrameAssetId = parsedInput.data.firstFrameAssetId
      if (!firstFrameAssetId) return failJob(job, "FIRST_FRAME_NOT_FOUND")
      const firstFrame = await loadFirstFrame({
        organizationId: job.organization_id,
        memberId: job.org_membership_id,
        assetId: firstFrameAssetId,
      })
      if (!firstFrame) return failJob(job, "FIRST_FRAME_NOT_FOUND")
      firstFrameReference = await provider.uploadFirstFrame({
        bytes: Uint8Array.from(firstFrame.result_bytes),
        contentType: firstFrame.content_type,
        filename: `first-frame-${firstFrame.result_hash}.${firstFrame.content_type.split("/")[1]}`,
      })
    }
    const submitted = await provider.submit({
      ...parsedInput.data,
      directedPrompt: quote.directed_prompt,
      ...(firstFrameReference ? { firstFrameReference } : {}),
    })
    await db.update(VideoGenerationJobTable).set({
      provider_task_id: submitted.taskId,
      status: "submitted",
      last_reconciled_at: new Date(),
    }).where(and(
      eq(VideoGenerationJobTable.id, job.id),
      eq(VideoGenerationJobTable.organization_id, job.organization_id),
      eq(VideoGenerationJobTable.submission_claim, submissionClaim),
      eq(VideoGenerationJobTable.settlement_status, "reserved"),
      isNull(VideoGenerationJobTable.provider_task_id),
    ))
    const refreshed = await loadMemberJob({ organizationId: job.organization_id, memberId: job.org_membership_id, jobId: job.id })
    if (!refreshed) throw new Error("VIDEO_JOB_NOT_FOUND")
    return db.select().from(VideoGenerationJobTable).where(eq(VideoGenerationJobTable.id, refreshed.id)).then((rows) => rows[0] ?? job)
  }

  const state = await provider.query(job.provider_task_id)
  if (state.state === "failed") return failJob(job, state.failureCode)
  if (state.state !== "succeeded") {
    await db.update(VideoGenerationJobTable).set({
      status: state.state,
      last_reconciled_at: new Date(),
    }).where(and(eq(VideoGenerationJobTable.id, job.id), eq(VideoGenerationJobTable.organization_id, job.organization_id)))
    const [updated] = await db.select().from(VideoGenerationJobTable).where(eq(VideoGenerationJobTable.id, job.id)).limit(1)
    return updated ?? job
  }

  let delivery: Awaited<ReturnType<MetaSoH3Provider["downloadResult"]>>
  try {
    delivery = await provider.downloadResult(state.resultUrl)
  } catch (error) {
    return failJob(job, providerFailureCode(error))
  }
  const resultHash = sha256(delivery.bytes)
  const assetId = createDenTypeId("videoGenerationAsset")
  await db.insert(VideoGenerationAssetTable).values({
    id: assetId,
    organization_id: job.organization_id,
    org_membership_id: job.org_membership_id,
    job_id: job.id,
    kind: "result_video",
    content_type: delivery.contentType,
    result_bytes: delivery.bytes,
    result_hash: resultHash,
    byte_length: delivery.bytes.byteLength,
  }).onDuplicateKeyUpdate({ set: { job_id: job.id } })
  const [persistedAsset] = await db.select().from(VideoGenerationAssetTable).where(and(
    eq(VideoGenerationAssetTable.organization_id, job.organization_id),
    eq(VideoGenerationAssetTable.job_id, job.id),
  )).limit(1)
  if (!persistedAsset) return failJob(job, "RESULT_PERSISTENCE_INVALID")
  const persistenceFailure = validatePersistedVideoResult({
    downloadedHash: resultHash,
    persistedHash: persistedAsset.result_hash,
    persistedBytes: Uint8Array.from(persistedAsset.result_bytes),
    persistedByteLength: persistedAsset.byte_length,
  })
  if (persistenceFailure) return failJob(job, persistenceFailure)
  await db.update(VideoGenerationJobTable).set({
    ai_provenance_status: "preserved",
    ai_provenance_evidence: AI_PROVENANCE_EVIDENCE,
    review_status: "pending_review",
  }).where(and(
    eq(VideoGenerationJobTable.id, job.id),
    eq(VideoGenerationJobTable.organization_id, job.organization_id),
    eq(VideoGenerationJobTable.settlement_status, "reserved"),
  ))
  await captureProductCredits({
    reservationId: job.rencredit_reservation_id,
    providerResponseId: job.provider_task_id,
    resultHash: persistedAsset.result_hash,
  })
  await db.update(VideoGenerationJobTable).set({
    status: "succeeded",
    settlement_status: "captured",
    result_asset_id: persistedAsset.id,
    result_hash: persistedAsset.result_hash,
    ai_provenance_status: "preserved",
    ai_provenance_evidence: AI_PROVENANCE_EVIDENCE,
    review_status: "pending_review",
    failure_code: null,
    last_reconciled_at: new Date(),
  }).where(and(eq(VideoGenerationJobTable.id, job.id), eq(VideoGenerationJobTable.organization_id, job.organization_id)))
  const [updated] = await db.select().from(VideoGenerationJobTable).where(eq(VideoGenerationJobTable.id, job.id)).limit(1)
  return updated ?? job
}

function phaseOneInputSnapshot(input: VideoGenerationInput) {
  return {
    mode: input.mode,
    resolution: input.resolution,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    prompt: input.prompt,
    ...(input.firstFrameAssetId ? { firstFrameAssetId: input.firstFrameAssetId } : {}),
  }
}

export function registerOrgVideoGenerationRoutes<T extends { Variables: OrgRouteVariables }>(
  app: Hono<T>,
  options: { providerFactory?: ProviderFactory } = {},
) {
  const providerFactory = options.providerFactory ?? createMetaSoH3ProviderFromEnvironment

  app.get("/v1/video-generation/capabilities", orgRoleRoute(["member"]), async (c) => {
    const payload = c.get("organizationContext")
    const visible = organizationRouteEnabled(payload.organization.metadata)
    const enabled = routeEnabled(payload.organization.metadata, payload.organization.id)
    return c.json({
      visible,
      enabled,
      ...(enabled ? {
        modes: ["text_to_video", "first_frame_to_video"] as const,
        resolution: "768P" as const,
        minimumDurationSeconds: 4 as const,
        maximumDurationSeconds: 8 as const,
        maximumConcurrentJobs: 1 as const,
      } : {}),
    })
  })

  app.post(
    "/v1/video-generation/assets/first-frame",
    orgRoleRoute(["member"]),
    bodyLimit({ maxSize: FIRST_FRAME_MAX_BYTES, onError: (c) => c.json({ error: "FIRST_FRAME_TOO_LARGE" }, 413) }),
    async (c) => {
      const payload = c.get("organizationContext")
      if (!routeEnabled(payload.organization.metadata, payload.organization.id)) return c.json({ error: "not_found" }, 404)
      if (!c.req.header("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
        return c.json({ error: "FIRST_FRAME_MULTIPART_REQUIRED" }, 400)
      }
      const form = await c.req.parseBody()
      const file = form.file instanceof File ? form.file : null
      if (!file) return c.json({ error: "FIRST_FRAME_REQUIRED" }, 400)
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength === 0 || bytes.byteLength > FIRST_FRAME_MAX_BYTES) {
        return c.json({ error: "FIRST_FRAME_BYTES_INVALID" }, 400)
      }
      let metadata: SharpMetadata
      try {
        metadata = await sharp(bytes).metadata()
      } catch {
        return c.json({ error: "FIRST_FRAME_INVALID" }, 400)
      }
      const contentType = metadata.format === "png"
        ? "image/png"
        : metadata.format === "jpeg"
          ? "image/jpeg"
          : metadata.format === "webp"
            ? "image/webp"
            : null
      if (!contentType || !metadata.width || !metadata.height) return c.json({ error: "FIRST_FRAME_INVALID" }, 400)
      const dimensions = validateFirstFrameDimensions(metadata.width, metadata.height)
      if (!dimensions.ok) return c.json({ error: dimensions.code }, 400)
      const resultHash = sha256(bytes)
      const [existing] = await db.select().from(VideoGenerationAssetTable).where(and(
        eq(VideoGenerationAssetTable.organization_id, payload.organization.id),
        eq(VideoGenerationAssetTable.org_membership_id, payload.currentMember.id),
        eq(VideoGenerationAssetTable.result_hash, resultHash),
        eq(VideoGenerationAssetTable.kind, "first_frame"),
      )).limit(1)
      if (existing) return c.json({ asset: { id: existing.id, resultHash: existing.result_hash } })
      const id = createDenTypeId("videoGenerationAsset")
      await db.insert(VideoGenerationAssetTable).values({
        id,
        organization_id: payload.organization.id,
        org_membership_id: payload.currentMember.id,
        job_id: null,
        kind: "first_frame",
        content_type: contentType,
        result_bytes: bytes,
        result_hash: resultHash,
        byte_length: bytes.byteLength,
      })
      return c.json({ asset: { id, resultHash } })
    },
  )

  app.post(
    "/v1/video-generation/quotes",
    orgRoleRoute(["member"]),
    jsonValidator(createVideoQuoteSchema),
    async (c) => {
      const payload = c.get("organizationContext")
      if (!routeEnabled(payload.organization.metadata, payload.organization.id)) return c.json({ error: "not_found" }, 404)
      const input = c.req.valid("json")
      if (input.firstFrameAssetId && !await loadFirstFrame({
        organizationId: payload.organization.id,
        memberId: payload.currentMember.id,
        assetId: input.firstFrameAssetId,
      })) return c.json({ error: "FIRST_FRAME_NOT_FOUND" }, 400)
      const direction = directH3Video(input)
      const price = configuredPrice()
      await getOrCreateRenCreditWallet(payload.organization.id)
      const id = createDenTypeId("videoGenerationQuote")
      const expiresAt = new Date(Date.now() + QUOTE_TTL_MS)
      const amountMicroCredits = price.microCreditsPerSecond * input.durationSeconds
      await db.insert(VideoGenerationQuoteTable).values({
        id,
        organization_id: payload.organization.id,
        org_membership_id: payload.currentMember.id,
        mode: input.mode,
        resolution: input.resolution,
        duration_seconds: input.durationSeconds,
        aspect_ratio: input.aspectRatio,
        directed_prompt: direction.prompt,
        input_snapshot: phaseOneInputSnapshot(input),
        amount_microcredits: amountMicroCredits,
        price_version: price.priceVersion,
        expires_at: expiresAt,
      })
      return c.json({
        quote: {
          id,
          amountMicroCredits,
          priceVersion: price.priceVersion,
          expiresAt: expiresAt.toISOString(),
          direction: {
            directedPrompt: direction.prompt,
            assetRoles: direction.assetRoles,
            acceptanceCriteria: direction.acceptanceCriteria,
          },
        },
      })
    },
  )

  app.post(
    "/v1/video-generation/jobs",
    orgRoleRoute(["member"]),
    jsonValidator(createVideoJobSchema),
    async (c) => {
      const payload = c.get("organizationContext")
      if (!routeEnabled(payload.organization.metadata, payload.organization.id)) return c.json({ error: "not_found" }, 404)
      const idempotency = idempotencyKeySchema.safeParse(c.req.header("Idempotency-Key"))
      if (!idempotency.success) return c.json({ error: "IDEMPOTENCY_KEY_REQUIRED" }, 400)
      const [existing] = await db.select().from(VideoGenerationJobTable).where(and(
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
        eq(VideoGenerationJobTable.org_membership_id, payload.currentMember.id),
        eq(VideoGenerationJobTable.idempotency_key, idempotency.data),
      )).limit(1)
      if (existing) return c.json({ job: await memberJob(existing), replayed: true })

      const body = c.req.valid("json")
      const quoteId = normalizedId("videoGenerationQuote", body.quoteId)
      if (!quoteId) return c.json({ error: "QUOTE_NOT_FOUND" }, 404)
      const [quote] = await db.select().from(VideoGenerationQuoteTable).where(and(
        eq(VideoGenerationQuoteTable.id, quoteId),
        eq(VideoGenerationQuoteTable.organization_id, payload.organization.id),
        eq(VideoGenerationQuoteTable.org_membership_id, payload.currentMember.id),
      )).limit(1)
      if (!quote) return c.json({ error: "QUOTE_NOT_FOUND" }, 404)
      if (new Date(quote.expires_at).getTime() <= Date.now()) return c.json({ error: "QUOTE_EXPIRED" }, 409)
      const parsedInput = videoGenerationInputSchema.safeParse(quote.input_snapshot)
      if (!parsedInput.success) return c.json({ error: "QUOTE_SNAPSHOT_INVALID" }, 409)
      if (parsedInput.data.firstFrameAssetId && !await loadFirstFrame({
        organizationId: payload.organization.id,
        memberId: payload.currentMember.id,
        assetId: parsedInput.data.firstFrameAssetId,
      })) return c.json({ error: "FIRST_FRAME_NOT_FOUND" }, 409)

      let reservation
      try {
        reservation = await reserveProductCredits({
          organizationId: payload.organization.id,
          memberId: payload.currentMember.id,
          runId: `video:${idempotency.data}`,
          idempotencyKey: `video:${payload.currentMember.id}:${idempotency.data}`,
          productSku: PRODUCT_SKU,
          priceVersion: quote.price_version,
          providerId: PROVIDER_ID,
          reservedMicroCredits: quote.amount_microcredits,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          pricingSnapshot: { kind: "fixed_outcome", durationSeconds: quote.duration_seconds, priceVersion: quote.price_version },
          maxConcurrentRunsPerUser: 1,
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : "RENCREDIT_RESERVATION_FAILED"
        const status = code === "INSUFFICIENT_RENCREDIT" ? 402 : code === "PRODUCT_CONCURRENCY_EXCEEDED" ? 409 : 503
        return c.json({ error: code }, status)
      }
      if (reservation.replayed) {
        const [replayedJob] = await db.select().from(VideoGenerationJobTable).where(and(
          eq(VideoGenerationJobTable.organization_id, payload.organization.id),
          eq(VideoGenerationJobTable.org_membership_id, payload.currentMember.id),
          eq(VideoGenerationJobTable.idempotency_key, idempotency.data),
        )).limit(1)
        if (!replayedJob) return c.json({ error: "JOB_INITIALIZING" }, 409)
        return c.json({ job: await memberJob(replayedJob), replayed: true })
      }

      const id = createDenTypeId("videoGenerationJob")
      const taskHash = sha256(JSON.stringify({
        organizationId: payload.organization.id,
        memberId: payload.currentMember.id,
        quoteId: quote.id,
        input: quote.input_snapshot,
        idempotencyKey: idempotency.data,
      }))
      let created: VideoJobRow
      try {
        await db.insert(VideoGenerationJobTable).values({
          id,
          organization_id: payload.organization.id,
          org_membership_id: payload.currentMember.id,
          quote_id: quote.id,
          rencredit_reservation_id: reservation.reservation.id,
          idempotency_key: idempotency.data,
          mode: quote.mode,
          resolution: quote.resolution,
          duration_seconds: quote.duration_seconds,
          aspect_ratio: quote.aspect_ratio,
          provider_id: PROVIDER_ID,
          license_evidence_id: configuredLicenseEvidenceId(),
          price_version: quote.price_version,
          task_hash: taskHash,
        })
        const [persisted] = await db.select().from(VideoGenerationJobTable).where(eq(VideoGenerationJobTable.id, id)).limit(1)
        if (!persisted) throw new Error("VIDEO_JOB_CREATE_FAILED")
        created = persisted
      } catch (error) {
        await releaseProductCredits({
          reservationId: reservation.reservation.id,
          failureCode: "VIDEO_JOB_INITIALIZATION_FAILED",
        })
        throw error
      }
      try {
        const reconciled = await reconcileVideoJob(created, providerFactory)
        return c.json({ job: await memberJob(reconciled), replayed: false })
      } catch (error) {
        const failed = await failJob(created, providerFailureCode(error))
        return c.json({ job: await memberJob(failed), replayed: false })
      }
    },
  )

  app.get("/v1/video-generation/jobs", orgRoleRoute(["member"]), async (c) => {
    const payload = c.get("organizationContext")
    if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
    const rows = await db.select().from(VideoGenerationJobTable).where(and(
      eq(VideoGenerationJobTable.organization_id, payload.organization.id),
      eq(VideoGenerationJobTable.org_membership_id, payload.currentMember.id),
    )).orderBy(desc(VideoGenerationJobTable.created_at)).limit(20)
    return c.json({ jobs: await Promise.all(rows.map(memberJob)) })
  })

  app.get("/v1/video-generation/jobs/:jobId", orgRoleRoute(["member"]), async (c) => {
    const payload = c.get("organizationContext")
    if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
    const job = await loadMemberJob({ organizationId: payload.organization.id, memberId: payload.currentMember.id, jobId: c.req.param("jobId") })
    if (!job) return c.json({ error: "not_found" }, 404)
    let reconciled = job
    if (routeEnabled(payload.organization.metadata, payload.organization.id)) {
      try {
        reconciled = await reconcileVideoJob(job, providerFactory)
      } catch {
        // Polling transport failures remain retryable; an explicit provider
        // failure or invalid delivery is handled inside reconcile and releases.
      }
    }
    return c.json({ job: await memberJob(reconciled) })
  })

  app.get("/v1/video-generation/assets/:assetId", orgRoleRoute(["member"]), async (c) => {
    const payload = c.get("organizationContext")
    if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
    const assetId = normalizedId("videoGenerationAsset", c.req.param("assetId"))
    if (!assetId) return c.json({ error: "not_found" }, 404)
    const [asset] = await db.select().from(VideoGenerationAssetTable).where(and(
      eq(VideoGenerationAssetTable.id, assetId),
      eq(VideoGenerationAssetTable.organization_id, payload.organization.id),
      eq(VideoGenerationAssetTable.org_membership_id, payload.currentMember.id),
      eq(VideoGenerationAssetTable.kind, "result_video"),
    )).limit(1)
    if (!asset) return c.json({ error: "not_found" }, 404)
    c.header("Content-Type", asset.content_type)
    c.header("Content-Length", String(asset.byte_length))
    c.header("Cache-Control", "private, max-age=300")
    c.header("ETag", `"${asset.result_hash}"`)
    c.header("X-Content-Type-Options", "nosniff")
    return c.body(Uint8Array.from(asset.result_bytes))
  })

  app.get("/v1/video-generation/admin/jobs", orgRoleRoute(["admin"]), async (c) => {
    const payload = c.get("organizationContext")
    if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
    const jobs = await db.select({
      id: VideoGenerationJobTable.id,
      orgMembershipId: VideoGenerationJobTable.org_membership_id,
      status: VideoGenerationJobTable.status,
      providerId: VideoGenerationJobTable.provider_id,
      providerTaskId: VideoGenerationJobTable.provider_task_id,
      licenseEvidenceId: VideoGenerationJobTable.license_evidence_id,
      priceVersion: VideoGenerationJobTable.price_version,
      settlement: VideoGenerationJobTable.settlement_status,
      taskHash: VideoGenerationJobTable.task_hash,
      resultHash: VideoGenerationJobTable.result_hash,
      aiProvenanceStatus: VideoGenerationJobTable.ai_provenance_status,
      aiProvenanceEvidence: VideoGenerationJobTable.ai_provenance_evidence,
      providerCostKind: VideoGenerationJobTable.provider_cost_kind,
      providerCostMicrounits: VideoGenerationJobTable.provider_cost_microunits,
      providerCostCurrency: VideoGenerationJobTable.provider_cost_currency,
      providerCostUnits: VideoGenerationJobTable.provider_cost_units,
      providerCostUnitCode: VideoGenerationJobTable.provider_cost_unit_code,
      costEvidenceReference: VideoGenerationJobTable.cost_evidence_reference,
      costEvidenceRecordedByOrgMembershipId: VideoGenerationJobTable.cost_evidence_recorded_by_org_membership_id,
      costEvidenceRecordedAt: VideoGenerationJobTable.cost_evidence_recorded_at,
      reviewStatus: VideoGenerationJobTable.review_status,
      reviewedByOrgMembershipId: VideoGenerationJobTable.reviewed_by_org_membership_id,
      reviewedAt: VideoGenerationJobTable.reviewed_at,
      reviewReason: VideoGenerationJobTable.review_reason,
      failureCode: VideoGenerationJobTable.failure_code,
      createdAt: VideoGenerationJobTable.created_at,
    }).from(VideoGenerationJobTable).where(eq(VideoGenerationJobTable.organization_id, payload.organization.id))
      .orderBy(desc(VideoGenerationJobTable.created_at)).limit(100)
    return c.json({ jobs: jobs.map((job) => ({
      ...job,
      costEvidenceRecordedAt: job.costEvidenceRecordedAt ? dateString(job.costEvidenceRecordedAt) : null,
      reviewedAt: job.reviewedAt ? dateString(job.reviewedAt) : null,
      createdAt: dateString(job.createdAt),
    })) })
  })

  app.put(
    "/v1/video-generation/admin/jobs/:jobId/cost-evidence",
    orgRoleRoute(["admin"]),
    jsonValidator(providerCostEvidenceSchema),
    async (c) => {
      const payload = c.get("organizationContext")
      if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
      const jobId = normalizedId("videoGenerationJob", c.req.param("jobId"))
      if (!jobId) return c.json({ error: "not_found" }, 404)
      const [job] = await db.select().from(VideoGenerationJobTable).where(and(
        eq(VideoGenerationJobTable.id, jobId),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
      )).limit(1)
      if (!job) return c.json({ error: "not_found" }, 404)
      if (!videoJobCanAcceptCostEvidence(job)) {
        return c.json({ error: "JOB_NOT_READY_FOR_COST_RECONCILIATION" }, 409)
      }
      const evidence = c.req.valid("json")
      const providerCost = evidence.providerCostKind === "money"
        ? {
            provider_cost_kind: evidence.providerCostKind,
            provider_cost_microunits: evidence.providerCostMicrounits,
            provider_cost_currency: evidence.providerCostCurrency,
            provider_cost_units: null,
            provider_cost_unit_code: null,
          }
        : {
            provider_cost_kind: evidence.providerCostKind,
            provider_cost_microunits: null,
            provider_cost_currency: null,
            provider_cost_units: evidence.providerCostUnits,
            provider_cost_unit_code: evidence.providerCostUnitCode,
          }
      await db.update(VideoGenerationJobTable).set({
        ...providerCost,
        cost_evidence_reference: evidence.costEvidenceReference,
        cost_evidence_recorded_by_org_membership_id: payload.currentMember.id,
        cost_evidence_recorded_at: new Date(),
      }).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
        eq(VideoGenerationJobTable.review_status, "pending_review"),
        isNull(VideoGenerationJobTable.provider_cost_kind),
        isNull(VideoGenerationJobTable.provider_cost_microunits),
        isNull(VideoGenerationJobTable.provider_cost_currency),
        isNull(VideoGenerationJobTable.provider_cost_units),
        isNull(VideoGenerationJobTable.provider_cost_unit_code),
        isNull(VideoGenerationJobTable.cost_evidence_reference),
        isNull(VideoGenerationJobTable.cost_evidence_recorded_by_org_membership_id),
        isNull(VideoGenerationJobTable.cost_evidence_recorded_at),
      ))
      const [recorded] = await db.select({
        providerCostKind: VideoGenerationJobTable.provider_cost_kind,
        providerCostMicrounits: VideoGenerationJobTable.provider_cost_microunits,
        providerCostCurrency: VideoGenerationJobTable.provider_cost_currency,
        providerCostUnits: VideoGenerationJobTable.provider_cost_units,
        providerCostUnitCode: VideoGenerationJobTable.provider_cost_unit_code,
        costEvidenceReference: VideoGenerationJobTable.cost_evidence_reference,
        recordedBy: VideoGenerationJobTable.cost_evidence_recorded_by_org_membership_id,
      }).from(VideoGenerationJobTable).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
      )).limit(1)
      const recordedCostMatches = evidence.providerCostKind === "money"
        ? recorded?.providerCostKind === evidence.providerCostKind
          && recorded.providerCostMicrounits === evidence.providerCostMicrounits
          && recorded.providerCostCurrency === evidence.providerCostCurrency
          && recorded.providerCostUnits === null
          && recorded.providerCostUnitCode === null
        : recorded?.providerCostKind === evidence.providerCostKind
          && recorded.providerCostMicrounits === null
          && recorded.providerCostCurrency === null
          && recorded.providerCostUnits === evidence.providerCostUnits
          && recorded.providerCostUnitCode === evidence.providerCostUnitCode
      if (
        !recordedCostMatches
        || recorded.costEvidenceReference !== evidence.costEvidenceReference
        || recorded.recordedBy !== payload.currentMember.id
      ) return c.json({ error: "COST_EVIDENCE_WRITE_CONFLICT" }, 409)
      return c.json({ recorded: true, jobId: job.id })
    },
  )

  app.put(
    "/v1/video-generation/admin/jobs/:jobId/review",
    orgRoleRoute(["admin"]),
    jsonValidator(videoReviewSchema),
    async (c) => {
      const payload = c.get("organizationContext")
      if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
      const jobId = normalizedId("videoGenerationJob", c.req.param("jobId"))
      if (!jobId) return c.json({ error: "not_found" }, 404)
      const [job] = await db.select().from(VideoGenerationJobTable).where(and(
        eq(VideoGenerationJobTable.id, jobId),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
      )).limit(1)
      if (!job) return c.json({ error: "not_found" }, 404)
      if (!videoJobHasReviewableDelivery(job) || job.review_status !== "pending_review") {
        return c.json({ error: "JOB_NOT_READY_FOR_REVIEW" }, 409)
      }
      const review = c.req.valid("json")
      const approvalBlocked = review.decision === "approved"
        ? videoJobApprovalBlockReason(job, payload.currentMember.id)
        : null
      if (approvalBlocked) return c.json({ error: approvalBlocked }, 409)
      await db.update(VideoGenerationJobTable).set({
        review_status: review.decision,
        reviewed_by_org_membership_id: payload.currentMember.id,
        reviewed_at: new Date(),
        review_reason: review.reason,
      }).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
        eq(VideoGenerationJobTable.review_status, "pending_review"),
      ))
      const [reviewed] = await db.select({
        reviewStatus: VideoGenerationJobTable.review_status,
        reviewedBy: VideoGenerationJobTable.reviewed_by_org_membership_id,
      }).from(VideoGenerationJobTable).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
      )).limit(1)
      if (reviewed?.reviewStatus !== review.decision || reviewed.reviewedBy !== payload.currentMember.id) {
        return c.json({ error: "REVIEW_WRITE_CONFLICT" }, 409)
      }
      return c.json({ reviewed: true, jobId: job.id, reviewStatus: review.decision })
    },
  )

  app.post("/v1/video-generation/admin/jobs/:jobId/release", orgRoleRoute(["admin"]), async (c) => {
    const payload = c.get("organizationContext")
    if (!organizationRouteEnabled(payload.organization.metadata)) return c.json({ error: "not_found" }, 404)
    const jobId = normalizedId("videoGenerationJob", c.req.param("jobId"))
    if (!jobId) return c.json({ error: "not_found" }, 404)
    const [job] = await db.select().from(VideoGenerationJobTable).where(and(
      eq(VideoGenerationJobTable.id, jobId),
      eq(VideoGenerationJobTable.organization_id, payload.organization.id),
    )).limit(1)
    if (!job) return c.json({ error: "not_found" }, 404)
    const abandonedBefore = new Date(Date.now() - ABANDONED_SUBMISSION_CLAIM_MS)
    const abandonedClaim = job.submission_claim
    const abandonedClaimedAt = job.submission_claimed_at
    if (!videoJobCanBeReleasedSafely(job, abandonedBefore) || !abandonedClaim || !abandonedClaimedAt) {
      return c.json({ error: "JOB_NOT_SAFE_TO_RELEASE" }, 409)
    }
    const releaseClaim = createDenTypeId("request")
    await db.update(VideoGenerationJobTable).set({ submission_claim: releaseClaim }).where(and(
        eq(VideoGenerationJobTable.id, job.id),
        eq(VideoGenerationJobTable.organization_id, payload.organization.id),
        eq(VideoGenerationJobTable.settlement_status, "reserved"),
        isNull(VideoGenerationJobTable.provider_task_id),
        eq(VideoGenerationJobTable.submission_claim, abandonedClaim),
        lte(VideoGenerationJobTable.submission_claimed_at, abandonedBefore),
      ))
    const [claimedForRelease] = await db.select({
      submissionClaim: VideoGenerationJobTable.submission_claim,
      providerTaskId: VideoGenerationJobTable.provider_task_id,
      settlement: VideoGenerationJobTable.settlement_status,
    }).from(VideoGenerationJobTable).where(and(
      eq(VideoGenerationJobTable.id, job.id),
      eq(VideoGenerationJobTable.organization_id, payload.organization.id),
    )).limit(1)
    if (
      claimedForRelease?.submissionClaim !== releaseClaim ||
      claimedForRelease.providerTaskId !== null ||
      claimedForRelease.settlement !== "reserved"
    ) return c.json({ error: "JOB_NOT_SAFE_TO_RELEASE" }, 409)
    const failed = await failJob(job, "ADMIN_NO_PROVIDER_TASK_RELEASE")
    if (!failed) return c.json({ error: "not_found" }, 404)
    return c.json({ released: true, jobId: failed.id })
  })
}
