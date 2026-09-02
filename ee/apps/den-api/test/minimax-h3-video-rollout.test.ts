import { describe, expect, test } from "bun:test"
import { organizationMinimaxH3VideoEnabled } from "../src/capability-sources/minimax-h3-video-rollout.js"

const readyEnvironment = {
  RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED: "true",
  RENWORK_METASO_H3_API_KEY: "server-secret",
  RENWORK_METASO_H3_RESULT_HOSTS: "cdn.example.test",
  RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND: "1000",
  RENWORK_H3_PRICE_VERSION: "h3-phase1-v1",
}

describe("H3 organization rollout", () => {
  test("fails closed without separately confirmed commercial authorization", () => {
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      { ...readyEnvironment, RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED: "false" },
    )).toBe(false)
  })

  test("requires both platform gray approval and complete server configuration", () => {
    expect(organizationMinimaxH3VideoEnabled({ capabilities: { minimaxH3Video: false } }, readyEnvironment)).toBe(false)
    expect(organizationMinimaxH3VideoEnabled({ capabilities: { minimaxH3Video: true } }, readyEnvironment)).toBe(true)
    expect(organizationMinimaxH3VideoEnabled(
      { capabilities: { minimaxH3Video: true } },
      { ...readyEnvironment, RENWORK_METASO_H3_RESULT_HOSTS: "" },
    )).toBe(false)
  })
})
