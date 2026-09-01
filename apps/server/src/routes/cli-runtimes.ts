import { ApiError } from "../errors.js";
import {
  RENWORK_CLI_RUNTIMES,
  type RenWorkCliRuntime,
  type RenWorkCliRuntimeManager,
} from "../renwork-cli-runtime.js";
import type { ServerConfig, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type CliRuntimeRouteDependencies = {
  routes: Route[];
  config: ServerConfig;
  manager: RenWorkCliRuntimeManager;
  jsonResponse: (value: unknown, status?: number) => Response;
  readJsonBody: (request: Request) => Promise<unknown>;
  requireClientScope: (ctx: RequestContext, minimum: "viewer" | "collaborator" | "owner") => void;
  resolveWorkspace: (config: ServerConfig, workspaceId: string) => Promise<WorkspaceInfo>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntime(value: string): value is RenWorkCliRuntime {
  return RENWORK_CLI_RUNTIMES.some((runtime) => runtime === value);
}

export function registerCliRuntimeRoutes(deps: CliRuntimeRouteDependencies) {
  addRoute(deps.routes, "GET", "/cli-runtimes", "client", async (ctx) => {
    deps.requireClientScope(ctx, "viewer");
    return deps.jsonResponse({ runtimes: await deps.manager.statuses() });
  });

  addRoute(deps.routes, "POST", "/workspace/:id/cli-runtimes/:runtime/runs", "client", async (ctx) => {
    deps.requireClientScope(ctx, "collaborator");
    if (!isRuntime(ctx.params.runtime)) {
      throw new ApiError(404, "renwork_cli_runtime_not_found", "The requested CLI runtime is not supported.");
    }
    const workspace = await deps.resolveWorkspace(deps.config, ctx.params.id);
    if (workspace.workspaceType === "remote") {
      throw new ApiError(400, "renwork_cli_workspace_must_be_local", "CLI tasks must run on the RenWork desktop that owns this workspace.");
    }
    const body = await deps.readJsonBody(ctx.request);
    if (
      !isRecord(body)
      || typeof body.modelSku !== "string"
      || !body.modelSku.trim()
      || typeof body.prompt !== "string"
      || !body.prompt.trim()
    ) {
      throw new ApiError(400, "renwork_cli_request_invalid", "modelSku and prompt are required.");
    }
    const run = await deps.manager.start({
      runtime: ctx.params.runtime,
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      modelSku: body.modelSku.trim(),
      prompt: body.prompt,
    });
    return deps.jsonResponse(run, 202);
  });

  addRoute(deps.routes, "GET", "/workspace/:id/cli-runtimes/runs/:runId", "client", async (ctx) => {
    deps.requireClientScope(ctx, "viewer");
    const workspace = await deps.resolveWorkspace(deps.config, ctx.params.id);
    const run = deps.manager.get(ctx.params.runId);
    if (!run || run.workspaceId !== workspace.id) {
      throw new ApiError(404, "renwork_cli_run_not_found", "The CLI task was not found in this workspace.");
    }
    return deps.jsonResponse(run);
  });

  addRoute(deps.routes, "DELETE", "/workspace/:id/cli-runtimes/runs/:runId", "client", async (ctx) => {
    deps.requireClientScope(ctx, "collaborator");
    const workspace = await deps.resolveWorkspace(deps.config, ctx.params.id);
    const existing = deps.manager.get(ctx.params.runId);
    if (!existing || existing.workspaceId !== workspace.id) {
      throw new ApiError(404, "renwork_cli_run_not_found", "The CLI task was not found in this workspace.");
    }
    const run = await deps.manager.cancel(ctx.params.runId);
    if (!run) throw new ApiError(404, "renwork_cli_run_not_found", "The CLI task was not found on this device.");
    return deps.jsonResponse(run);
  });
}
