import type {
  RenWorkLocalRuntimeReceiptPayload,
  RenWorkSignedLocalRuntimeReceipt,
  RenWorkTokenUsage,
} from "./contracts.js";

const USAGE_KEYS = [
  "inputTokens",
  "outputTokens",
  "reasoningTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
] as const;
const PAYLOAD_KEYS = [
  "version",
  "deviceId",
  "reservationId",
  "runId",
  "modelSku",
  "providerResponseId",
  "usage",
  "accuracy",
  "hasResult",
  "measuredAt",
  "nonce",
] as const;

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(record).sort();
  const allowed = [...expected].sort();
  return keys.length === allowed.length && keys.every((key, index) => key === allowed[index]);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function tokenUsage(value: unknown): value is RenWorkTokenUsage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return USAGE_KEYS.every((key) => nonNegativeInteger(record[key]));
}

function nonEmpty(value: unknown, max = 255): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function parseLocalRuntimeReceiptPayload(value: unknown): RenWorkLocalRuntimeReceiptPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("LOCAL_RUNTIME_RECEIPT_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, PAYLOAD_KEYS)
    ||
    record.version !== 1
    || !nonEmpty(record.deviceId)
    || !nonEmpty(record.reservationId)
    || !nonEmpty(record.runId)
    || !nonEmpty(record.modelSku)
    || !nonEmpty(record.providerResponseId)
    || !tokenUsage(record.usage)
    || (record.accuracy !== "reported" && record.accuracy !== "tokenizer")
    || typeof record.hasResult !== "boolean"
    || !nonEmpty(record.measuredAt)
    || !Number.isFinite(Date.parse(record.measuredAt))
    || !nonEmpty(record.nonce)
  ) {
    throw new Error("LOCAL_RUNTIME_RECEIPT_INVALID");
  }
  return record as unknown as RenWorkLocalRuntimeReceiptPayload;
}

/** Stable UTF-8 signing input shared by desktop and Den. */
export function canonicalLocalRuntimeReceiptPayload(payload: RenWorkLocalRuntimeReceiptPayload): string {
  const parsed = parseLocalRuntimeReceiptPayload(payload);
  return JSON.stringify({
    version: parsed.version,
    deviceId: parsed.deviceId,
    reservationId: parsed.reservationId,
    runId: parsed.runId,
    modelSku: parsed.modelSku,
    providerResponseId: parsed.providerResponseId,
    usage: {
      inputTokens: parsed.usage.inputTokens,
      outputTokens: parsed.usage.outputTokens,
      reasoningTokens: parsed.usage.reasoningTokens,
      cacheReadTokens: parsed.usage.cacheReadTokens,
      cacheWriteTokens: parsed.usage.cacheWriteTokens,
    },
    accuracy: parsed.accuracy,
    hasResult: parsed.hasResult,
    measuredAt: parsed.measuredAt,
    nonce: parsed.nonce,
  });
}

export function parseSignedLocalRuntimeReceipt(value: unknown): RenWorkSignedLocalRuntimeReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("LOCAL_RUNTIME_RECEIPT_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (!exactKeys(record, ["payload", "signature"])) throw new Error("LOCAL_RUNTIME_RECEIPT_INVALID");
  const payload = parseLocalRuntimeReceiptPayload(record.payload);
  if (!nonEmpty(record.signature, 4096) || !/^[A-Za-z0-9+/]+={0,2}$/.test(record.signature)) {
    throw new Error("LOCAL_RUNTIME_RECEIPT_SIGNATURE_INVALID");
  }
  return { payload, signature: record.signature };
}
