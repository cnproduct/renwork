import type { ServerConfig, WorkspaceInfo } from "./types.js";
import { resolveWorkspaceOpencodeConnection } from "./opencode-connection.js";
import {
  type LocalAutomationTask,
  type LocalAutomationRunLog,
  readLocalAutomationsData,
  writeLocalAutomationsData,
  computeNextRunTime,
} from "./local-automations.js";
import { migrateLegacyRenWorkToolNames } from "./renwork-tool-name-migration.js";

interface SchedulerOptions {
  config: ServerConfig;
  resolveWorkspace?: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
  log?: (msg: string) => void;
}

const runningTaskIds = new Set<string>();
let schedulerTimer: NodeJS.Timeout | null = null;

async function executeTask(
  task: LocalAutomationTask,
  trigger: "scheduled" | "manual",
  options: SchedulerOptions,
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  if (runningTaskIds.has(task.id)) {
    return { ok: false, error: "Task is already executing" };
  }

  runningTaskIds.add(task.id);
  const startedAt = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const currentData = readLocalAutomationsData();
  const runLog: LocalAutomationRunLog = {
    id: runId,
    automationId: task.id,
    automationName: task.name,
    startedAt,
    status: "running",
    trigger,
  };
  currentData.runs.unshift(runLog);
  if (currentData.runs.length > 200) currentData.runs = currentData.runs.slice(0, 200);

  // Update task status in file
  const taskIndex = currentData.automations.findIndex((t) => t.id === task.id);
  if (taskIndex !== -1) {
    currentData.automations[taskIndex] = {
      ...currentData.automations[taskIndex]!,
      lastRunAt: startedAt,
      lastRunStatus: "running",
    };
  }
  writeLocalAutomationsData(currentData);

  try {
    options.log?.(`[local-automations] Starting task execution: ${task.name} (${task.id})`);

    // Determine target workspace & connection
    let workspace: WorkspaceInfo | undefined;
    if (task.workspaceId && options.resolveWorkspace) {
      workspace = await options.resolveWorkspace(options.config, task.workspaceId).catch(() => undefined);
    }
    if (!workspace && options.config.workspaces && options.config.workspaces[0] && options.resolveWorkspace) {
      workspace = await options.resolveWorkspace(options.config, options.config.workspaces[0].id).catch(() => undefined);
    }

    const targetWorkspace: WorkspaceInfo = workspace || {
      id: "default",
      name: "RenWork Workspace",
      path: process.cwd(),
      preset: "starter",
      workspaceType: "local",
    };

    const connection = resolveWorkspaceOpencodeConnection(options.config, targetWorkspace);
    const baseUrl = connection.baseUrl || options.config.opencodeBaseUrl || "http://127.0.0.1:4096";
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (connection.authHeader) {
      headers.Authorization = connection.authHeader;
    }

    // 1. Create a background session
    const sessionRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `[定时自动化] ${task.name}`.slice(0, 120),
      }),
      signal: AbortSignal.timeout(10000),
    });

    let sessionId: string | undefined;
    if (sessionRes.ok) {
      const sessionData = (await sessionRes.json().catch(() => ({}))) as { id?: string; item?: { id?: string } };
      sessionId = sessionData.id || sessionData.item?.id;
    }

    if (!sessionId) {
      sessionId = `session_auto_${Date.now()}`;
    }

    // 2. Send the instruction prompt
    const promptPayload: Record<string, unknown> = {
      prompt: migrateLegacyRenWorkToolNames(task.instructions),
    };
    if (task.model?.providerId && task.model?.modelId) {
      promptPayload.providerId = task.model.providerId;
      promptPayload.modelId = task.model.modelId;
    }

    const promptRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/sessions/${encodeURIComponent(sessionId)}/prompt`, {
      method: "POST",
      headers,
      body: JSON.stringify(promptPayload),
      signal: AbortSignal.timeout(180000), // 3 min timeout
    });

    let summary = `任务已成功触发并向 AI 引擎提交指令。`;
    if (promptRes.ok) {
      const promptData = (await promptRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (typeof promptData.text === "string" && promptData.text.trim()) {
        summary = promptData.text.trim().slice(0, 5000);
      }
    }

    const finishedAt = Date.now();
    const durationMs = finishedAt - startedAt;

    // Update log and task state
    const postData = readLocalAutomationsData();
    const targetLog = postData.runs.find((r) => r.id === runId);
    if (targetLog) {
      targetLog.status = "succeeded";
      targetLog.finishedAt = finishedAt;
      targetLog.durationMs = durationMs;
      targetLog.resultSummary = summary;
      targetLog.sessionId = sessionId;
    }

    const postTaskIndex = postData.automations.findIndex((t) => t.id === task.id);
    if (postTaskIndex !== -1) {
      const nextRunAt = computeNextRunTime(task.schedule, finishedAt + 1000);
      postData.automations[postTaskIndex] = {
        ...postData.automations[postTaskIndex]!,
        lastRunAt: startedAt,
        lastRunStatus: "succeeded",
        lastRunResult: summary,
        lastRunDurationMs: durationMs,
        lastRunError: undefined,
        nextRunAt,
      };
    }
    writeLocalAutomationsData(postData);

    options.log?.(`[local-automations] Task completed successfully: ${task.name} (${durationMs}ms)`);
    return { ok: true, summary };
  } catch (err) {
    const finishedAt = Date.now();
    const durationMs = finishedAt - startedAt;
    const errorMsg = err instanceof Error ? err.message : String(err);

    const postData = readLocalAutomationsData();
    const targetLog = postData.runs.find((r) => r.id === runId);
    if (targetLog) {
      targetLog.status = "failed";
      targetLog.finishedAt = finishedAt;
      targetLog.durationMs = durationMs;
      targetLog.error = errorMsg;
    }

    const postTaskIndex = postData.automations.findIndex((t) => t.id === task.id);
    if (postTaskIndex !== -1) {
      const nextRunAt = computeNextRunTime(task.schedule, finishedAt + 1000);
      postData.automations[postTaskIndex] = {
        ...postData.automations[postTaskIndex]!,
        lastRunAt: startedAt,
        lastRunStatus: "failed",
        lastRunDurationMs: durationMs,
        lastRunError: errorMsg,
        nextRunAt,
      };
    }
    writeLocalAutomationsData(postData);

    options.log?.(`[local-automations] Task failed: ${task.name} - ${errorMsg}`);
    return { ok: false, error: errorMsg };
  } finally {
    runningTaskIds.delete(task.id);
  }
}

export function startLocalAutomationsScheduler(options: SchedulerOptions): () => void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  // Initial check & nextRunAt computation
  const initData = readLocalAutomationsData();
  let modified = false;
  const now = Date.now();
  for (const t of initData.automations) {
    if (t.enabled && (!t.nextRunAt || t.nextRunAt < now - 24 * 3600 * 1000)) {
      t.nextRunAt = computeNextRunTime(t.schedule, now);
      modified = true;
    }
  }
  if (modified) {
    writeLocalAutomationsData(initData);
  }

  // Loop every 30 seconds
  schedulerTimer = setInterval(async () => {
    try {
      const data = readLocalAutomationsData();
      const currentNow = Date.now();

      for (const task of data.automations) {
        if (!task.enabled) continue;

        if (!task.nextRunAt) {
          task.nextRunAt = computeNextRunTime(task.schedule, currentNow);
          writeLocalAutomationsData(data);
          continue;
        }

        if (currentNow >= task.nextRunAt && !runningTaskIds.has(task.id)) {
          void executeTask(task, "scheduled", options);
        }
      }
    } catch (e) {
      options.log?.(`[local-automations-scheduler] Error in tick: ${e}`);
    }
  }, 30_000);

  return () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  };
}

export async function triggerLocalAutomationNow(
  taskId: string,
  options: SchedulerOptions,
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const data = readLocalAutomationsData();
  const task = data.automations.find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "Automation task not found" };
  }
  return executeTask(task, "manual", options);
}
