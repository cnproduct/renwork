import { describe, expect, test } from "bun:test"
import {
  planInferenceSettlement,
  shouldCaptureInferenceUsage,
} from "../src/rencredit-settlement-plan.js"

const zeroUsage = { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

describe("RenCredit inference settlement plan", () => {
  test("captures inside the reservation and releases the unused balance", () => {
    expect(planInferenceSettlement({
      walletAvailableMicroCredits: 900,
      walletReservedMicroCredits: 100,
      walletVersion: 4,
      reservationReservedMicroCredits: 100,
      computedMicroCredits: 60,
      captureUsage: true,
    })).toEqual({
      capturedMicroCredits: 60,
      capturedFromReservationMicroCredits: 60,
      additionalChargeMicroCredits: 0,
      releasedMicroCredits: 40,
      reservedBalanceAfter: 0,
      availableBalanceAfterCapture: 940,
      availableBalanceAfterSettlement: 940,
      captureWalletVersion: 5,
      finalWalletVersion: 5,
    })
  })

  test("records full token cost and separates overage from the frozen capture", () => {
    expect(planInferenceSettlement({
      walletAvailableMicroCredits: 900,
      walletReservedMicroCredits: 100,
      walletVersion: 4,
      reservationReservedMicroCredits: 100,
      computedMicroCredits: 140,
      captureUsage: true,
    })).toEqual({
      capturedMicroCredits: 140,
      capturedFromReservationMicroCredits: 100,
      additionalChargeMicroCredits: 40,
      releasedMicroCredits: 0,
      reservedBalanceAfter: 0,
      availableBalanceAfterCapture: 900,
      availableBalanceAfterSettlement: 860,
      captureWalletVersion: 5,
      finalWalletVersion: 6,
    })
  })

  test("releases the full reservation when no usable result exists", () => {
    const plan = planInferenceSettlement({
      walletAvailableMicroCredits: 900,
      walletReservedMicroCredits: 100,
      walletVersion: 4,
      reservationReservedMicroCredits: 100,
      computedMicroCredits: 140,
      captureUsage: false,
    })
    expect(plan.capturedMicroCredits).toBe(0)
    expect(plan.additionalChargeMicroCredits).toBe(0)
    expect(plan.releasedMicroCredits).toBe(100)
    expect(plan.availableBalanceAfterSettlement).toBe(1_000)
  })

  test("captures provider-reported reasoning tokens without visible content", () => {
    expect(shouldCaptureInferenceUsage({
      usage: { ...zeroUsage, inputTokens: 12, reasoningTokens: 32 },
      accuracy: "reported",
      hasResult: false,
    })).toBe(true)
  })

  test("captures tokenizer-measured usage after a local runtime truncation", () => {
    expect(shouldCaptureInferenceUsage({
      usage: { ...zeroUsage, outputTokens: 8 },
      accuracy: "tokenizer",
      hasResult: false,
    })).toBe(true)
  })

  test("releases when neither a result nor measured token use exists", () => {
    expect(shouldCaptureInferenceUsage({ usage: zeroUsage, accuracy: "reported", hasResult: false })).toBe(false)
    expect(shouldCaptureInferenceUsage({
      usage: { ...zeroUsage, inputTokens: 100 },
      accuracy: "estimated",
      hasResult: false,
    })).toBe(false)
  })

  test("captures an estimated response when user-visible content exists", () => {
    expect(shouldCaptureInferenceUsage({
      usage: { ...zeroUsage, inputTokens: 100 },
      accuracy: "estimated",
      hasResult: true,
    })).toBe(true)
  })
})
