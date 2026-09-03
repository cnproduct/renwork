import { describe, expect, test } from "bun:test"
import { organizationMinimaxH3VideoEnabled } from "../src/capability-sources/minimax-h3-video-rollout.js"

const readyEnvironment = {
  RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED: "true",
  RENWORK_METASO_H3_LICENSE_EVIDENCE_ID: "license-evidence-2026-09-01",
  RENWORK_METASO_H3_API_KEY: "server-secret",
  RENWORK_METASO_H3_BASE_URL: "https://api.example.test",
  RENWORK_METASO_H3_RESULT_HOSTS: "cdn.example.test",
  RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND: "1000",
  RENWORK_H3_PRICE_VERSION: "h3-phase2-canary-v1",
  RENWORK_H3_LIVE_CANARY: "1",
  RENWORK_H3_CANARY_ORGANIZATION_ID: "org_canary",
}

describe("H3 organization rollout", () => {
  test("fails closed without separately confirmed commercial authorization", () => {
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      "org_canary",
      { ...readyEnvironment, RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED: "false" },
    )).toBe(false)
  })

  test("requires both platform gray approval and complete server configuration", () => {
    expect(organizationMinimaxH3VideoEnabled({ capabilities: { minimaxH3Video: false } }, "org_canary", readyEnvironment)).toBe(false)
    expect(organizationMinimaxH3VideoEnabled({ capabilities: { minimaxH3Video: true } }, "org_canary", readyEnvironment)).toBe(true)
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      "org_canary",
      { ...readyEnvironment, RENWORK_METASO_H3_RESULT_HOSTS: "" },
    )).toBe(false)
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      "org_canary",
      { ...readyEnvironment, RENWORK_METASO_H3_BASE_URL: "" },
    )).toBe(false)
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      "org_canary",
      { ...readyEnvironment, RENWORK_METASO_H3_BASE_URL: "http://provider.example.test" },
    )).toBe(false)
  })

  test("requires evidence, explicit live opt-in, and the exact canary organization", () => {
    const metadata = { capabilities: { minimaxH3Video: true } }
    expect(organizationMinimaxH3VideoEnabled(
      metadata,
      "org_canary",
      { ...readyEnvironment, RENWORK_METASO_H3_LICENSE_EVIDENCE_ID: "" },
    )).toBe(false)
    expect(organizationMinimaxH3VideoEnabled(
      metadata,
      "org_canary",
      { ...readyEnvironment, RENWORK_H3_LIVE_CANARY: "0" },
    )).toBe(false)
    expect(organizationMinimaxH3VideoEnabled(metadata, "org_other", readyEnvironment)).toBe(false)
  })
})
