export type InferenceSettlementPlan = {
  capturedMicroCredits: number
  capturedFromReservationMicroCredits: number
  additionalChargeMicroCredits: number
  releasedMicroCredits: number
  reservedBalanceAfter: number
  availableBalanceAfterCapture: number
  availableBalanceAfterSettlement: number
  captureWalletVersion: number
  finalWalletVersion: number
}

function nonNegativeSafeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer`)
}

/**
 * Plans an inference settlement without hiding provider-reported overage in a
 * single capture row. The reservation is captured first; any amount above it
 * becomes a separate adjustment while the receipt still records full usage.
 */
export function planInferenceSettlement(input: {
  walletAvailableMicroCredits: number
  walletReservedMicroCredits: number
  walletVersion: number
  reservationReservedMicroCredits: number
  computedMicroCredits: number
  hasResult: boolean
}): InferenceSettlementPlan {
  nonNegativeSafeInteger(input.walletReservedMicroCredits, "walletReservedMicroCredits")
  nonNegativeSafeInteger(input.walletVersion, "walletVersion")
  nonNegativeSafeInteger(input.reservationReservedMicroCredits, "reservationReservedMicroCredits")
  nonNegativeSafeInteger(input.computedMicroCredits, "computedMicroCredits")
  if (!Number.isSafeInteger(input.walletAvailableMicroCredits)) throw new Error("walletAvailableMicroCredits must be a safe integer")
  if (input.walletReservedMicroCredits < input.reservationReservedMicroCredits) {
    throw new Error("RENCREDIT_RESERVED_BALANCE_INVALID")
  }

  const capturedMicroCredits = input.hasResult ? input.computedMicroCredits : 0
  const capturedFromReservationMicroCredits = Math.min(capturedMicroCredits, input.reservationReservedMicroCredits)
  const additionalChargeMicroCredits = capturedMicroCredits - capturedFromReservationMicroCredits
  const releasedMicroCredits = input.reservationReservedMicroCredits - capturedFromReservationMicroCredits
  const reservedBalanceAfter = input.walletReservedMicroCredits - input.reservationReservedMicroCredits
  const availableBalanceAfterCapture = input.walletAvailableMicroCredits + releasedMicroCredits
  const availableBalanceAfterSettlement = availableBalanceAfterCapture - additionalChargeMicroCredits
  const captureWalletVersion = input.walletVersion + 1
  const finalWalletVersion = captureWalletVersion + (additionalChargeMicroCredits > 0 ? 1 : 0)

  return {
    capturedMicroCredits,
    capturedFromReservationMicroCredits,
    additionalChargeMicroCredits,
    releasedMicroCredits,
    reservedBalanceAfter,
    availableBalanceAfterCapture,
    availableBalanceAfterSettlement,
    captureWalletVersion,
    finalWalletVersion,
  }
}
