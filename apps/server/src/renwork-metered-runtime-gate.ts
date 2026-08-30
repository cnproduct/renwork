import { ApiError } from "./errors.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertRenWorkMeteredPrompt(body: ArrayBuffer | undefined): void {
  if (!body) throw new ApiError(402, "rencredit_metering_required", "A RenWork metered model must be selected.");
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiError(400, "invalid_prompt_payload", "The model request body is invalid.");
  }
  if (!isRecord(payload) || !isRecord(payload.model) || payload.model.providerID !== "renwork") {
    throw new ApiError(
      403,
      "rencredit_metering_required",
      "This RenWork edition only runs models through the RenWork metered runtime.",
    );
  }
}

export function assertRenWorkMeteredCommand(body: ArrayBuffer | undefined): void {
  if (!body) throw new ApiError(402, "rencredit_metering_required", "A RenWork metered model must be selected.");
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiError(400, "invalid_prompt_payload", "The model request body is invalid.");
  }
  if (!isRecord(payload) || typeof payload.model !== "string" || !payload.model.startsWith("renwork/")) {
    throw new ApiError(
      403,
      "rencredit_metering_required",
      "This RenWork edition only runs commands through the RenWork metered runtime.",
    );
  }
}

export function assertRenWorkMeteredSummarize(body: ArrayBuffer | undefined): void {
  if (!body) throw new ApiError(402, "rencredit_metering_required", "A RenWork metered model must be selected.");
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ApiError(400, "invalid_prompt_payload", "The model request body is invalid.");
  }
  if (!isRecord(payload) || payload.providerID !== "renwork" || typeof payload.modelID !== "string") {
    throw new ApiError(
      403,
      "rencredit_metering_required",
      "This RenWork edition only summarizes through the RenWork metered runtime.",
    );
  }
}
