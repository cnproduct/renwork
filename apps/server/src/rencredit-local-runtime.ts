import { randomUUID } from "node:crypto";
import {
  canonicalLocalRuntimeReceiptPayload,
  type RenWorkSignedLocalRuntimeReceipt,
  type RenWorkTokenUsage,
} from "@openwork/rencredit-metering";
import type { CloudProviderMeteringCredentials } from "./cloud-provider-sync.js";
import { ApiError } from "./errors.js";
import { externalFetch } from "./server-fetch.js";
import type { LocalRuntimeMeteringSignerProvider } from "./types.js";

type JsonRecord = Record<string, unknown>;

export type LocalRuntimeReservation = {
  reservationId: string;
  runId: string;
  modelSku: string;
  providerID: string;
  modelID: string;
};

export type OpenCodeMessageEnvelope = {
  info?: {
    id?: string;
    role?: string;
    providerID?: string;
    time?: { created?: number; completed?: number };
    error?: unknown;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number; write?: number };
    };
  };
};

export interface RenCreditLocalRuntimePort {
  reserve(input: { modelSku: string; body: ArrayBuffer; runId?: string }): Promise<LocalRuntimeReservation>;
  settle(reservation: LocalRuntimeReservation, measured: ReturnType<typeof aggregateReportedUsage>): Promise<void>;
  release(reservation: LocalRuntimeReservation, failureCode: string): Promise<void>;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegative(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

function errorCode(value: unknown): string {
  if (!isRecord(value)) return "RENCREDIT_RUNTIME_REQUEST_FAILED";
  const error = isRecord(value.error) ? value.error : value;
  return typeof error.code === "string" ? error.code : "RENCREDIT_RUNTIME_REQUEST_FAILED";
}

async function requestJson(
  credentials: CloudProviderMeteringCredentials,
  path: string,
  init: RequestInit,
): Promise<{ response: Response; payload: unknown }> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${credentials.apiKey}`);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await externalFetch(`${credentials.baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

/** Conservative content-free estimate used only to freeze balance. */
export function estimatePromptUsage(body: ArrayBuffer): RenWorkTokenUsage {
  const inputTokens = Math.max(1, Math.ceil(body.byteLength / 3));
  return {
    inputTokens,
    outputTokens: 8_192,
    reasoningTokens: 4_096,
    cacheReadTokens: 0,
    cacheWriteTokens: inputTokens,
  };
}

export function aggregateReportedUsage(messages: readonly OpenCodeMessageEnvelope[]): {
  usage: RenWorkTokenUsage;
  hasResult: boolean;
  providerResponseId: string;
} {
  const assistant = messages.filter((message) => message.info?.role === "assistant");
  const usage = assistant.reduce<RenWorkTokenUsage>((total, message) => ({
    inputTokens: total.inputTokens + nonNegative(message.info?.tokens?.input),
    outputTokens: total.outputTokens + nonNegative(message.info?.tokens?.output),
    reasoningTokens: total.reasoningTokens + nonNegative(message.info?.tokens?.reasoning),
    cacheReadTokens: total.cacheReadTokens + nonNegative(message.info?.tokens?.cache?.read),
    cacheWriteTokens: total.cacheWriteTokens + nonNegative(message.info?.tokens?.cache?.write),
  }), { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  const completed = assistant.filter((message) => typeof message.info?.time?.completed === "number");
  const hasResult = completed.some((message) => !message.info?.error && nonNegative(message.info?.tokens?.output) > 0);
  return {
    usage,
    hasResult,
    providerResponseId: completed.map((message) => message.info?.id).filter(Boolean).join(",") || `no-result-${randomUUID()}`,
  };
}

export class RenCreditLocalRuntimeClient implements RenCreditLocalRuntimePort {
  constructor(private readonly options: {
    credentials: () => CloudProviderMeteringCredentials | null;
    signer?: LocalRuntimeMeteringSignerProvider;
  }) {}

  private requireCredentials() {
    const credentials = this.options.credentials();
    if (!credentials) {
      throw new ApiError(503, "rencredit_runtime_unavailable", "RenWork billing is not ready. Sign in and wait for provider sync.");
    }
    if (!this.options.signer) {
      throw new ApiError(503, "rencredit_runtime_unavailable", "This runtime cannot produce trusted RenCredit receipts.");
    }
    return credentials;
  }

  async reserve(input: { modelSku: string; body: ArrayBuffer; runId?: string }): Promise<LocalRuntimeReservation> {
    const credentials = this.requireCredentials();
    const signer = await this.options.signer!();
    const registration = await requestJson(credentials, `/api/v1/metered-runtime/devices/${encodeURIComponent(signer.deviceId)}`, {
      method: "PUT",
      body: JSON.stringify({ publicKeyPem: signer.publicKeyPem }),
    });
    if (!registration.response.ok || !isRecord(registration.payload)) {
      throw new ApiError(registration.response.status || 503, errorCode(registration.payload), "RenWork could not register this billing device.");
    }
    if (registration.payload.status !== "active") {
      throw new ApiError(403, "rencredit_device_approval_required", "This desktop must be approved by a RenWork platform administrator before OAuth models can run.");
    }

    const runId = input.runId ?? randomUUID();
    const reserved = await requestJson(credentials, "/api/v1/metered-runtime/reservations", {
      method: "POST",
      headers: { "Idempotency-Key": `desktop:${signer.deviceId}:${runId}` },
      body: JSON.stringify({
        deviceId: signer.deviceId,
        runId,
        modelSku: input.modelSku,
        estimatedUsage: estimatePromptUsage(input.body),
      }),
    });
    if (!reserved.response.ok || !isRecord(reserved.payload)) {
      throw new ApiError(reserved.response.status || 503, errorCode(reserved.payload), "RenWork could not reserve RenCredit for this task.");
    }
    const execution = isRecord(reserved.payload.execution) ? reserved.payload.execution : null;
    if (
      typeof reserved.payload.reservationId !== "string"
      || typeof reserved.payload.runId !== "string"
      || typeof reserved.payload.modelSku !== "string"
      || typeof execution?.providerID !== "string"
      || typeof execution.modelID !== "string"
    ) {
      throw new ApiError(502, "rencredit_execution_grant_invalid", "RenWork returned an invalid local execution grant.");
    }
    return {
      reservationId: reserved.payload.reservationId,
      runId: reserved.payload.runId,
      modelSku: reserved.payload.modelSku,
      providerID: execution.providerID,
      modelID: execution.modelID,
    };
  }

  async settle(reservation: LocalRuntimeReservation, measured: ReturnType<typeof aggregateReportedUsage>): Promise<void> {
    const credentials = this.requireCredentials();
    const signer = await this.options.signer!();
    const payload = {
      version: 1 as const,
      deviceId: signer.deviceId,
      reservationId: reservation.reservationId,
      runId: reservation.runId,
      modelSku: reservation.modelSku,
      providerResponseId: measured.providerResponseId,
      usage: measured.usage,
      accuracy: "reported" as const,
      hasResult: measured.hasResult,
      measuredAt: new Date().toISOString(),
      nonce: randomUUID(),
    };
    const signed: RenWorkSignedLocalRuntimeReceipt = {
      payload,
      signature: await signer.sign(canonicalLocalRuntimeReceiptPayload(payload)),
    };
    const result = await requestJson(credentials, "/api/v1/metered-runtime/settlements", {
      method: "POST",
      body: JSON.stringify(signed),
    });
    if (!result.response.ok) throw new Error(errorCode(result.payload));
  }

  async release(reservation: LocalRuntimeReservation, failureCode: string): Promise<void> {
    const credentials = this.requireCredentials();
    const result = await requestJson(
      credentials,
      `/api/v1/metered-runtime/reservations/${encodeURIComponent(reservation.reservationId)}/release`,
      { method: "POST", body: JSON.stringify({ failureCode }) },
    );
    if (!result.response.ok) throw new Error(errorCode(result.payload));
  }
}
