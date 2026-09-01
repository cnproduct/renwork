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
        if (url.pathname.endsWith("/reservations")) {
          if (!requests.some((entry) => entry.method === "PUT")) {
            return Response.json({ error: { code: "LOCAL_RUNTIME_DEVICE_NOT_APPROVED" } }, { status: 409 });
          }
          return Response.json({
            reservationId: "rsv_1",
            runId: "run_1",
            modelSku: "renwork-oauth-pro",
            execution: { providerID: "lpr_openai-seat", modelID: "gpt-5" },
          }, { status: 201 });
        }
        if (request.method === "PUT") return Response.json({ status: "active" });
        if (url.pathname.endsWith("/settlements")) return Response.json({ status: "captured" });
        if (url.pathname.endsWith("/release")) return Response.json({ status: "released" });
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
      expect(reservation).toMatchObject({ providerID: "lpr_openai-seat", modelID: "gpt-5" });
      expect(requests[0]?.idempotency).toBe("desktop:device_1:run_1");
      expect(requests[1]?.method).toBe("PUT");
      expect(requests[2]?.idempotency).toBe("desktop:device_1:run_1");

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
      fetch: (request) => request.method === "PUT"
        ? Response.json({ status: "pending" }, { status: 202 })
        : Response.json({ error: { code: "LOCAL_RUNTIME_DEVICE_NOT_APPROVED" } }, { status: 409 }),
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

  test("delegates official models to the cloud gateway without registering a device", async () => {
    const requests: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests.push(`${request.method} ${new URL(request.url).pathname}`);
        return Response.json({ error: { code: "CLOUD_GATEWAY_REQUIRED" } }, { status: 409 });
      },
    });
    const client = new RenCreditLocalRuntimeClient({
      credentials: () => ({ baseUrl: `http://127.0.0.1:${server.port}`, apiKey: "key", orgId: "org" }),
      signer: async () => ({ deviceId: "device", publicKeyPem: "pem", sign: async () => "signature" }),
    });
    try {
      await expect(client.reserve({ modelSku: "renwork-code-kimi-k3", body: new Uint8Array([1]).buffer })).rejects.toMatchObject({
        status: 409,
        code: "CLOUD_GATEWAY_REQUIRED",
      });
      expect(requests).toEqual(["POST /api/v1/metered-runtime/reservations"]);
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
