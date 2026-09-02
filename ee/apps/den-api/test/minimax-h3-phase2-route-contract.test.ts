import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import {
  AI_PROVENANCE_EVIDENCE,
  videoJobApprovalBlockReason,
  videoJobCanAcceptCostEvidence,
  videoJobCanBeReleasedSafely,
  videoJobHasReviewableDelivery,
} from "../src/minimax-h3-video-policy.js"

const routeSource = readFileSync(new URL("../src/routes/org/video-generation.ts", import.meta.url), "utf8")

const pendingReviewJob = {
  license_evidence_id: "license-evidence-2026-09-01",
  status: "succeeded",
  settlement_status: "captured",
  result_asset_id: "asset_1",
  result_hash: "a".repeat(64),
  ai_provenance_status: "preserved",
  ai_provenance_evidence: AI_PROVENANCE_EVIDENCE,
  review_status: "pending_review",
  provider_cost_microunits: null,
  provider_cost_currency: null,
  cost_evidence_reference: null,
  cost_evidence_recorded_by_org_membership_id: null,
  cost_evidence_recorded_at: null,
}

describe("MiniMax H3 Phase 2 route policy", () => {
  test("acceptance stays pending until immutable cost evidence and a second reviewer exist", () => {
    expect(videoJobHasReviewableDelivery(pendingReviewJob)).toBe(true)
    expect(videoJobHasReviewableDelivery({ ...pendingReviewJob, license_evidence_id: null })).toBe(false)
    expect(videoJobCanAcceptCostEvidence(pendingReviewJob)).toBe(true)
    expect(videoJobApprovalBlockReason(pendingReviewJob, "member_reviewer")).toBe("PROVIDER_COST_EVIDENCE_REQUIRED")

    const reconciled = {
      ...pendingReviewJob,
      provider_cost_microunits: 120_000,
      provider_cost_currency: "CNY",
      cost_evidence_reference: "metaso-invoice:2026-09:line-14",
      cost_evidence_recorded_by_org_membership_id: "member_cost_recorder",
      cost_evidence_recorded_at: new Date("2026-09-01T00:00:00.000Z"),
    }
    expect(videoJobCanAcceptCostEvidence(reconciled)).toBe(false)
    expect(videoJobApprovalBlockReason(reconciled, "member_cost_recorder")).toBe("FOUR_EYES_REVIEWER_REQUIRED")
    expect(videoJobApprovalBlockReason(reconciled, "member_reviewer")).toBeNull()
  })

  test("manual release is limited to an abandoned claim with no provider task", () => {
    const cutoff = new Date("2026-09-01T00:05:00.000Z")
    const abandoned = {
      settlement_status: "reserved",
      provider_task_id: null,
      submission_claim: "claim_1",
      submission_claimed_at: new Date("2026-09-01T00:00:00.000Z"),
    }
    expect(videoJobCanBeReleasedSafely(abandoned, cutoff)).toBe(true)
    expect(videoJobCanBeReleasedSafely({ ...abandoned, provider_task_id: "provider_task_1" }, cutoff)).toBe(false)
    expect(videoJobCanBeReleasedSafely({ ...abandoned, settlement_status: "captured" }, cutoff)).toBe(false)
    expect(videoJobCanBeReleasedSafely({ ...abandoned, submission_claimed_at: new Date("2026-09-01T00:05:01.000Z") }, cutoff)).toBe(false)
  })

  test("route keeps double-submit, tenant, failure, and secret boundaries explicit", () => {
    const memberProjection = routeSource.slice(
      routeSource.indexOf("async function memberJob"),
      routeSource.indexOf("async function loadMemberJob"),
    )
    const failurePath = routeSource.slice(
      routeSource.indexOf("async function failJob"),
      routeSource.indexOf("async function alignJobWithSettledReservation"),
    )
    const deliverySettlement = routeSource.slice(
      routeSource.indexOf("if (persistenceFailure)"),
      routeSource.indexOf("function phaseOneInputSnapshot"),
    )

    expect(routeSource).toContain("VideoGenerationJobTable.idempotency_key")
    expect(routeSource).toContain("isNull(VideoGenerationJobTable.provider_task_id)")
    expect(routeSource).toContain("isNull(VideoGenerationJobTable.submission_claim)")
    expect(routeSource).toContain("eq(VideoGenerationJobTable.submission_claim, submissionClaim)")
    expect(routeSource.match(/provider\.submit\(/g)).toHaveLength(1)
    expect(routeSource).toContain("eq(VideoGenerationJobTable.organization_id, payload.organization.id)")
    expect(routeSource).toContain("eq(VideoGenerationJobTable.org_membership_id, payload.currentMember.id)")

    expect(failurePath.indexOf("releaseProductCredits")).toBeLessThan(failurePath.indexOf("db.delete(VideoGenerationAssetTable)"))
    expect(failurePath).toContain("result_asset_id: null")
    expect(failurePath).toContain("result_hash: null")
    expect(failurePath).not.toContain("captureProductCredits")
    expect(routeSource.match(/db\.delete\(VideoGenerationAssetTable\)/g)).toHaveLength(2)
    expect(deliverySettlement.indexOf("ai_provenance_status")).toBeLessThan(deliverySettlement.indexOf("captureProductCredits"))
    expect(deliverySettlement).toContain('review_status: "pending_review"')

    expect(memberProjection).toContain("settlementStatus")
    expect(memberProjection).toContain("aiProvenanceStatus")
    expect(memberProjection).toContain("reviewStatus")
    expect(memberProjection).not.toContain("license_evidence_id")
    expect(memberProjection).not.toContain("provider_cost_microunits")
    expect(memberProjection).not.toContain("cost_evidence_reference")
    expect(memberProjection).not.toContain("provider_task_id")
  })
})
