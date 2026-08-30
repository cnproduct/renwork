import { describe, expect, it } from "bun:test";
import {
  canonicalLocalRuntimeReceiptPayload,
  parseSignedLocalRuntimeReceipt,
  type RenWorkLocalRuntimeReceiptPayload,
} from "./index.js";

const payload: RenWorkLocalRuntimeReceiptPayload = {
  version: 1,
  deviceId: "device-1",
  reservationId: "reservation-1",
  runId: "run-1",
  modelSku: "local-approved",
  providerResponseId: "local:run-1",
  usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  accuracy: "tokenizer",
  hasResult: true,
  measuredAt: "2026-08-30T12:00:00.000Z",
  nonce: "nonce-1",
};

describe("local runtime receipts", () => {
  it("serializes a stable, content-free signing input", () => {
    const canonical = canonicalLocalRuntimeReceiptPayload(payload);
    expect(canonical).toContain('\"deviceId\":\"device-1\"');
    expect(canonical).not.toContain("prompt");
    expect(canonical).not.toContain("completion");
    expect(canonicalLocalRuntimeReceiptPayload({ ...payload, usage: { ...payload.usage } })).toBe(canonical);
  });

  it("rejects invalid signatures and token counts", () => {
    expect(() => parseSignedLocalRuntimeReceipt({ payload, signature: "***" })).toThrow("LOCAL_RUNTIME_RECEIPT_SIGNATURE_INVALID");
    expect(() => parseSignedLocalRuntimeReceipt({
      payload: { ...payload, usage: { ...payload.usage, inputTokens: -1 } },
      signature: "YQ==",
    })).toThrow("LOCAL_RUNTIME_RECEIPT_INVALID");
    expect(() => parseSignedLocalRuntimeReceipt({
      payload: { ...payload, prompt: "must never leave the device" },
      signature: "YQ==",
    })).toThrow("LOCAL_RUNTIME_RECEIPT_INVALID");
  });
});
