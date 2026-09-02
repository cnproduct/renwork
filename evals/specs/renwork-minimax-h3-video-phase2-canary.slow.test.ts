import { expect } from "vitest"
import { denFetch, evalIn, freshSession, go, waitFor } from "@openwork/behaviors"
import type { DenSession } from "@openwork/behaviors"
import { app, needs, server, test, unmetNeeds } from "@openwork/testkit"
import type { NeedsSpec } from "@openwork/testkit"

const requirements: NeedsSpec = {
  env: [
    "OPENWORK_EVAL_DEN_API_URL",
    "RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED",
    "RENWORK_METASO_H3_LICENSE_EVIDENCE_ID",
    "RENWORK_METASO_H3_API_KEY",
    "RENWORK_METASO_H3_BASE_URL",
    "RENWORK_METASO_H3_RESULT_HOSTS",
    "RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND",
    "RENWORK_H3_PRICE_VERSION",
    "RENWORK_H3_CANARY_ORGANIZATION_ID",
    "RENWORK_H3_CANARY_T2V_PROMPT",
    "RENWORK_H3_CANARY_I2V_ASSET_ID",
    "RENWORK_H3_CANARY_T2V_PROVIDER_COST_MICROUNITS",
    "RENWORK_H3_CANARY_T2V_COST_EVIDENCE_REFERENCE",
    "RENWORK_H3_CANARY_I2V_PROVIDER_COST_MICROUNITS",
    "RENWORK_H3_CANARY_I2V_COST_EVIDENCE_REFERENCE",
    "RENWORK_H3_CANARY_PROVIDER_COST_CURRENCY",
    "OPENWORK_EVAL_H3_REVIEWER_EMAIL",
    "OPENWORK_EVAL_H3_REVIEWER_PASSWORD",
  ],
  optIn: ["OPENWORK_EVAL_APP_SPECS", "OPENWORK_EVAL_H3_LIVE_CANARY", "RENWORK_H3_LIVE_CANARY"],
}
const missingRequirements = unmetNeeds(requirements, process.env)
const title = missingRequirements.length > 0
  ? `MiniMax H3 Phase 2 live canary skipped — INCOMPLETE needs: ${missingRequirements.join(", ")}`
  : "one authorized organization completes reviewed 4-second T2V and I2V MiniMax H3 canaries"

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected object, received ${JSON.stringify(value)}`)
  }
  return value as JsonRecord
}

function text(value: unknown, key: string) {
  const candidate = record(value)[key]
  if (typeof candidate !== "string" || !candidate) throw new Error(`Missing ${key}: ${JSON.stringify(value)}`)
  return candidate
}

function nonnegativeIntegerFromEnvironment(name: string) {
  const value = Number(process.env[name])
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative safe integer`)
  return value
}

function organizationMembers(value: unknown) {
  const members = record(value).members
  if (!Array.isArray(members)) throw new Error(`Organization members missing: ${JSON.stringify(value)}`)
  return members.map(record)
}

async function promoteReviewer(admin: DenSession, reviewer: DenSession, orgId: string) {
  const org = await denFetch(admin, "/v1/org", {
    headers: { authorization: `Bearer ${admin.token}`, "x-openwork-org-id": orgId },
  })
  expect(org.response.status).toBe(200)
  const membership = organizationMembers(org.body).find((candidate) => {
    const user = candidate.user
    return typeof user === "object" && user !== null && record(user).email === reviewer.email
  })
  if (!membership) throw new Error(`Reviewer ${reviewer.email} is not a member of ${orgId}`)
  const privilegedAdmin = await freshSession(admin)
  const promoted = await denFetch(privilegedAdmin, `/v1/members/${encodeURIComponent(text(membership, "id"))}/role`, {
    method: "POST",
    headers: { authorization: `Bearer ${privilegedAdmin.token}`, "x-openwork-org-id": orgId },
    body: JSON.stringify({ role: "admin" }),
  })
  expect(promoted.response.status).toBe(200)
}

async function attachCostAndApprove(input: {
  costEvidenceReference: string
  currency: string
  jobId: string
  operator: DenSession
  providerCostMicrounits: number
  reviewer: DenSession
  orgId: string
}) {
  const headers = (session: DenSession) => ({
    authorization: `Bearer ${session.token}`,
    "content-type": "application/json",
    "x-openwork-organization-id": input.orgId,
  })
  const recorded = await denFetch(input.operator, `/v1/video-generation/admin/jobs/${encodeURIComponent(input.jobId)}/cost-evidence`, {
    method: "PUT",
    headers: headers(input.operator),
    body: JSON.stringify({
      providerCostMicrounits: input.providerCostMicrounits,
      providerCostCurrency: input.currency,
      costEvidenceReference: input.costEvidenceReference,
    }),
  })
  expect(recorded.response.status).toBe(200)
  const approved = await denFetch(input.reviewer, `/v1/video-generation/admin/jobs/${encodeURIComponent(input.jobId)}/review`, {
    method: "PUT",
    headers: headers(input.reviewer),
    body: JSON.stringify({ decision: "approved", reason: "Phase 2 canary cost, settlement, provenance, and tenant evidence reviewed." }),
  })
  expect(approved.response.status).toBe(200)
}

async function waitForTerminalJob(session: DenSession, jobId: string) {
  const deadline = Date.now() + 15 * 60_000
  while (Date.now() < deadline) {
    const response = await denFetch(session, `/v1/video-generation/jobs/${encodeURIComponent(jobId)}`, {
      headers: { authorization: `Bearer ${session.token}` },
    })
    expect(response.response.status).toBe(200)
    const job = record(record(response.body).job)
    if (job.status === "succeeded" || job.status === "failed") return job
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
  throw new Error(`H3 canary ${jobId} did not settle within 15 minutes`)
}

test(title, async ({ evidence, place }) => {
  needs(requirements)
  await using den = await server({
    place,
    reuseMembers: {
      reviewer: {
        email: process.env.OPENWORK_EVAL_H3_REVIEWER_EMAIL,
        password: process.env.OPENWORK_EVAL_H3_REVIEWER_PASSWORD,
      },
    },
  })
  const orgId = process.env.RENWORK_H3_CANARY_ORGANIZATION_ID!.trim()
  const reviewer = den.members.reviewer
  if (!reviewer) throw new Error("The Phase 2 four-eyes reviewer session was not provisioned")
  await promoteReviewer(den.admin, reviewer, orgId)
  const orgs = await denFetch(den.admin, "/v1/me/orgs", {
    headers: { authorization: `Bearer ${den.admin.token}` },
  })
  expect(orgs.response.status).toBe(200)
  expect(JSON.stringify(orgs.body)).toContain(orgId)

  const capability = await denFetch(den.admin, "/v1/video-generation/capabilities", {
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "x-openwork-organization-id": orgId,
    },
  })
  expect(capability.response.status).toBe(200)
  expect(record(capability.body).enabled).toBe(true)
  evidence.fact(
    "Frame 1-3 — written authorization and exact pilot organization opened the preproduction route",
    `organization=${orgId}; licenseEvidence=${process.env.RENWORK_METASO_H3_LICENSE_EVIDENCE_ID}; priceVersion=${process.env.RENWORK_H3_PRICE_VERSION}; maximumConcurrentJobs=1`,
    true,
  )

  await using desktopApp = await app({ den, as: "admin", place })
  await go(desktopApp, `/workspace/${desktopApp.workspaceId}/video`)
  await waitFor(desktopApp, `Boolean(document.querySelector('[data-testid="video-generation-page"]'))`, {
    timeoutMs: 60_000,
    label: "H3 video generation surface",
  })
  const supplierLeak = await evalIn(desktopApp, `(() => {
    const text = document.body.innerText.toLowerCase();
    return /metaso|api.?key|bearer|provider.?config/.test(text);
  })()`)
  expect(supplierLeak).toBe(false)

  const t2vQuote = await denFetch(den.admin, "/v1/video-generation/quotes", {
    method: "POST",
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "content-type": "application/json",
      "x-openwork-organization-id": orgId,
    },
    body: JSON.stringify({
      mode: "text_to_video",
      resolution: "768P",
      durationSeconds: 4,
      aspectRatio: "16:9",
      prompt: process.env.RENWORK_H3_CANARY_T2V_PROMPT,
    }),
  })
  expect(t2vQuote.response.status).toBe(200)
  const quoteId = text(record(t2vQuote.body).quote, "id")
  const idempotencyKey = `h3-phase2-t2v-${Date.now()}`
  const createT2v = () => denFetch(den.admin, "/v1/video-generation/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-openwork-organization-id": orgId,
    },
    body: JSON.stringify({ quoteId, confirmed: true }),
  })
  const [firstSubmit, retriedSubmit] = await Promise.all([createT2v(), createT2v()])
  expect(firstSubmit.response.status).toBe(200)
  const firstJob = record(record(firstSubmit.body).job)
  const replay = retriedSubmit.response.status === 409 ? await createT2v() : retriedSubmit
  expect(replay.response.status).toBe(200)
  const retriedJob = record(record(replay.body).job)
  expect(text(firstJob, "id")).toBe(text(retriedJob, "id"))
  const t2v = await waitForTerminalJob(den.admin, text(firstJob, "id"))
  expect(t2v.status).toBe("succeeded")
  expect(t2v.settlementStatus).toBe("captured")
  expect(text(t2v, "taskHash")).toMatch(/^[a-f0-9]{64}$/)
  expect(text(t2v, "resultHash")).toMatch(/^[a-f0-9]{64}$/)
  const receipts = await denFetch(den.admin, "/v1/rencredit/receipts?limit=100", {
    headers: { authorization: `Bearer ${den.admin.token}`, "x-openwork-organization-id": orgId },
  })
  expect(receipts.response.status).toBe(200)
  const receiptRows = record(receipts.body).receipts
  if (!Array.isArray(receiptRows)) throw new Error(`RenCredit receipts missing: ${JSON.stringify(receipts.body)}`)
  expect(receiptRows.map(record).filter((receipt) => receipt.run_id === `video:${idempotencyKey}`)).toHaveLength(1)
  evidence.fact(
    "Frame 4 and 6 — real 4-second 768P T2V settled once across a concurrent retry",
    `job=${t2v.id}; taskHash=${t2v.taskHash}; resultHash=${t2v.resultHash}; settlement=${t2v.settlementStatus}`,
    true,
  )

  const i2vQuote = await denFetch(den.admin, "/v1/video-generation/quotes", {
    method: "POST",
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "content-type": "application/json",
      "x-openwork-organization-id": orgId,
    },
    body: JSON.stringify({
      mode: "first_frame_to_video",
      resolution: "768P",
      durationSeconds: 4,
      aspectRatio: "16:9",
      prompt: "Keep the tenant-owned first frame recognizable, preserve product geometry, and add one restrained cinematic camera move.",
      firstFrameAssetId: process.env.RENWORK_H3_CANARY_I2V_ASSET_ID,
    }),
  })
  expect(i2vQuote.response.status).toBe(200)
  const i2vQuoteId = text(record(i2vQuote.body).quote, "id")
  const i2vSubmit = await denFetch(den.admin, "/v1/video-generation/jobs", {
    method: "POST",
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "content-type": "application/json",
      "idempotency-key": `h3-phase2-i2v-${Date.now()}`,
      "x-openwork-organization-id": orgId,
    },
    body: JSON.stringify({ quoteId: i2vQuoteId, confirmed: true }),
  })
  expect(i2vSubmit.response.status).toBe(200)
  const i2v = await waitForTerminalJob(den.admin, text(record(i2vSubmit.body).job, "id"))
  expect(i2v.status).toBe("succeeded")
  expect(i2v.aiProvenanceStatus).toBe("preserved")
  evidence.fact(
    "Frame 5 — tenant-owned first-frame I2V passed official payload, delivery, container, hash, and provenance checks",
    `job=${i2v.id}; resultHash=${i2v.resultHash}; provenance=${i2v.aiProvenanceStatus}`,
    true,
  )

  await attachCostAndApprove({
    operator: den.admin,
    reviewer,
    orgId,
    jobId: text(t2v, "id"),
    providerCostMicrounits: nonnegativeIntegerFromEnvironment("RENWORK_H3_CANARY_T2V_PROVIDER_COST_MICROUNITS"),
    currency: process.env.RENWORK_H3_CANARY_PROVIDER_COST_CURRENCY!.trim(),
    costEvidenceReference: process.env.RENWORK_H3_CANARY_T2V_COST_EVIDENCE_REFERENCE!.trim(),
  })
  await attachCostAndApprove({
    operator: den.admin,
    reviewer,
    orgId,
    jobId: text(i2v, "id"),
    providerCostMicrounits: nonnegativeIntegerFromEnvironment("RENWORK_H3_CANARY_I2V_PROVIDER_COST_MICROUNITS"),
    currency: process.env.RENWORK_H3_CANARY_PROVIDER_COST_CURRENCY!.trim(),
    costEvidenceReference: process.env.RENWORK_H3_CANARY_I2V_COST_EVIDENCE_REFERENCE!.trim(),
  })

  const audits = await denFetch(den.admin, "/v1/video-generation/admin/jobs", {
    headers: {
      authorization: `Bearer ${den.admin.token}`,
      "x-openwork-organization-id": orgId,
    },
  })
  expect(audits.response.status).toBe(200)
  const auditText = JSON.stringify(audits.body)
  expect(auditText).toContain(process.env.RENWORK_METASO_H3_LICENSE_EVIDENCE_ID)
  expect(auditText).not.toContain(process.env.RENWORK_METASO_H3_API_KEY)
  const auditJobs = record(audits.body).jobs
  if (!Array.isArray(auditJobs)) throw new Error(`Admin jobs missing: ${JSON.stringify(audits.body)}`)
  for (const jobId of [text(t2v, "id"), text(i2v, "id")]) {
    const matching = auditJobs.map(record).filter((job) => job.id === jobId)
    expect(matching).toHaveLength(1)
    expect(matching[0]?.providerTaskId).toBeTruthy()
    expect(matching[0]?.settlement).toBe("captured")
    expect(matching[0]?.reviewStatus).toBe("approved")
    expect(matching[0]?.providerCostMicrounits).toEqual(expect.any(Number))
    expect(matching[0]?.costEvidenceReference).toEqual(expect.any(String))
  }
  evidence.fact(
    "Frame 7-8 — admin evidence is secret-safe, cost-reconciled, tenant-scoped, and approved by a second administrator",
    "Failure-path proof is exercised by deterministic provider tests; both live jobs have one supplier task, captured settlement, actual-cost evidence, and approved four-eyes review without exposing the API key.",
    true,
  )
})
