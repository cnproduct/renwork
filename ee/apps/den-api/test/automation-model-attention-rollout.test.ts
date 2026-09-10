import { describe, expect, test } from "bun:test"
import { shouldApplyAutomationModelAccessFailure } from "../src/automations/model-attention-rollout.js"

const legacyFreeModel = { providerId: "opencode", modelId: "big-pickle" }

describe("Automation model-attention rollout", () => {
  test("blocks the legacy free model for published clients", () => {
    expect(shouldApplyAutomationModelAccessFailure({
      model: legacyFreeModel,
      failure: { code: "model_access_lost" },
      modelAttentionCapable: false,
    })).toBe(true)
  })

  test("applies the legacy free-model policy loss after capability advertisement", () => {
    expect(shouldApplyAutomationModelAccessFailure({
      model: legacyFreeModel,
      failure: { code: "model_access_lost" },
      modelAttentionCapable: true,
    })).toBe(true)
  })

  test("keeps non-rollout authority losses fail-closed for every client", () => {
    expect(shouldApplyAutomationModelAccessFailure({
      model: legacyFreeModel,
      failure: { code: "owner_membership_lost" },
      modelAttentionCapable: false,
    })).toBe(true)
    expect(shouldApplyAutomationModelAccessFailure({
      model: { providerId: "lpr_team", modelId: "removed-model" },
      failure: { code: "model_access_lost" },
      modelAttentionCapable: false,
    })).toBe(true)
  })
})
