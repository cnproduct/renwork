import { afterEach, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { RenCreditLocalRuntimePort } from "./rencredit-local-runtime.js";
import {
  antigravityPersonalAccountMode,
  codexPersonalAccountMode,
  parseAntigravityResultEvent,
  parseCodexExecEvent,
  RenWorkCliRuntimeManager,
  type RenWorkCliRunSnapshot,
} from "./renwork-cli-runtime.js";

test("Antigravity pilot rejects API-key and enterprise credential modes", () => {
  expect(antigravityPersonalAccountMode({}, {})).toBe(true);
  expect(antigravityPersonalAccountMode({ modelProvider: "gemini" }, {})).toBe(false);
  expect(antigravityPersonalAccountMode({}, { GOOGLE_GEMINI_BASE_URL: "https://example.com" })).toBe(false);
  expect(antigravityPersonalAccountMode({}, { AGY_ADC_AUTH: "true" })).toBe(false);
});

test("Codex pilot accepts only ChatGPT account mode without API overrides", () => {
  expect(codexPersonalAccountMode("Logged in using ChatGPT", {})).toBe(true);
  expect(codexPersonalAccountMode("Logged in using an API key", {})).toBe(false);
  expect(codexPersonalAccountMode("Logged in using ChatGPT", { OPENAI_API_KEY: "set" })).toBe(false);
  expect(codexPersonalAccountMode("Logged in using ChatGPT", { OPENAI_BASE_URL: "https://example.com" })).toBe(false);
});

const cleanup: string[] = [];
const originalCodexBin = process.env.RENWORK_CODEX_BIN;
const originalAntigravityBin = process.env.RENWORK_ANTIGRAVITY_BIN;

afterEach(async () => {
  if (originalCodexBin === undefined) delete process.env.RENWORK_CODEX_BIN;
  else process.env.RENWORK_CODEX_BIN = originalCodexBin;
  if (originalAntigravityBin === undefined) delete process.env.RENWORK_ANTIGRAVITY_BIN;
  else process.env.RENWORK_ANTIGRAVITY_BIN = originalAntigravityBin;
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fakeCodex(body: string) {
  const directory = await mkdtemp(join(tmpdir(), "renwork-codex-test-"));
  cleanup.push(directory);
  const executable = join(directory, "codex");
  await writeFile(executable, `#!/bin/sh\n${body}\n`, "utf8");
  await chmod(executable, 0o700);
  process.env.RENWORK_CODEX_BIN = executable;
  return directory;
}

async function fakeAntigravity(body: string) {
  const directory = await mkdtemp(join(tmpdir(), "renwork-antigravity-test-"));
  cleanup.push(directory);
  const executable = join(directory, "agy");
  await writeFile(executable, `#!/bin/sh\n${body}\n`, "utf8");
  await chmod(executable, 0o700);
  process.env.RENWORK_ANTIGRAVITY_BIN = executable;
  return directory;
}

async function terminalRun(manager: RenWorkCliRuntimeManager, runId: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = manager.get(runId);
    if (run && !["running", "settling"].includes(run.state)) return run;
    await Bun.sleep(10);
  }
  throw new Error("run did not finish");
}

function metering(options?: { adapter?: string; settleFails?: boolean }) {
  const calls = { reserved: 0, settled: 0, released: 0, usage: null as RenWorkCliRunSnapshot["usage"] };
  const port: RenCreditLocalRuntimePort = {
    reserve: async ({ modelSku, runId }) => {
      calls.reserved += 1;
      return {
        reservationId: "rsv_1",
        runId: runId ?? "run_1",
        modelSku,
        reservedMicroCredits: 200,
        providerID: "codex-personal",
        modelID: "gpt-5-codex",
        adapter: options?.adapter ?? "codex_cli",
      };
    },
    settle: async (_reservation, measured) => {
      calls.settled += 1;
      calls.usage = measured.usage;
      if (options?.settleFails) throw new Error("SETTLEMENT_FAILED");
      return { reservationId: "rsv_1", status: "settled", capturedMicroCredits: 123, releasedMicroCredits: 77 };
    },
    release: async () => {
      calls.released += 1;
      return { reservationId: "rsv_1", status: "released", capturedMicroCredits: 0, releasedMicroCredits: 200 };
    },
  };
  return { port, calls };
}

test("parses Codex JSONL usage without reading OAuth credentials", () => {
  expect(parseCodexExecEvent({
    type: "turn.completed",
    usage: {
      input_tokens: 10,
      cached_input_tokens: 2,
      cache_write_input_tokens: 3,
      output_tokens: 5,
      reasoning_output_tokens: 4,
    },
  }).usage).toEqual({
    inputTokens: 5,
    outputTokens: 1,
    reasoningTokens: 4,
    cacheReadTokens: 2,
    cacheWriteTokens: 3,
  });
});

test("accepts current Codex TokenUsage events without a cache-write field", () => {
  expect(parseCodexExecEvent({
    type: "turn.completed",
    usage: {
      input_tokens: 13,
      cached_input_tokens: 5,
      output_tokens: 8,
      reasoning_output_tokens: 3,
      total_tokens: 21,
    },
  }).usage).toEqual({
    inputTokens: 8,
    outputTokens: 5,
    reasoningTokens: 3,
    cacheReadTokens: 5,
    cacheWriteTokens: 0,
  });
});

test("normalizes Antigravity terminal usage without charging cached or thinking tokens twice", () => {
  expect(parseAntigravityResultEvent({ event: "result", result: {
    conversation_id: "conversation_1", status: "SUCCESS", response: "done",
    usage: { input_tokens: 10522, output_tokens: 354, thinking_tokens: 329, cache_read_tokens: 8112, total_tokens: 10876 },
  } })).toEqual({
    responseId: "conversation_1", responseText: "done",
    usage: { inputTokens: 2410, outputTokens: 25, reasoningTokens: 329, cacheReadTokens: 8112, cacheWriteTokens: 0 },
  });
  expect(parseAntigravityResultEvent({ event: "result", result: {
    status: "SUCCESS", response: "done",
    usage: { input_tokens: 10, output_tokens: 2, thinking_tokens: 3, cache_read_tokens: 0, total_tokens: 12 },
  } }).failed).toBe("ANTIGRAVITY_USAGE_EVENT_INVALID");
});

test("reserves before Antigravity execution and settles reported token usage", async () => {
  const directory = await fakeAntigravity(`
if [ "$1" = "--version" ]; then echo "agy 1.0"; exit 0; fi
cat >/dev/null
echo '{"event":"result","result":{"conversation_id":"conversation_1","status":"SUCCESS","response":"done","usage":{"input_tokens":10,"output_tokens":5,"thinking_tokens":2,"cache_read_tokens":4,"total_tokens":15}}}'
  `);
  const { port, calls } = metering({ adapter: "antigravity_cli" });
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  const started = await manager.start({ runtime: "antigravity", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-google", prompt: "do work" });
  const completed = await terminalRun(manager, started.runId);
  expect(completed.state).toBe("succeeded");
  expect(completed.output).toBe("done");
  expect(calls).toMatchObject({ reserved: 1, settled: 1, released: 0 });
  expect(calls.usage).toEqual({ inputTokens: 6, outputTokens: 3, reasoningTokens: 2, cacheReadTokens: 4, cacheWriteTokens: 0 });
});

test("renews the device lease during a long CLI run and releases it if renewal fails", async () => {
  const directory = await fakeAntigravity(`
if [ "$1" = "--version" ]; then echo "agy 1.0"; exit 0; fi
cat >/dev/null
sleep 0.2
echo '{"event":"result","result":{"status":"SUCCESS","response":"done","usage":{"input_tokens":1,"output_tokens":1,"thinking_tokens":0,"cache_read_tokens":0,"total_tokens":2}}}'
  `);
  const { port, calls } = metering({ adapter: "antigravity_cli" });
  let heartbeats = 0;
  port.heartbeat = async () => {
    heartbeats += 1;
    throw new Error("lease renewal unavailable");
  };
  const manager = new RenWorkCliRuntimeManager({ metering: port, heartbeatIntervalMs: 10 });
  const started = await manager.start({ runtime: "antigravity", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-google", prompt: "do work" });
  const completed = await terminalRun(manager, started.runId);
  expect(heartbeats).toBeGreaterThan(0);
  expect(completed.state).toBe("failed");
  expect(completed.errorCode).toBe("LOCAL_RUNTIME_HEARTBEAT_FAILED");
  expect(calls).toMatchObject({ reserved: 1, settled: 0, released: 1 });
});

test("releases Antigravity reservation when a terminal usage event is missing", async () => {
  const directory = await fakeAntigravity(`
if [ "$1" = "--version" ]; then echo "agy 1.0"; exit 0; fi
cat >/dev/null
echo '{"event":"result","result":{"status":"SUCCESS","response":"done"}}'
  `);
  const { port, calls } = metering({ adapter: "antigravity_cli" });
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  const started = await manager.start({ runtime: "antigravity", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-google", prompt: "do work" });
  const completed = await terminalRun(manager, started.runId);
  expect(completed.state).toBe("failed");
  expect(completed.errorCode).toBe("ANTIGRAVITY_USAGE_EVENT_MISSING");
  expect(calls).toMatchObject({ reserved: 1, settled: 0, released: 1 });
});

test("reserves before Codex execution and settles one signed usage result", async () => {
  const directory = await fakeCodex(`
if [ "$1" = "--version" ]; then echo "codex-cli 1.0"; exit 0; fi
if [ "$1" = "login" ]; then echo "Logged in using ChatGPT"; exit 0; fi
cat >/dev/null
echo '{"type":"item.completed","item":{"type":"agent_message","id":"msg_1","text":"done"}}'
echo '{"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":2,"cache_write_input_tokens":3,"output_tokens":5,"reasoning_output_tokens":4}}'
  `);
  const { port, calls } = metering();
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  const started = await manager.start({ runtime: "codex", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-code", prompt: "do work" });
  expect(calls.reserved).toBe(1);
  expect(calls.settled).toBe(0);
  expect(started.reservedMicroCredits).toBe(200);
  const completed = await terminalRun(manager, started.runId);
  expect(completed.state).toBe("succeeded");
  expect(completed.output).toBe("done");
  expect(completed.settlement?.capturedMicroCredits).toBe(123);
  expect(calls).toMatchObject({ reserved: 1, settled: 1, released: 0 });
  expect(calls.usage).toEqual({ inputTokens: 5, outputTokens: 1, reasoningTokens: 4, cacheReadTokens: 2, cacheWriteTokens: 3 });
});

test("releases the reservation when Codex fails before an authoritative usage event", async () => {
  const directory = await fakeCodex(`
if [ "$1" = "--version" ]; then echo "codex-cli 1.0"; exit 0; fi
if [ "$1" = "login" ]; then echo "Logged in using ChatGPT"; exit 0; fi
exit 2
  `);
  const { port, calls } = metering();
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  const started = await manager.start({ runtime: "codex", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-code", prompt: "fail" });
  const completed = await terminalRun(manager, started.runId);
  expect(completed.state).toBe("failed");
  expect(completed.errorCode).toBe("CLI_EXIT_2");
  expect(calls).toMatchObject({ reserved: 1, settled: 0, released: 1 });
  expect(completed.settlement?.releasedMicroCredits).toBe(200);
});

test("rejects a catalog route that is not bound to codex_cli and releases immediately", async () => {
  await fakeCodex(`
if [ "$1" = "--version" ]; then echo "codex-cli 1.0"; exit 0; fi
if [ "$1" = "login" ]; then echo "Logged in using ChatGPT"; exit 0; fi
exit 0
  `);
  const { port, calls } = metering({ adapter: "opencode" });
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  await expect(manager.start({ runtime: "codex", workspaceId: "ws_1", workspacePath: tmpdir(), modelSku: "wrong-route", prompt: "no" }))
    .rejects.toThrow("not bound to the requested CLI adapter");
  expect(calls).toMatchObject({ reserved: 1, settled: 0, released: 1 });
});

test("does not report success when RenCredit settlement fails", async () => {
  const directory = await fakeCodex(`
if [ "$1" = "--version" ]; then echo "codex-cli 1.0"; exit 0; fi
if [ "$1" = "login" ]; then echo "Logged in using ChatGPT"; exit 0; fi
cat >/dev/null
echo '{"type":"item.completed","item":{"type":"agent_message","id":"msg_1","text":"done"}}'
echo '{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}'
  `);
  const { port } = metering({ settleFails: true });
  const manager = new RenWorkCliRuntimeManager({ metering: port });
  const started = await manager.start({ runtime: "codex", workspaceId: "ws_1", workspacePath: directory, modelSku: "renwork-code", prompt: "work" });
  const completed = await terminalRun(manager, started.runId);
  expect(completed.state).toBe("failed");
  expect(completed.errorCode).toBe("SETTLEMENT_FAILED");
});
