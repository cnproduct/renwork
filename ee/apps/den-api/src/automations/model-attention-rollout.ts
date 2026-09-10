type ModelSelection = { providerId: string; modelId: string }
type ModelAccessFailure = {
  code: "owner_membership_lost" | "model_access_lost" | "provider_unavailable"
}

/** V38 applies every model-authority loss immediately, including legacy clients. */
export function shouldApplyAutomationModelAccessFailure(input: {
  model: ModelSelection
  failure: ModelAccessFailure
  modelAttentionCapable: boolean
}): boolean {
  void input
  return true
}
