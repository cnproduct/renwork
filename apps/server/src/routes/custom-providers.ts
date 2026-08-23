import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";
import { ApiError } from "../errors.js";
import { detectSystemProxyEnv } from "../system-proxy.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

export interface CustomModelDefinition {
  id: string;
  name: string;
  contextLimit?: number;
  outputLimit?: number;
  modalities?: string[];
  reasoning?: boolean;
}

export interface CustomProviderRecord {
  id: string;
  name: string;
  type: "ollama" | "openrouter" | "openai-compatible";
  baseURL: string;
  apiKey?: string;
  models: CustomModelDefinition[];
  enabled: boolean;
}

function resolveGlobalOpencodeConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config");
  return join(xdg, "opencode", "opencode.json");
}

function readOpencodeConfig(filePath: string): Record<string, unknown> {
  try {
    if (!existsSync(filePath)) return {};
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeOpencodeConfig(filePath: string, config: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function maskApiKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "******";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function registerCustomProviderRoutes(options: {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  resolveWorkspace?: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}): void {
  const { routes, config, jsonResponse, readJsonBody, ensureWritable, requireClientScope } = options;

  // 1. GET /api/custom-providers - List all custom providers
  addRoute(routes, "GET", "/api/custom-providers", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");
    const globalPath = resolveGlobalOpencodeConfigPath();
    const configData = readOpencodeConfig(globalPath);
    const providersObj = (configData.provider ?? {}) as Record<string, Record<string, unknown>>;

    const list: CustomProviderRecord[] = [];

    for (const [id, prov] of Object.entries(providersObj)) {
      if (!prov || typeof prov !== "object") continue;
      const name = typeof prov.name === "string" ? prov.name : id;
      const options = (prov.options ?? {}) as Record<string, unknown>;
      const rawBaseURL = typeof options.baseURL === "string" ? options.baseURL : "";
      const rawApiKey = typeof options.apiKey === "string" ? options.apiKey : "";
      const modelsObj = (prov.models ?? {}) as Record<string, Record<string, unknown>>;

      let providerType: "ollama" | "openrouter" | "openai-compatible" = "openai-compatible";
      if (id.toLowerCase().includes("ollama") || rawBaseURL.includes("11434")) {
        providerType = "ollama";
      } else if (id.toLowerCase().includes("openrouter") || rawBaseURL.includes("openrouter.ai")) {
        providerType = "openrouter";
      }

      const models: CustomModelDefinition[] = [];
      for (const [modelId, modelDef] of Object.entries(modelsObj)) {
        if (!modelDef || typeof modelDef !== "object") continue;
        const modelName = typeof modelDef.name === "string" ? modelDef.name : modelId;
        const limit = (modelDef.limit ?? {}) as Record<string, unknown>;
        const modalitiesObj = (modelDef.modalities ?? {}) as Record<string, unknown>;
        const inputModalities = Array.isArray(modalitiesObj.input) ? modalitiesObj.input.map(String) : ["text"];

        models.push({
          id: modelId,
          name: modelName,
          contextLimit: typeof limit.context === "number" ? limit.context : undefined,
          outputLimit: typeof limit.output === "number" ? limit.output : undefined,
          modalities: inputModalities,
        });
      }

      list.push({
        id,
        name,
        type: providerType,
        baseURL: rawBaseURL,
        apiKey: rawApiKey ? maskApiKey(rawApiKey) : undefined,
        models,
        enabled: true,
      });
    }

    return jsonResponse({ providers: list });
  });

  // 2. POST /api/custom-providers/save - Save or update a custom provider
  addRoute(routes, "POST", "/api/custom-providers/save", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const rawId = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : rawId;
    const type = typeof body.type === "string" ? body.type.trim() : "openai-compatible";
    const baseURL = typeof body.baseURL === "string" ? body.baseURL.trim() : "";
    const rawApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const rawModels = Array.isArray(body.models) ? body.models : [];

    if (!rawId) {
      throw new ApiError(400, "invalid_payload", "Provider ID is required");
    }

    // Normalise ID to prevent collision with OpenCode's internal OAuth handler (e.g. 'openrouter' -> 'custom_openrouter')
    let providerKey = rawId;
    if (type === "openrouter" && providerKey === "openrouter") {
      providerKey = "openrouter_custom";
    }

    const globalPath = resolveGlobalOpencodeConfigPath();
    const configData = readOpencodeConfig(globalPath);
    if (!configData.provider || typeof configData.provider !== "object") {
      configData.provider = {};
    }
    const providersObj = configData.provider as Record<string, Record<string, unknown>>;

    // Keep existing apiKey if client passed masked key
    let finalApiKey = rawApiKey;
    if (finalApiKey.includes("...") && providersObj[providerKey]) {
      const existingOptions = (providersObj[providerKey]?.options ?? {}) as Record<string, unknown>;
      if (typeof existingOptions.apiKey === "string") {
        finalApiKey = existingOptions.apiKey;
      }
    }

    const modelsMap: Record<string, unknown> = {};
    for (const m of rawModels) {
      if (!m || typeof m !== "object") continue;
      const modelId = typeof m.id === "string" ? m.id.trim() : "";
      if (!modelId) continue;
      const modelName = typeof m.name === "string" && m.name.trim() ? m.name.trim() : modelId;
      const contextLimit = typeof m.contextLimit === "number" && m.contextLimit > 0 ? m.contextLimit : 128000;
      const outputLimit = typeof m.outputLimit === "number" && m.outputLimit > 0 ? m.outputLimit : 8192;
      const modalities = Array.isArray(m.modalities) ? m.modalities : ["text"];

      modelsMap[modelId] = {
        name: modelName,
        limit: {
          context: contextLimit,
          output: outputLimit,
        },
        modalities: {
          input: modalities,
          output: ["text"],
        },
      };
    }

    const providerConfig: Record<string, unknown> = {
      name,
      npm: "@ai-sdk/openai-compatible",
      options: {
        baseURL: baseURL || (type === "ollama" ? "http://127.0.0.1:11434/v1" : type === "openrouter" ? "https://openrouter.ai/api/v1" : ""),
      },
      models: modelsMap,
    };

    if (finalApiKey) {
      (providerConfig.options as Record<string, unknown>).apiKey = finalApiKey;
    }

    providersObj[providerKey] = providerConfig;
    writeOpencodeConfig(globalPath, configData);

    return jsonResponse({ ok: true, providerId: providerKey });
  });

  // 3. POST /api/custom-providers/delete - Delete a custom provider
  addRoute(routes, "POST", "/api/custom-providers/delete", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId) {
      throw new ApiError(400, "invalid_payload", "providerId is required");
    }

    const globalPath = resolveGlobalOpencodeConfigPath();
    const configData = readOpencodeConfig(globalPath);
    if (configData.provider && typeof configData.provider === "object") {
      const providersObj = configData.provider as Record<string, unknown>;
      delete providersObj[providerId];
      writeOpencodeConfig(globalPath, configData);
    }

    return jsonResponse({ ok: true, deleted: providerId });
  });

  // 4. POST /api/custom-providers/test - Test provider connection & latency
  addRoute(routes, "POST", "/api/custom-providers/test", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");

    const body = (await readJsonBody(ctx.request).catch(() => ({}))) as Record<string, unknown>;
    const type = typeof body.type === "string" ? body.type.trim() : "openai-compatible";
    let baseURL = typeof body.baseURL === "string" ? body.baseURL.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!baseURL) {
      if (type === "ollama") baseURL = "http://127.0.0.1:11434/v1";
      else if (type === "openrouter") baseURL = "https://openrouter.ai/api/v1";
    }

    if (!baseURL) {
      throw new ApiError(400, "invalid_payload", "Base URL is required");
    }

    const normalizedBaseURL = baseURL.replace(/\/+$/, "");
    const testURL = `${normalizedBaseURL}/models`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const start = Date.now();
    try {
      const response = await fetch(testURL, {
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return jsonResponse({
          ok: false,
          status: response.status,
          latencyMs,
          error: `HTTP ${response.status}: ${errorText.slice(0, 300) || response.statusText}`,
        });
      }

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
      const models = rawList.map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const m = item as Record<string, unknown>;
          return String(m.id || m.name || m.model || "");
        }
        return "";
      }).filter(Boolean);

      return jsonResponse({
        ok: true,
        latencyMs,
        modelsCount: models.length,
        sampleModels: models.slice(0, 20),
      });
    } catch (cause) {
      const latencyMs = Date.now() - start;
      const message = cause instanceof Error ? cause.message : String(cause);
      return jsonResponse({
        ok: false,
        latencyMs,
        error: message.includes("timeout") ? `Connection timed out after 10000ms: ${message}` : message,
      });
    }
  });

  // 5. GET /api/custom-providers/scan-ollama - Scan local or specified Ollama
  addRoute(routes, "GET", "/api/custom-providers/scan-ollama", "client", async (ctx) => {
    requireClientScope(ctx, "collaborator");

    const queryURL = ctx.url.searchParams.get("baseURL") || "http://127.0.0.1:11434";
    const host = queryURL.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

    try {
      const response = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) {
        return jsonResponse({ running: false, models: [] });
      }
      const data = (await response.json().catch(() => ({}))) as { models?: Array<Record<string, unknown>> };
      const rawModels = Array.isArray(data.models) ? data.models : [];
      const models = rawModels.map((m) => {
        const name = String(m.name || m.model || "");
        const details = (m.details ?? {}) as Record<string, unknown>;
        const paramSize = typeof details.parameter_size === "string" ? details.parameter_size : "";
        const sizeBytes = typeof m.size === "number" ? m.size : 0;
        return {
          id: name,
          name: paramSize ? `${name} (${paramSize})` : name,
          sizeBytes,
          contextLimit: 262144,
          outputLimit: 32768,
          modalities: ["text", "image"],
        };
      });

      return jsonResponse({ running: true, models });
    } catch {
      return jsonResponse({ running: false, models: [] });
    }
  });
}
