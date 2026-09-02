export const AI_PROVENANCE_EVIDENCE = "AI_GENERATED_PROVENANCE_PRESERVED"

type ReleaseCandidate = {
  settlement_status: string
  provider_task_id: string | null
  submission_claim: string | null
  submission_claimed_at: Date | string | null
}

type ReviewCandidate = {
  license_evidence_id: string | null
  status: string
  settlement_status: string
  result_asset_id: string | null
  result_hash: string | null
  ai_provenance_status: string
  ai_provenance_evidence: string | null
  review_status: string
  provider_cost_microunits: number | null
  provider_cost_currency: string | null
  cost_evidence_reference: string | null
  cost_evidence_recorded_by_org_membership_id: string | null
  cost_evidence_recorded_at: Date | string | null
}

export function videoJobCanBeReleasedSafely(job: ReleaseCandidate, abandonedBefore: Date) {
  return job.settlement_status === "reserved"
    && job.provider_task_id === null
    && job.submission_claim !== null
    && job.submission_claimed_at !== null
    && new Date(job.submission_claimed_at) <= abandonedBefore
}

export function videoJobHasReviewableDelivery(job: ReviewCandidate) {
  return job.license_evidence_id !== null
    && job.status === "succeeded"
    && job.settlement_status === "captured"
    && job.result_asset_id !== null
    && job.result_hash !== null
    && job.ai_provenance_status === "preserved"
    && job.ai_provenance_evidence === AI_PROVENANCE_EVIDENCE
}

export function videoJobCanAcceptCostEvidence(job: ReviewCandidate) {
  return videoJobHasReviewableDelivery(job)
    && job.review_status === "pending_review"
    && job.provider_cost_microunits === null
    && job.provider_cost_currency === null
    && job.cost_evidence_reference === null
    && job.cost_evidence_recorded_by_org_membership_id === null
    && job.cost_evidence_recorded_at === null
}

export function videoJobApprovalBlockReason(job: ReviewCandidate, reviewerMembershipId: string) {
  if (!videoJobHasReviewableDelivery(job) || job.review_status !== "pending_review") return "JOB_NOT_READY_FOR_REVIEW"
  if (
    job.provider_cost_microunits === null
    || job.provider_cost_currency === null
    || job.cost_evidence_reference === null
    || job.cost_evidence_recorded_by_org_membership_id === null
    || job.cost_evidence_recorded_at === null
  ) return "PROVIDER_COST_EVIDENCE_REQUIRED"
  if (job.cost_evidence_recorded_by_org_membership_id === reviewerMembershipId) return "FOUR_EYES_REVIEWER_REQUIRED"
  return null
}
