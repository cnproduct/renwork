import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { randomUUID } from "node:crypto";

import { ApiError } from "./errors.js";
import type {
  LocalRuntimeReservation,
  LocalRuntimeSettlement,
  RenCreditLocalRuntimePort,
} from "./rencredit-local-runtime.js";

export const RENWORK_CLI_RUNTIMES = ["codex", "antigravity"] as const;
export type RenWorkCliRuntime = (typeof RENWORK_CLI_RUNTIMES)[number];
export type RenWorkCliRunState = "running" | "settling" | "succeeded" | "failed" | "cancelled";

export type RenWorkCliRuntimeStatus = {
  runtime: RenWorkCliRuntime;
  installed: boolean;
  authenticated: boolean | null;
  version: string | null;
  meteredExecutionReady: boolean;
  message: string;
};

export type RenWorkCliRunSnapshot = {
  runId: string;
  runtime: RenWorkCliRuntime;
  workspaceId: string;
  modelSku: string;
  state: RenWorkCliRunState;
  output: string;
  usage: CodexReportedUsage | null;
  reservationId: string;
  reservedMicroCredits: number;
  settlement: LocalRuntimeSettlement | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type CodexReportedUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type MutableRun = RenWorkCliRunSnapshot & {
  reservation: LocalRuntimeReservation;
  child: ChildProcessWithoutNullStreams | null;
  finalizing: boolean;
};

type SpawnResult = { code: number; stdout: string; stderr: string };

const MAX_PROMPT_BYTES = 1_048_576;
const MAX_CAPTURED_OUTPUT_BYTES = 4_194_304;
const DEFAULT_RUN_TIMEOUT_MS = 30 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeTokenCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function runtimeErrorCode(error: unknown) {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message)) return error.message.slice(0, 128);
  return "RENWORK_CLI_RUNTIME_FAILED";
}

async function existingExecutable(candidates: readonly string[]) {
  for (const candidate of candidates) {
    if (!candidate.includes("/") && !candidate.includes("\\")) return candidate;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next allowlisted location.
    }
  }
  return null;
}

function pathCandidates(command: string) {
  const suffixes = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  const fromPath = (process.env.PATH ?? "").split(delimiter).filter(Boolean)
    .flatMap((directory) => suffixes.map((suffix) => join(directory, `${command}${suffix}`)));
  const fixed = process.platform === "win32"
    ? []
    : [join(homedir(), ".local", "bin", command), `/usr/local/bin/${command}`, `/opt/homebrew/bin/${command}`];
  return [...fromPath, ...fixed];
}

async function executableFor(runtime: RenWorkCliRuntime) {
  const override = runtime === "codex" ? process.env.RENWORK_CODEX_BIN : process.env.RENWORK_ANTIGRAVITY_BIN;
  const names = runtime === "codex" ? ["codex"] : ["agy", "antigravity"];
  return existingExecutable([
    ...(override?.trim() ? [override.trim()] : []),
    ...names.flatMap(pathCandidates),
  ]);
}

function runProcess(command: string, args: readonly string[], timeoutMs = 10_000): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    };
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("error", () => finish(127));
    child.once("close", (code) => finish(code ?? 1));
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(124);
    }, timeoutMs);
    timeout.unref?.();
  });
}

export async function inspectCliRuntime(runtime: RenWorkCliRuntime): Promise<RenWorkCliRuntimeStatus> {
  const executable = await executableFor(runtime);
  if (!executable) {
    return {
      runtime,
      installed: false,
      authenticated: null,
      version: null,
      meteredExecutionReady: false,
      message: runtime === "codex" ? "未检测到 Codex CLI。" : "未检测到 Antigravity CLI。",
    };
  }
  const version = await runProcess(executable, ["--version"]);
  if (runtime === "antigravity") {
    return {
      runtime,
      installed: version.code === 0,
      authenticated: null,
      version: version.code === 0 ? version.stdout || version.stderr : null,
      meteredExecutionReady: false,
      message: "已检测到 Antigravity；正式计费适配需等待可验证的结构化 Token 用量事件。",
    };
  }
  const login = await runProcess(executable, ["login", "status"]);
  const authenticated = login.code === 0 && /logged in|authenticated/i.test(`${login.stdout}\n${login.stderr}`);
  return {
    runtime,
    installed: version.code === 0,
    authenticated,
    version: version.code === 0 ? version.stdout || version.stderr : null,
    meteredExecutionReady: version.code === 0 && authenticated,
    message: authenticated
      ? "Codex CLI 已登录；通过 renwork codex 发起的任务会统一结算 RenCredit。"
      : "Codex CLI 已安装但尚未登录 ChatGPT 订阅账号。",
  };
}

export function parseCodexExecEvent(value: unknown): {
  responseText?: string;
  responseId?: string;
  usage?: CodexReportedUsage;
  failed?: string;
} {
  if (!isRecord(value) || typeof value.type !== "string") return {};
  if (value.type === "turn.failed" || value.type === "error") {
    const error = isRecord(value.error) ? value.error.message : value.message;
    return { failed: typeof error === "string" ? error : "CODEX_TURN_FAILED" };
  }
  if (value.type === "item.completed" && isRecord(value.item) && value.item.type === "agent_message") {
    return {
      responseText: typeof value.item.text === "string" ? value.item.text : "",
      responseId: typeof value.item.id === "string" ? value.item.id : undefined,
    };
  }
  if (value.type !== "turn.completed" || !isRecord(value.usage)) return {};
  const inputTokens = safeTokenCount(value.usage.input_tokens);
  const outputTokens = safeTokenCount(value.usage.output_tokens);
  const reasoningTokens = safeTokenCount(value.usage.reasoning_output_tokens);
  const cacheReadTokens = safeTokenCount(value.usage.cached_input_tokens);
  // Codex TokenUsage currently reports input/cached-input/output/reasoning/total.
  // Keep forward compatibility with a future explicit cache-write field, but do
  // not reject authoritative events from current CLI versions when it is absent.
  const cacheWriteTokens = value.usage.cache_write_input_tokens === undefined
    ? 0
    : safeTokenCount(value.usage.cache_write_input_tokens);
  if ([inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens].some((token) => token === null)) {
    return { failed: "CODEX_USAGE_EVENT_INVALID" };
  }
  return {
    usage: {
      inputTokens: inputTokens!,
      outputTokens: outputTokens!,
      reasoningTokens: reasoningTokens!,
      cacheReadTokens: cacheReadTokens!,
      cacheWriteTokens: cacheWriteTokens!,
    },
  };
}

function publicSnapshot(run: MutableRun): RenWorkCliRunSnapshot {
  const { reservation: _reservation, child: _child, finalizing: _finalizing, ...snapshot } = run;
  return structuredClone(snapshot);
}

export class RenWorkCliRuntimeManager {
  private readonly runs = new Map<string, MutableRun>();

  constructor(private readonly options: {
    metering: RenCreditLocalRuntimePort;
    runTimeoutMs?: number;
  }) {}

  async statuses() {
    return Promise.all(RENWORK_CLI_RUNTIMES.map(inspectCliRuntime));
  }

  async start(input: {
    runtime: RenWorkCliRuntime;
    workspaceId: string;
    workspacePath: string;
    modelSku: string;
    prompt: string;
  }): Promise<RenWorkCliRunSnapshot> {
    if (input.runtime !== "codex") {
      throw new ApiError(409, "antigravity_metering_not_ready", "Antigravity does not yet expose verified structured Token usage for RenCredit settlement.");
    }
    const prompt = input.prompt.trim();
    const promptBytes = new TextEncoder().encode(prompt);
    if (!prompt) throw new ApiError(400, "renwork_cli_prompt_required", "A task prompt is required.");
    if (promptBytes.byteLength > MAX_PROMPT_BYTES) {
      throw new ApiError(413, "renwork_cli_prompt_too_large", "The task prompt exceeds the 1 MiB safety limit.");
    }
    const status = await inspectCliRuntime("codex");
    if (!status.meteredExecutionReady) {
      throw new ApiError(409, "codex_cli_not_ready", status.message);
    }
    const requestedRunId = randomUUID();
    const promptBuffer = new Uint8Array(promptBytes).buffer;
    const reservation = await this.options.metering.reserve({ modelSku: input.modelSku, body: promptBuffer, runId: requestedRunId });
    if (reservation.adapter !== "codex_cli") {
      await this.options.metering.release(reservation, "LOCAL_RUNTIME_ADAPTER_MISMATCH").catch(() => undefined);
      throw new ApiError(409, "renwork_cli_route_mismatch", "This RenWork model is not bound to the Codex CLI adapter.");
    }
    const now = new Date().toISOString();
    const run: MutableRun = {
      runId: reservation.runId,
      runtime: input.runtime,
      workspaceId: input.workspaceId,
      modelSku: input.modelSku,
      state: "running",
      output: "",
      usage: null,
      reservationId: reservation.reservationId,
      reservedMicroCredits: reservation.reservedMicroCredits,
      settlement: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      reservation,
      child: null,
      finalizing: false,
    };
    this.runs.set(run.runId, run);
    void this.execute(run, input.workspacePath, prompt);
    return publicSnapshot(run);
  }

  get(runId: string) {
    const run = this.runs.get(runId);
    return run ? publicSnapshot(run) : null;
  }

  async cancel(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return null;
    // Once settlement has started the provider already delivered a result. Do not
    // race a capture with a release or overwrite the final settlement state.
    if (run.state === "running") {
      run.state = "cancelled";
      run.errorCode = "RENWORK_CLI_CANCELLED";
      run.updatedAt = new Date().toISOString();
      run.child?.kill("SIGTERM");
      await this.releaseOnce(run, "RENWORK_CLI_CANCELLED");
    }
    return publicSnapshot(run);
  }

  private async execute(run: MutableRun, workspacePath: string, prompt: string) {
    const executable = await executableFor("codex");
    if (!executable) {
      await this.fail(run, "CODEX_CLI_NOT_FOUND");
      return;
    }
    const child = spawn(executable, [
      "exec",
      "--json",
      "--model",
      run.reservation.modelID,
      "--cd",
      workspacePath,
      "-",
    ], {
      cwd: workspacePath,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    run.child = child;
    let stdoutBuffer = "";
    let stderr = "";
    let responseId = "";
    let streamFailure = "";
    let capturedBytes = 0;
    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try { parsed = JSON.parse(trimmed); } catch {
        streamFailure ||= "CODEX_JSONL_INVALID";
        return;
      }
      const event = parseCodexExecEvent(parsed);
      if (event.failed) streamFailure ||= event.failed;
      if (event.usage) run.usage = event.usage;
      if (event.responseId) responseId = event.responseId;
      if (event.responseText) {
        const bytes = Buffer.byteLength(event.responseText, "utf8");
        if (capturedBytes + bytes <= MAX_CAPTURED_OUTPUT_BYTES) {
          run.output = event.responseText;
          capturedBytes += bytes;
        } else {
          streamFailure ||= "CODEX_OUTPUT_TOO_LARGE";
        }
      }
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      let newline = stdoutBuffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(stdoutBuffer.slice(0, newline));
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        newline = stdoutBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 64_000) stderr += chunk.toString("utf8");
    });
    child.stdin.end(prompt);

    const timeout = setTimeout(() => {
      streamFailure ||= "CODEX_CLI_TIMEOUT";
      child.kill("SIGTERM");
    }, this.options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS);
    timeout.unref?.();
    const exitCode = await new Promise<number>((resolve) => {
      child.once("error", () => resolve(127));
      child.once("close", (code) => resolve(code ?? 1));
    });
    clearTimeout(timeout);
    run.child = null;
    consumeLine(stdoutBuffer);
    if (run.state === "cancelled") return;
    if (exitCode !== 0 || streamFailure) {
      const code = streamFailure || `CODEX_CLI_EXIT_${exitCode}`;
      await this.fail(run, code, stderr);
      return;
    }
    if (!run.usage || !run.output.trim()) {
      await this.fail(run, !run.usage ? "CODEX_USAGE_EVENT_MISSING" : "CODEX_RESULT_MISSING");
      return;
    }
    run.state = "settling";
    run.updatedAt = new Date().toISOString();
    run.finalizing = true;
    try {
      run.settlement = await this.options.metering.settle(run.reservation, {
        usage: run.usage,
        hasResult: true,
        providerResponseId: responseId || `codex:${run.runId}`,
      });
      run.state = "succeeded";
    } catch (error) {
      run.state = "failed";
      run.errorCode = runtimeErrorCode(error);
    } finally {
      run.finalizing = false;
      run.updatedAt = new Date().toISOString();
    }
  }

  private async fail(run: MutableRun, code: string, detail = "") {
    run.state = "failed";
    run.errorCode = /^[A-Z0-9_:-]+$/.test(code) ? code.slice(0, 128) : "CODEX_CLI_FAILED";
    if (detail && !run.output) run.output = detail.slice(0, 4_096);
    run.updatedAt = new Date().toISOString();
    await this.releaseOnce(run, run.errorCode);
  }

  private async releaseOnce(run: MutableRun, failureCode: string) {
    if (run.finalizing || run.settlement) return;
    run.finalizing = true;
    try {
      run.settlement = await this.options.metering.release(run.reservation, failureCode);
    } catch (error) {
      run.errorCode = `${failureCode}:RELEASE_FAILED:${runtimeErrorCode(error)}`.slice(0, 128);
    } finally {
      run.finalizing = false;
      run.updatedAt = new Date().toISOString();
    }
  }
}
