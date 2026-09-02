import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  createDefaultRenWorkModelCatalog,
  createRenWorkModelCatalogService,
  normalizeAdminModelCatalog,
  validateAdminModelCatalog,
  type RenWorkAdminModelCatalog,
} from "@openwork/rencredit-metering";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// This service owns model catalog configuration only. RenCredit wallets,
// reservations, usage events and ledger entries are persisted by Den API in
// MySQL and must never be recreated in this file-backed runtime.
const STATE_FILE = process.env.DATA_PATH || "/tmp/renwork_cloud_state.json";

let modelCatalog = createDefaultRenWorkModelCatalog();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (parsed.modelCatalog) {
        const normalizedCatalog = normalizeAdminModelCatalog(parsed.modelCatalog);
        validateAdminModelCatalog(normalizedCatalog);
        modelCatalog = normalizedCatalog;
      }
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function saveState() {
  try {
    const data = { modelCatalog };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

loadState();
const modelCatalogService = createRenWorkModelCatalogService(modelCatalog);

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function isSuperAdminRequest(authorization: string | undefined): "ok" | "missing_config" | "forbidden" {
  const configured = process.env.RENWORK_SUPER_ADMIN_TOKEN?.trim();
  if (!configured) return "missing_config";
  const provided = bearerToken(authorization);
  if (!provided) return "forbidden";
  const left = Buffer.from(configured);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right) ? "ok" : "forbidden";
}

function resolveProviderCredential(credentialRef: string | null): string | null {
  if (!credentialRef) return null;
  if (!credentialRef.startsWith("env://")) return null;
  const envName = credentialRef.slice("env://".length);
  return process.env[envName]?.trim() || null;
}

function providerModelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/models`;
}

async function testProvider(providerId: string) {
  const catalog = modelCatalogService.getAdminCatalog("super_admin");
  const provider = catalog.providers.find((candidate) => candidate.id === providerId);
  if (!provider) return { found: false as const };
  const startedAt = Date.now();

  if (provider.authMode === "device_oauth") {
    return {
      found: true as const,
      result: {
        ok: true,
        providerId,
        health: "healthy" as const,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        message: "设备 OAuth 策略有效。账号授权与令牌健康状态将在每台已批准的 RenWork 设备上独立检查。",
      },
    };
  }

  if (!provider.baseUrl) {
    const runtimeOnly = provider.kind === "runtime" || provider.kind === "local";
    return {
      found: true as const,
      result: {
        ok: false,
        providerId,
        health: runtimeOnly ? "degraded" as const : "offline" as const,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        message: runtimeOnly
          ? "This runtime provider must be tested on the machine where it runs."
          : "Provider Base URL is not configured.",
      },
    };
  }

  const credential = resolveProviderCredential(provider.credentialRef);
  if (provider.credentialRef && !credential) {
    return {
      found: true as const,
      result: {
        ok: false,
        providerId,
        health: "degraded" as const,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        message: provider.credentialRef.startsWith("secret://")
          ? "The configured secret reference is not available to this runtime."
          : "The configured environment secret is missing.",
      },
    };
  }

  try {
    const headers = new Headers({ Accept: "application/json" });
    if (credential) {
      if (provider.protocol === "gemini") headers.set("x-goog-api-key", credential);
      else headers.set("Authorization", `Bearer ${credential}`);
    }
    const response = await fetch(providerModelsUrl(provider.baseUrl), {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    const ok = response.ok;
    return {
      found: true as const,
      result: {
        ok,
        providerId,
        health: ok ? "healthy" as const : response.status < 500 ? "degraded" as const : "offline" as const,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        message: ok ? "Provider connection succeeded." : `Provider returned HTTP ${response.status}.`,
      },
    };
  } catch (error) {
    return {
      found: true as const,
      result: {
        ok: false,
        providerId,
        health: "offline" as const,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "Provider connection failed.",
      },
    };
  }
}

// Health Check
app.get("/healthz", (c) => {
  return c.json({
    status: "ok",
    node: "tencent-2c4g-production",
    service: "RenWork Model Catalog",
    version: "v1.0.0",
    specVersion: "PRD_SPEC_V1.0_COMPLIANT",
    timestamp: new Date().toISOString(),
  });
});

app.get("/v1/health", (c) => c.redirect("/healthz"));

// Member-safe catalog. Provider routes, Base URLs and secret references are
// deliberately projected out by the catalog service.
app.get("/v1/models/catalog", (c) => {
  return c.json(modelCatalogService.getPublicCatalog());
});

app.get("/v1/admin/models/catalog", (c) => {
  const authorization = isSuperAdminRequest(c.req.header("Authorization"));
  if (authorization === "missing_config") {
    return c.json({ ok: false, error: "SUPER_ADMIN_AUTH_NOT_CONFIGURED" }, 503);
  }
  if (authorization !== "ok") return c.json({ ok: false, error: "FORBIDDEN" }, 403);
  return c.json(modelCatalogService.getAdminCatalog("super_admin"));
});

app.put("/v1/admin/models/catalog", async (c) => {
  const authorization = isSuperAdminRequest(c.req.header("Authorization"));
  if (authorization === "missing_config") {
    return c.json({ ok: false, error: "SUPER_ADMIN_AUTH_NOT_CONFIGURED" }, 503);
  }
  if (authorization !== "ok") return c.json({ ok: false, error: "FORBIDDEN" }, 403);

  const body = await c.req.json().catch(() => null) as {
    expectedVersion?: unknown;
    catalog?: unknown;
  } | null;
  if (!body || typeof body.expectedVersion !== "string" || !body.catalog) {
    return c.json({ ok: false, error: "VALIDATION_FAILED" }, 400);
  }

  try {
    const normalizedCatalog = normalizeAdminModelCatalog(body.catalog as RenWorkAdminModelCatalog);
    validateAdminModelCatalog(normalizedCatalog);
    modelCatalog = modelCatalogService.replaceAdminCatalog({
      role: "super_admin",
      expectedVersion: body.expectedVersion,
      catalog: normalizedCatalog,
    });
    saveState();
    return c.json(modelCatalog);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MODEL_CATALOG_UPDATE_FAILED";
    const status = message === "MODEL_CATALOG_VERSION_CONFLICT" ? 409 : 400;
    return c.json({ ok: false, error: message }, status);
  }
});

app.post("/v1/admin/models/providers/:providerId/test", async (c) => {
  const authorization = isSuperAdminRequest(c.req.header("Authorization"));
  if (authorization === "missing_config") {
    return c.json({ ok: false, error: "SUPER_ADMIN_AUTH_NOT_CONFIGURED" }, 503);
  }
  if (authorization !== "ok") return c.json({ ok: false, error: "FORBIDDEN" }, 403);

  const tested = await testProvider(c.req.param("providerId"));
  if (!tested.found) return c.json({ ok: false, error: "PROVIDER_NOT_FOUND" }, 404);
  return c.json(tested.result);
});

const PORT = Number(process.env.PORT) || 8089;
if (process.env.NODE_ENV !== "test") {
  console.log(`RenWork Den Cloud API running on port ${PORT}`);
  serve({
    fetch: app.fetch,
    port: PORT,
  });
}

export { app };
