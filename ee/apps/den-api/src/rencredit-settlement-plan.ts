import type { RenWorkTokenUsage } from "@openwork/rencredit-metering"

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

export function hasTokenConsumption(usage: RenWorkTokenUsage) {
  return usage.inputTokens > 0
    || usage.outputTokens > 0
    || usage.reasoningTokens > 0
    || usage.cacheReadTokens > 0
    || usage.cacheWriteTokens > 0
}

export function shouldCaptureInferenceUsage(input: {
  usage: RenWorkTokenUsage
  accuracy: "reported" | "estimated" | "tokenizer"
  hasResult: boolean
}) {
  // A visible result without a provider usage block is billed from the
  // reservation estimate. A provider/tokenizer measurement is authoritative
  // even when the response contains reasoning only or ends due to a length
  // limit before user-visible content is emitted.
  return input.hasResult || (input.accuracy !== "estimated" && hasTokenConsumption(input.usage))
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
  captureUsage: boolean
}): InferenceSettlementPlan {
  nonNegativeSafeInteger(input.walletReservedMicroCredits, "walletReservedMicroCredits")
  nonNegativeSafeInteger(input.walletVersion, "walletVersion")
  nonNegativeSafeInteger(input.reservationReservedMicroCredits, "reservationReservedMicroCredits")
  nonNegativeSafeInteger(input.computedMicroCredits, "computedMicroCredits")
  if (!Number.isSafeInteger(input.walletAvailableMicroCredits)) throw new Error("walletAvailableMicroCredits must be a safe integer")
  if (input.walletReservedMicroCredits < input.reservationReservedMicroCredits) {
    throw new Error("RENCREDIT_RESERVED_BALANCE_INVALID")
  }

  const capturedMicroCredits = input.captureUsage ? input.computedMicroCredits : 0
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
