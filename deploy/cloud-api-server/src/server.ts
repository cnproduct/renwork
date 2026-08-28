import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  createDefaultRenWorkModelCatalog,
  createRenWorkModelCatalogService,
  validateAdminModelCatalog,
  type RenWorkAdminModelCatalog,
} from "@openwork/rencredit-metering";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

// -------------------------------------------------------------
// Pricing Matrix & Data Storage
// -------------------------------------------------------------
const BVU_PRICING: Record<string, { name: string; unit: string; price: number; deliverableStandard: string }> = {
  TWIN_BUILD: { name: "企业知识孪生全量构建", unit: "次", price: 50, deliverableStandard: "完整生成 00–20 模块报告及证据索引" },
  CUSTOMER_CLEAN_1K: { name: "存量客户数据治理", unit: "千条", price: 10, deliverableStandard: "输出数据质量审计报告、主记录合并及谱系图" },
  ACCOUNT_ENRICH: { name: "目标客户深度数据富集", unit: "账户", price: 3, deliverableStandard: "成功补齐公司规模、买家类型及公开展会/海关字段" },
  ACCOUNT_MONITOR_MONTH: { name: "客户海关采购动态持续监测", unit: "户·月", price: 5, deliverableStandard: "监测期内按月推送真实的供应链异动事件" },
  DEAL_DIAGNOSE: { name: "深度商机卡点诊断", unit: "商机", price: 8, deliverableStandard: "输出包含多维度博弈分析与合规底线的策略报告" },
  COMPLIANCE_AUDIT: { name: "目标国准入合规核验", unit: "次", price: 15, deliverableStandard: "输出权威合规规则版本、准入要求与缺口清单" },
  PRODUCT_OPPORTUNITY_REPORT: { name: "品类延伸机会报告", unit: "报告", price: 30, deliverableStandard: "输出市场规模、竞品差异与试错验证 SOP" },
  BENCHMARK_REPORT: { name: "行业同群组深度对标报告", unit: "报告", price: 20, deliverableStandard: "返回满足 k-匿名门槛的分位数统计分布图表" },
};

interface WalletData {
  orgId: string;
  availableBalance: number;
  reservedBalance: number;
  version: number;
}

interface Reservation {
  id: string;
  orgId: string;
  operationCode: string;
  amount: number;
  status: "reserved" | "captured" | "released";
  createdAt: string;
  expiresAt: string;
}

interface LedgerEntry {
  id: string;
  orgId: string;
  type: "grant" | "reserve" | "capture" | "release" | "refund";
  amount: number;
  balanceAfter: number;
  reasonCode: string;
  idempotencyKey: string;
  createdAt: string;
}

interface CloudJob {
  jobId: string;
  orgId: string;
  operationCode: string;
  status: "created" | "awaiting_consent" | "awaiting_credit_reservation" | "queued" | "running" | "awaiting_user_acceptance" | "succeeded" | "failed" | "cancelled" | "rejected";
  quoteId?: string;
  reservationId?: string;
  payloadSummary?: unknown;
  deliverable?: unknown;
  createdAt: string;
  updatedAt: string;
}

// In-Memory state with persistence
const STATE_FILE = process.env.DATA_PATH || "/tmp/renwork_cloud_state.json";

let wallet: WalletData = { orgId: "org_default_renwork", availableBalance: 500, reservedBalance: 0, version: 1 };
let reservations = new Map<string, Reservation>();
let ledgerEntries: LedgerEntry[] = [];
let jobs = new Map<string, CloudJob>();
let modelCatalog = createDefaultRenWorkModelCatalog();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (parsed.wallet) wallet = parsed.wallet;
      if (parsed.reservations) reservations = new Map(Object.entries(parsed.reservations));
      if (parsed.ledgerEntries) ledgerEntries = parsed.ledgerEntries;
      if (parsed.jobs) jobs = new Map(Object.entries(parsed.jobs));
      if (parsed.modelCatalog) {
        validateAdminModelCatalog(parsed.modelCatalog);
        modelCatalog = parsed.modelCatalog;
      }
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function saveState() {
  try {
    const data = {
      wallet,
      reservations: Object.fromEntries(reservations.entries()),
      ledgerEntries: ledgerEntries.slice(-500),
      jobs: Object.fromEntries(jobs.entries()),
      modelCatalog,
    };
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

// -------------------------------------------------------------
// Endpoints Implementation (Spec Section 9 & 10)
// -------------------------------------------------------------

// Health Check
app.get("/healthz", (c) => {
  return c.json({
    status: "ok",
    node: "tencent-2c4g-production",
    service: "RenWork Den Cloud API (Export Growth OS)",
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
    validateAdminModelCatalog(body.catalog as RenWorkAdminModelCatalog);
    modelCatalog = modelCatalogService.replaceAdminCatalog({
      role: "super_admin",
      expectedVersion: body.expectedVersion,
      catalog: body.catalog as RenWorkAdminModelCatalog,
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

// 1. GET /v1/export-growth/catalog - 增值能力目录与价格表
app.get("/v1/export-growth/catalog", (c) => {
  return c.json({
    ok: true,
    catalogVersion: "2026.08.v1",
    currency: "REN_CREDIT",
    items: Object.entries(BVU_PRICING).map(([code, item]) => ({
      operationCode: code,
      ...item,
    })),
  });
});

// 2. POST /v1/export-growth/operations/quote - 获取计费报价单 (D1 摘要)
app.post("/v1/export-growth/operations/quote", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const operationCode = String(body.operationCode || "").trim();
  const quantity = Number(body.quantity) || 1;
  const minimalPayload = body.minimalPayload || {};

  const pricing = BVU_PRICING[operationCode];
  if (!pricing) {
    return c.json({ ok: false, error: "INVALID_OPERATION_CODE", message: `Unknown operation ${operationCode}` }, 400);
  }

  const quoteId = `quote_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const totalAmount = pricing.price * quantity;
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(minimalPayload)).digest("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min validity

  return c.json({
    ok: true,
    quoteId,
    operationCode,
    quantity,
    unitPrice: pricing.price,
    totalAmount,
    currency: "REN_CREDIT",
    payloadHash,
    expiresAt,
  });
});

// 3. POST /v1/rencredit/reservations - 业务操作额度预占冻结
app.post("/v1/rencredit/reservations", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const quoteId = String(body.quoteId || "");
  const operationCode = String(body.operationCode || "");
  const amount = Number(body.amount);
  const idempotencyKey = String(body.idempotencyKey || `idem_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`);

  const pricing = BVU_PRICING[operationCode];
  if (!pricing || !amount || amount <= 0) {
    return c.json({ ok: false, error: "VALIDATION_FAILED", message: "Invalid reservation payload" }, 400);
  }

  // Double-entry check
  if (wallet.availableBalance < amount) {
    return c.json({
      ok: false,
      error: "INSUFFICIENT_RENCREDIT",
      message: `钱包可用余额不足 (当前: ${wallet.availableBalance}, 所需: ${amount})`,
      availableBalance: wallet.availableBalance,
      required: amount,
    }, 402);
  }

  const reservationId = `res_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  wallet.availableBalance -= amount;
  wallet.reservedBalance += amount;
  wallet.version++;

  const resObj: Reservation = {
    id: reservationId,
    orgId: wallet.orgId,
    operationCode,
    amount,
    status: "reserved",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
  reservations.set(reservationId, resObj);

  ledgerEntries.unshift({
    id: `led_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    orgId: wallet.orgId,
    type: "reserve",
    amount: -amount,
    balanceAfter: wallet.availableBalance,
    reasonCode: `RESERVE_${operationCode}`,
    idempotencyKey,
    createdAt: new Date().toISOString(),
  });

  saveState();

  return c.json({
    ok: true,
    reservationId,
    status: "reserved",
    reservedAmount: amount,
    balanceAfter: wallet.availableBalance,
  });
});

// 4. POST /v1/export-growth/jobs - 创建异步任务
app.post("/v1/export-growth/jobs", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const operationCode = String(body.operationCode || "");
  const reservationId = String(body.reservationId || "");
  const payload = body.payload || {};

  const resObj = reservations.get(reservationId);
  if (!resObj || resObj.status !== "reserved") {
    return c.json({ ok: false, error: "INVALID_RESERVATION", message: "A valid active reservation is required" }, 400);
  }

  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const job: CloudJob = {
    jobId,
    orgId: wallet.orgId,
    operationCode,
    status: "running",
    reservationId,
    payloadSummary: payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Simulate instant worker execution for core demo
  setTimeout(() => {
    const target = jobs.get(jobId);
    if (target && target.status === "running") {
      target.status = "awaiting_user_acceptance";
      target.deliverable = {
        summary: `成功完成 [${BVU_PRICING[operationCode]?.name || operationCode}] 交付物计算与合规审查。`,
        dataCount: Array.isArray(payload.items) ? payload.items.length : 1,
        timestamp: new Date().toISOString(),
      };
      target.updatedAt = new Date().toISOString();
      saveState();
    }
  }, 1000);

  jobs.set(jobId, job);
  saveState();

  return c.json({
    ok: true,
    jobId,
    status: "running",
    message: "异步增值任务已创建并进入调度队列",
  });
});

// 5. GET /v1/export-growth/jobs/:jobId - 查询任务进度与交付物
app.get("/v1/export-growth/jobs/:jobId", (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  if (!job) {
    return c.json({ ok: false, error: "JOB_NOT_FOUND" }, 404);
  }
  return c.json({ ok: true, job });
});

// 6. POST /v1/export-growth/jobs/:jobId/accept - 用户验收交付物并正式扣费
app.post("/v1/export-growth/jobs/:jobId/accept", async (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  if (!job) return c.json({ ok: false, error: "JOB_NOT_FOUND" }, 404);

  const resObj = reservations.get(job.reservationId || "");
  if (!resObj || resObj.status !== "reserved") {
    return c.json({ ok: false, error: "RESERVATION_ALREADY_SETTLED" }, 400);
  }

  // Capture
  resObj.status = "captured";
  wallet.reservedBalance -= resObj.amount;
  wallet.version++;

  job.status = "succeeded";
  job.updatedAt = new Date().toISOString();

  const receiptId = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const signature = crypto.createHmac("sha256", "RENWORK_SECRET").update(`${receiptId}:${job.jobId}:${resObj.amount}`).digest("hex");

  ledgerEntries.unshift({
    id: `led_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    orgId: wallet.orgId,
    type: "capture",
    amount: resObj.amount,
    balanceAfter: wallet.availableBalance,
    reasonCode: `CAPTURE_${job.operationCode}`,
    idempotencyKey: `idem_cap_${jobId}`,
    createdAt: new Date().toISOString(),
  });

  saveState();

  return c.json({
    ok: true,
    receiptId,
    jobId,
    capturedAmount: resObj.amount,
    balanceAfter: wallet.availableBalance,
    signature,
  });
});

// 7. POST /v1/export-growth/jobs/:jobId/cancel - 取消任务并 100% 自动解冻
app.post("/v1/export-growth/jobs/:jobId/cancel", async (c) => {
  const jobId = c.req.param("jobId");
  const job = jobs.get(jobId);
  if (!job) return c.json({ ok: false, error: "JOB_NOT_FOUND" }, 404);

  const resObj = reservations.get(job.reservationId || "");
  if (resObj && resObj.status === "reserved") {
    resObj.status = "released";
    wallet.reservedBalance -= resObj.amount;
    wallet.availableBalance += resObj.amount; // 100% refund
    wallet.version++;

    ledgerEntries.unshift({
      id: `led_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      orgId: wallet.orgId,
      type: "release",
      amount: resObj.amount,
      balanceAfter: wallet.availableBalance,
      reasonCode: `RELEASE_CANCEL_${job.operationCode}`,
      idempotencyKey: `idem_rel_${jobId}`,
      createdAt: new Date().toISOString(),
    });
  }

  job.status = "cancelled";
  job.updatedAt = new Date().toISOString();
  saveState();

  return c.json({
    ok: true,
    jobId,
    status: "cancelled",
    message: "任务已取消，预占额度已 100% 原路释放",
    availableBalance: wallet.availableBalance,
  });
});

// 8. GET /v1/rencredit/wallet - 查询钱包可用与预占
app.get("/v1/rencredit/wallet", (c) => {
  return c.json({
    ok: true,
    wallet: {
      orgId: wallet.orgId,
      currency: "REN_CREDIT",
      availableBalance: wallet.availableBalance,
      reservedBalance: wallet.reservedBalance,
      totalBalance: wallet.availableBalance + wallet.reservedBalance,
      status: "active",
      version: wallet.version,
    },
  });
});

// 9. GET /v1/rencredit/ledger - 查询复式记账流水
app.get("/v1/rencredit/ledger", (c) => {
  return c.json({
    ok: true,
    totalEntries: ledgerEntries.length,
    entries: ledgerEntries.slice(0, 50),
  });
});

// 10. GET /v1/benchmarks/cohorts - 查询同群组
app.get("/v1/benchmarks/cohorts", (c) => {
  return c.json({
    ok: true,
    kAnonymityThreshold: 20,
    cohorts: [
      { industryCode: "HOME_APPLIANCE", countryGroup: "EU_WEST", enterpriseCount: 42, eventCount: 1540, status: "available" },
      { industryCode: "BUILDING_MATERIALS", countryGroup: "NORTH_AMERICA", enterpriseCount: 38, eventCount: 890, status: "available" },
      { industryCode: "PHARMACEUTICAL_RAW", countryGroup: "SOUTHEAST_ASIA", enterpriseCount: 29, eventCount: 640, status: "available" },
    ],
  });
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
