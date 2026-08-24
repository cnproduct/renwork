import { ApiError } from "../errors.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";
import {
  type LocalAutomationTask,
  type LocalAutomationSchedule,
  type LocalAutomationModel,
  readLocalAutomationsData,
  writeLocalAutomationsData,
  computeNextRunTime,
  RENWORK_FOREIGN_TRADE_PRESETS,
} from "../local-automations.js";
import { triggerLocalAutomationNow } from "../local-automations-scheduler.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

export function registerLocalAutomationRoutes(options: {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  resolveWorkspace?: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}): void {
  const { routes, config, jsonResponse, readJsonBody, ensureWritable, requireClientScope } = options;

  // 1. GET /api/local-automations - List all local automations
  addRoute(routes, "GET", "/api/local-automations", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const data = readLocalAutomationsData();
    return jsonResponse({
      automations: data.automations,
      totalRuns: data.runs.length,
      schedulerActive: true,
    });
  });

  // 2. POST /api/local-automations/save - Create or update an automation
  addRoute(routes, "POST", "/api/local-automations/save", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const rawId = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "新建自动化任务";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? (body.category as LocalAutomationTask["category"]) : "custom";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    const enabled = body.enabled !== false;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;

    const rawSchedule = (body.schedule ?? {}) as Partial<LocalAutomationSchedule>;
    const schedule: LocalAutomationSchedule = {
      kind: rawSchedule.kind || "daily",
      hour: typeof rawSchedule.hour === "number" ? rawSchedule.hour : 9,
      minute: typeof rawSchedule.minute === "number" ? rawSchedule.minute : 0,
      daysOfWeek: Array.isArray(rawSchedule.daysOfWeek) ? rawSchedule.daysOfWeek : [1],
      intervalMinutes: typeof rawSchedule.intervalMinutes === "number" ? rawSchedule.intervalMinutes : 60,
      at: typeof rawSchedule.at === "number" ? rawSchedule.at : undefined,
      timezone: typeof rawSchedule.timezone === "string" ? rawSchedule.timezone : "Asia/Shanghai",
    };

    const rawModel = (body.model ?? {}) as Partial<LocalAutomationModel>;
    const model: LocalAutomationModel | undefined = rawModel.providerId && rawModel.modelId
      ? {
          providerId: String(rawModel.providerId).trim(),
          modelId: String(rawModel.modelId).trim(),
          variant: rawModel.variant ?? null,
        }
      : undefined;

    if (!instructions) {
      throw new ApiError(400, "invalid_payload", "Instructions / Prompt is required");
    }

    const data = readLocalAutomationsData();
    const existingIndex = data.automations.findIndex((t) => t.id === rawId);
    const now = Date.now();
    const nextRunAt = enabled ? computeNextRunTime(schedule, now) : undefined;

    if (existingIndex !== -1) {
      const existing = data.automations[existingIndex]!;
      data.automations[existingIndex] = {
        ...existing,
        name,
        description,
        category,
        instructions,
        schedule,
        model,
        workspaceId,
        enabled,
        updatedAt: now,
        nextRunAt,
      };
    } else {
      const newTask: LocalAutomationTask = {
        id: rawId,
        name,
        description,
        category,
        instructions,
        schedule,
        model,
        workspaceId,
        enabled,
        createdAt: now,
        updatedAt: now,
        nextRunAt,
      };
      data.automations.unshift(newTask);
    }

    writeLocalAutomationsData(data);
    return jsonResponse({ ok: true, automationId: rawId });
  });

  // 3. POST /api/local-automations/delete - Delete an automation
  addRoute(routes, "POST", "/api/local-automations/delete", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      throw new ApiError(400, "invalid_payload", "Task ID is required");
    }

    const data = readLocalAutomationsData();
    data.automations = data.automations.filter((t) => t.id !== id);
    writeLocalAutomationsData(data);
    return jsonResponse({ ok: true, deleted: id });
  });

  // 4. POST /api/local-automations/toggle - Enable or pause an automation
  addRoute(routes, "POST", "/api/local-automations/toggle", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const enabled = Boolean(body.enabled);

    if (!id) {
      throw new ApiError(400, "invalid_payload", "Task ID is required");
    }

    const data = readLocalAutomationsData();
    const target = data.automations.find((t) => t.id === id);
    if (!target) {
      throw new ApiError(404, "not_found", "Task not found");
    }

    target.enabled = enabled;
    target.updatedAt = Date.now();
    target.nextRunAt = enabled ? computeNextRunTime(target.schedule, Date.now()) : undefined;

    writeLocalAutomationsData(data);
    return jsonResponse({ ok: true, enabled, nextRunAt: target.nextRunAt });
  });

  // 5. POST /api/local-automations/run-now - Trigger immediate execution
  addRoute(routes, "POST", "/api/local-automations/run-now", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      throw new ApiError(400, "invalid_payload", "Task ID is required");
    }

    const res = await triggerLocalAutomationNow(id, {
      config,
      resolveWorkspace: options.resolveWorkspace,
    });

    return jsonResponse(res);
  });

  // 6. GET /api/local-automations/runs - Get run history
  addRoute(routes, "GET", "/api/local-automations/runs", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const limit = Number(ctx.url.searchParams.get("limit")) || 50;
    const automationId = ctx.url.searchParams.get("automationId");

    const data = readLocalAutomationsData();
    let runs = data.runs;
    if (automationId) {
      runs = runs.filter((r) => r.automationId === automationId);
    }
    return jsonResponse({ runs: runs.slice(0, limit) });
  });

  // 7. POST /api/local-automations/import-presets - Import RenWork B2B Presets
  addRoute(routes, "POST", "/api/local-automations/import-presets", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const data = readLocalAutomationsData();
    const existingNames = new Set(data.automations.map((t) => t.name));
    let addedCount = 0;
    const now = Date.now();

    for (const preset of RENWORK_FOREIGN_TRADE_PRESETS) {
      if (!existingNames.has(preset.name)) {
        const id = `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        data.automations.push({
          ...preset,
          id,
          createdAt: now,
          updatedAt: now,
          nextRunAt: computeNextRunTime(preset.schedule, now),
        });
        existingNames.add(preset.name);
        addedCount++;
      }
    }

    writeLocalAutomationsData(data);
    return jsonResponse({ ok: true, imported: addedCount, total: data.automations.length });
  });
}
