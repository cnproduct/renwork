import { expect, test } from "bun:test";
import { ApiError } from "./errors.js";
import { proxyOpencodeRequest } from "./server.js";
import type { LocalRuntimeReservation, RenCreditLocalRuntimePort } from "./rencredit-local-runtime.js";
import type { ServerConfig, WorkspaceInfo } from "./types.js";

test("desktop OAuth prompt freezes RenCredit, rewrites only inside the host, and settles all reported calls", async () => {
  let promptBody: unknown = null;
  const promptHeaders: { contentLength: string | null } = { contentLength: null };
  let prompted = false;
  let postPromptMessageReads = 0;
  const engine = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/session/ses_1/message") {
        if (prompted) postPromptMessageReads += 1;
        return Response.json(prompted && postPromptMessageReads > 1 ? [
          { info: { id: "old", role: "assistant", time: { created: 1, completed: 2 }, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } } },
          { info: { id: "new-1", role: "assistant", time: { created: 3, completed: 4 }, tokens: { input: 20, output: 5, reasoning: 2, cache: { read: 3, write: 4 } } } },
          { info: { id: "new-2", role: "assistant", time: { created: 5, completed: 6 }, tokens: { input: 7, output: 3, reasoning: 1, cache: { read: 2, write: 1 } } } },
        ] : [
          { info: { id: "old", role: "assistant", time: { created: 1, completed: 2 }, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } } },
        ]);
      }
      if (url.pathname === "/session/status") return Response.json({});
      if (url.pathname === "/session/ses_1/prompt_async" && request.method === "POST") {
        promptHeaders.contentLength = request.headers.get("content-length");
        promptBody = await request.json();
        prompted = true;
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const reservation: LocalRuntimeReservation = {
    reservationId: "rsv_1",
    runId: "run_1",
    modelSku: "renwork-oauth-pro",
    reservedMicroCredits: 200,
    providerID: "lpr_openai-seat",
    modelID: "gpt-5",
    adapter: "opencode",
  };
  const observed: { reservedSku: string | null } = { reservedSku: null };
  let settlement: unknown = null;
  const metering: RenCreditLocalRuntimePort = {
    reserve: async (input) => {
      observed.reservedSku = input.modelSku;
      return reservation;
    },
    settle: async (_reservation, measured) => {
      settlement = measured;
      return { reservationId: "rsv_1", status: "settled", capturedMicroCredits: 1, releasedMicroCredits: 0 };
    },
    release: async () => { throw new Error("unexpected release"); },
  };
  const workspace: WorkspaceInfo = {
    id: "ws_1",
    name: "Remote",
    path: "/tmp/remote",
    preset: "remote",
    workspaceType: "remote",
    baseUrl: `http://127.0.0.1:${engine.port}`,
  };
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host",
    approval: { mode: "auto", timeoutMs: 1_000 },
    corsOrigins: ["*"],
    workspaces: [workspace],
    authorizedRoots: [],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "cli",
    hostTokenSource: "cli",
    logFormat: "pretty",
    logRequests: false,
    meteredRuntimeRequired: true,
  };
  try {
    const response = await proxyOpencodeRequest({
      config,
      workspace,
      localRuntimeMetering: metering,
      proxyPath: "/session/ses_1/prompt_async",
      url: new URL("http://localhost/workspace/ws_1/opencode/session/ses_1/prompt_async"),
      request: new Request("http://localhost/workspace/ws_1/opencode/session/ses_1/prompt_async", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: "hello" }],
          model: { providerID: "renwork", modelID: "renwork-oauth-pro" },
        }),
      }),
    });
    expect(response.status).toBe(204);
    expect(observed.reservedSku).toBe("renwork-oauth-pro");
    expect(promptBody).toEqual({
      parts: [{ type: "text", text: "hello" }],
      model: { providerID: "lpr_openai-seat", modelID: "gpt-5" },
    });
    expect(promptHeaders.contentLength).toBe(String(Buffer.byteLength(JSON.stringify(promptBody))));
    for (let index = 0; index < 200 && !settlement; index += 1) {
      await Bun.sleep(10);
    }
    expect(postPromptMessageReads).toBeGreaterThan(1);
    expect(settlement).toEqual({
      usage: { inputTokens: 27, outputTokens: 8, reasoningTokens: 3, cacheReadTokens: 5, cacheWriteTokens: 5 },
      hasResult: true,
      providerResponseId: "new-1,new-2",
    });
  } finally {
    engine.stop(true);
  }
});

test("official RenWork models remain on the cloud gateway and are not double metered locally", async () => {
  let promptBody: unknown = null;
  const engine = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/session/ses_cloud/message") return Response.json([]);
      if (url.pathname === "/session/ses_cloud/prompt_async" && request.method === "POST") {
        promptBody = await request.json();
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    },
  });
  let settlementCalled = false;
  const metering: RenCreditLocalRuntimePort = {
    reserve: async () => {
      throw new ApiError(409, "CLOUD_GATEWAY_REQUIRED", "Use the RenWork cloud gateway.");
    },
    settle: async () => {
      settlementCalled = true;
      return { reservationId: "rsv_cloud", status: "captured", capturedMicroCredits: 0, releasedMicroCredits: 0 };
    },
    release: async () => {
      settlementCalled = true;
      return { reservationId: "rsv_cloud", status: "released", capturedMicroCredits: 0, releasedMicroCredits: 0 };
    },
  };
  const workspace: WorkspaceInfo = {
    id: "ws_cloud",
    name: "Remote",
    path: "/tmp/remote",
    preset: "remote",
    workspaceType: "remote",
    baseUrl: `http://127.0.0.1:${engine.port}`,
  };
  const config: ServerConfig = {
    host: "127.0.0.1",
    port: 0,
    token: "token",
    hostToken: "host",
    approval: { mode: "auto", timeoutMs: 1_000 },
    corsOrigins: ["*"],
    workspaces: [workspace],
    authorizedRoots: [],
    readOnly: false,
    startedAt: Date.now(),
    tokenSource: "cli",
    hostTokenSource: "cli",
    logFormat: "pretty",
    logRequests: false,
    meteredRuntimeRequired: true,
  };
  try {
    const response = await proxyOpencodeRequest({
      config,
      workspace,
      localRuntimeMetering: metering,
      proxyPath: "/session/ses_cloud/prompt_async",
      url: new URL("http://localhost/workspace/ws_cloud/opencode/session/ses_cloud/prompt_async"),
      request: new Request("http://localhost/workspace/ws_cloud/opencode/session/ses_cloud/prompt_async", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text: "hello" }],
          model: { providerID: "renwork", modelID: "renwork-code-kimi-k3" },
        }),
      }),
    });
    expect(response.status).toBe(204);
    expect(promptBody).toEqual({
      parts: [{ type: "text", text: "hello" }],
      model: { providerID: "renwork", modelID: "renwork-code-kimi-k3" },
    });
    expect(settlementCalled).toBe(false);
  } finally {
    engine.stop(true);
  }
});
