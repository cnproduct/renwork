import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { aggregateReportedUsage, estimatePromptUsage, RenCreditLocalRuntimeClient } from "./rencredit-local-runtime.js";

describe("RenCredit local OAuth runtime", () => {
  test("registers, reserves, signs reported usage, and releases failures", async () => {
    const requests: Array<{ path: string; method: string; body: unknown; idempotency: string | null }> = [];
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        const body = request.method === "GET" ? null : await request.json().catch(() => null);
        requests.push({ path: url.pathname, method: request.method, body, idempotency: request.headers.get("Idempotency-Key") });
        expect(request.headers.get("Authorization")).toBe("Bearer member-inference-key");
        if (request.method === "PUT") return Response.json({ status: "active" });
        if (url.pathname.endsWith("/reservations")) {
          return Response.json({
            reservationId: "rsv_1",
            runId: "run_1",
            modelSku: "renwork-oauth-pro",
            reservedMicroCredits: 21,
            execution: { providerID: "lpr_openai-seat", modelID: "gpt-5" },
          }, { status: 201 });
        }
        if (url.pathname.endsWith("/settlements")) {
          return Response.json({ reservationId: "rsv_1", status: "captured", capturedMicroCredits: 21, releasedMicroCredits: 0 });
        }
        if (url.pathname.endsWith("/release")) {
          return Response.json({ reservationId: "rsv_1", status: "released", releasedMicroCredits: 21 });
        }
        return new Response(null, { status: 404 });
      },
    });
    const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
      publicKeyEncoding: { format: "pem", type: "spki" },
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
    });
    const client = new RenCreditLocalRuntimeClient({
      credentials: () => ({ baseUrl: `http://127.0.0.1:${server.port}`, apiKey: "member-inference-key", orgId: "org_1" }),
      signer: async () => ({
        deviceId: "device_1",
        publicKeyPem: publicKey,
        sign: async (payload) => sign(null, Buffer.from(payload), privateKey).toString("base64"),
      }),
    });
    try {
      const body = new TextEncoder().encode(JSON.stringify({ parts: [{ type: "text", text: "hello" }] })).buffer as ArrayBuffer;
      const reservation = await client.reserve({ modelSku: "renwork-oauth-pro", body, runId: "run_1" });
      expect(reservation).toMatchObject({
        reservedMicroCredits: 21,
        providerID: "lpr_openai-seat",
        modelID: "gpt-5",
      });
      expect(requests[1]?.idempotency).toBe("desktop:device_1:run_1");

      await client.settle(reservation, {
        usage: { inputTokens: 11, outputTokens: 7, reasoningTokens: 3, cacheReadTokens: 2, cacheWriteTokens: 1 },
        hasResult: true,
        providerResponseId: "msg_1",
      });
      const settlement = requests.find((request) => request.path.endsWith("/settlements"));
      expect((settlement?.body as { payload?: { usage?: unknown } }).payload?.usage).toEqual({
        inputTokens: 11,
        outputTokens: 7,
        reasoningTokens: 3,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
      });
      expect(typeof (settlement?.body as { signature?: unknown }).signature).toBe("string");

      await client.release(reservation, "TEST_FAILURE");
      expect(requests.at(-1)?.body).toEqual({ failureCode: "TEST_FAILURE" });
    } finally {
      server.stop(true);
    }
  });

  test("rejects pending devices before any provider call", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ status: "pending" }, { status: 202 }),
    });
    const client = new RenCreditLocalRuntimeClient({
      credentials: () => ({ baseUrl: `http://127.0.0.1:${server.port}`, apiKey: "key", orgId: "org" }),
      signer: async () => ({ deviceId: "device", publicKeyPem: "pem", sign: async () => "signature" }),
    });
    try {
      await expect(client.reserve({ modelSku: "renwork-model", body: new Uint8Array([1]).buffer })).rejects.toMatchObject({
        status: 403,
        code: "rencredit_device_approval_required",
      });
    } finally {
      server.stop(true);
    }
  });

  test("sums every assistant model call in one task", () => {
    expect(aggregateReportedUsage([
      { info: { id: "a", role: "assistant", time: { completed: 1 }, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 3, write: 4 } } } },
      { info: { id: "b", role: "assistant", time: { completed: 2 }, tokens: { input: 20, output: 5, reasoning: 2, cache: { read: 6, write: 8 } } } },
    ])).toEqual({
      usage: { inputTokens: 30, outputTokens: 7, reasoningTokens: 3, cacheReadTokens: 9, cacheWriteTokens: 12 },
      hasResult: true,
      providerResponseId: "a,b",
    });
    expect(estimatePromptUsage(new Uint8Array(9).buffer).inputTokens).toBe(3);
  });
});
