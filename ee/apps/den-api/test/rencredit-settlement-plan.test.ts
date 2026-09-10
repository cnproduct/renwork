import { describe, expect, test } from "bun:test"
import { planInferenceSettlement } from "../src/rencredit-settlement-plan.js"

describe("RenCredit inference settlement plan", () => {
  test("captures inside the reservation and releases the unused balance", () => {
    expect(planInferenceSettlement({
      walletAvailableMicroCredits: 900,
      walletReservedMicroCredits: 100,
      walletVersion: 4,
      reservationReservedMicroCredits: 100,
      computedMicroCredits: 60,
      hasResult: true,
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
      hasResult: true,
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
      hasResult: false,
    })
    expect(plan.capturedMicroCredits).toBe(0)
    expect(plan.additionalChargeMicroCredits).toBe(0)
    expect(plan.releasedMicroCredits).toBe(100)
    expect(plan.availableBalanceAfterSettlement).toBe(1_000)
  })
})
