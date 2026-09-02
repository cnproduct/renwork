"use client";

import type {
  RenWorkAdminModel,
  RenWorkAdminModelCatalog,
  RenWorkAdminModelRoute,
  RenWorkAdminProvider,
  RenWorkBillingMode,
  RenWorkPublicModelCatalog,
  RenWorkProviderKind,
  RenWorkProviderProtocol,
  RenWorkProviderAuthMode,
  RenWorkRouteSource,
} from "@openwork/rencredit-metering";
import { normalizeAdminModelCatalog } from "@openwork/rencredit-metering";
import { CheckCircle2, CircleAlert, Plus, RefreshCw, Save, ServerCog, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AccessState = "loading" | "ready" | "signed-out" | "forbidden" | "error";
type AdminTab = "policy" | "providers" | "models" | "settlements" | "preview";

type ProviderTestResult = {
  ok: boolean;
  providerId: string;
  health: "healthy" | "degraded" | "offline";
  statusCode: number | null;
  latencyMs: number;
  message: string;
};

type MeteredRuntimeDevice = {
  id: string;
  organizationId: string;
  memberId: string;
  deviceId: string;
  publicKeyFingerprint: string;
  status: "pending" | "active" | "revoked";
  lastSeenAt: string;
  createdAt: string;
};

type RenCreditSettlement = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  modelSku: string;
  routeId: string;
  providerId: string;
  upstreamModelId: string;
  status: "reserved" | "captured" | "released";
  reservedMicroCredits: number;
  capturedMicroCredits: number;
  releasedMicroCredits: number;
  actualUsage: Record<string, number> | null;
  failureCode: string | null;
  createdAt: string | null;
  settledAt: string | null;
};

type RenCreditAuditPayload = {
  generatedAt: string;
  wallets: Array<{
    organizationId: string;
    organizationName: string | null;
    availableMicroCredits: number;
    reservedMicroCredits: number;
    status: string;
  }>;
  reservations: RenCreditSettlement[];
  ledger: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    reservationId: string | null;
    entryType: string;
    amountMicroCredits: number;
    availableDeltaMicroCredits: number;
    reservedDeltaMicroCredits: number;
    reasonCode: string;
    createdAt: string | null;
  }>;
};

const fieldClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400";
const textAreaClass = "min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
const tierOrder = new Map<RenWorkAdminModel["tier"], number>([
  ["auto", 0],
  ["standard", 1],
  ["professional", 2],
  ["ultimate", 3],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCatalogPayload(value: unknown): RenWorkAdminModelCatalog | null {
  if (!isRecord(value) || !isRecord(value.catalog)) return null;
  const catalog = value.catalog;
  if (
    typeof catalog.version !== "string"
    || !(catalog.status === "draft" || catalog.status === "active" || catalog.status === "retired")
    || catalog.currency !== "REN_CREDIT"
    || typeof catalog.updatedAt !== "string"
    || !isRecord(catalog.billingPolicy)
    || !Array.isArray(catalog.providers)
    || !Array.isArray(catalog.models)
  ) return null;
  return normalizeAdminModelCatalog(structuredClone(catalog) as unknown as RenWorkAdminModelCatalog);
}

function formatMultiplier(multiplierBps: number) {
  const value = multiplierBps / 10_000;
  return `×${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function formatMicroCredits(value: number) {
  return `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 })} RenCredit`;
}

function promotionIsActive(model: RenWorkAdminModel, now: Date) {
  if (!model.promotion) return false;
  const startsAt = Date.parse(model.promotion.startsAt);
  const endsAt = Date.parse(model.promotion.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now.getTime() && now.getTime() < endsAt;
}

function validateDraftCatalog(catalog: RenWorkAdminModelCatalog) {
  if (!catalog.version.trim()) throw new Error("目录版本不能为空。");
  if (!Number.isFinite(Date.parse(catalog.updatedAt))) throw new Error("目录更新时间无效。");

  const providerIds = new Set<string>();
  for (const provider of catalog.providers) {
    if (!provider.id.trim()) throw new Error("供应商 ID 不能为空。");
    if (providerIds.has(provider.id)) throw new Error(`供应商 ID 重复：${provider.id}`);
    if (provider.credentialRef && !/^(secret|env):\/\/[A-Za-z0-9_./-]+$/.test(provider.credentialRef)) {
      throw new Error(`${provider.displayName} 的密钥必须使用 env:// 或 secret:// 引用。`);
    }
    if (provider.authMode === "device_oauth") {
      if (provider.baseUrl || provider.credentialRef) throw new Error(`${provider.displayName} 的设备 OAuth 不能填写 Base URL 或服务端密钥。`);
      if (!provider.deviceOAuthPolicy || !Number.isSafeInteger(provider.deviceOAuthPolicy.maxDevicesPerUser) || provider.deviceOAuthPolicy.maxDevicesPerUser <= 0 || !Number.isSafeInteger(provider.deviceOAuthPolicy.maxConcurrentRunsPerUser) || provider.deviceOAuthPolicy.maxConcurrentRunsPerUser <= 0) {
        throw new Error(`${provider.displayName} 的设备数和并发限制必须是正整数。`);
      }
    }
    providerIds.add(provider.id);
  }

  const modelSkus = new Set<string>();
  for (const model of catalog.models) {
    if (!model.sku.trim()) throw new Error("模型 SKU 不能为空。");
    if (modelSkus.has(model.sku)) throw new Error(`模型 SKU 重复：${model.sku}`);
    modelSkus.add(model.sku);
    const integerFields = [model.displayMultiplierBps, model.priceMultiplierBps, model.sortOrder, ...Object.values(model.rates)];
    if (integerFields.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error(`${model.displayName} 的倍率或 Token 单价无效。`);
    if (model.promotion && (!Number.isSafeInteger(model.promotion.multiplierBps) || model.promotion.multiplierBps < 0 || model.promotion.multiplierBps > 10_000)) {
      throw new Error(`${model.displayName} 的优惠比例无效。`);
    }
    const routeIds = new Set<string>();
    for (const route of model.routes) {
      if (!route.id.trim()) throw new Error(`${model.displayName} 的路由 ID 不能为空。`);
      if (routeIds.has(route.id)) throw new Error(`${model.displayName} 的路由 ID 重复：${route.id}`);
      if (!providerIds.has(route.providerId)) throw new Error(`${model.displayName} 引用了不存在的供应商：${route.providerId}`);
      routeIds.add(route.id);
    }
    if (model.status === "published" && !model.routes.some((route) => route.enabled)) throw new Error(`已发布模型 ${model.displayName} 至少需要一条启用路由。`);
  }
}

function toPublicPreview(catalog: RenWorkAdminModelCatalog, now = new Date()): RenWorkPublicModelCatalog {
  const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]));
  const models = catalog.models
    .filter((model) => model.status === "published")
    .flatMap((model) => {
      const activeRoute = model.routes
        .filter((route) => route.enabled)
        .filter((route) => {
          const provider = providers.get(route.providerId);
          return provider?.enabled && provider.health !== "offline";
        })
        .sort((left, right) => left.priority - right.priority)[0];
      if (!activeRoute) return [];
      const promotionActive = promotionIsActive(model, now);
      const promotionBps = promotionActive ? model.promotion?.multiplierBps ?? 10_000 : 10_000;
      return [{
        sku: model.sku,
        providerID: "renwork" as const,
        modelID: model.sku,
        displayName: model.displayName,
        description: model.description,
        tier: model.tier,
        autoEligible: model.autoEligible,
        contextWindow: model.contextWindow,
        tags: [...model.tags],
        displayMultiplierBps: model.displayMultiplierBps,
        effectiveDisplayMultiplierBps: Math.ceil(model.displayMultiplierBps * promotionBps / 10_000),
        promotionLabel: promotionActive ? model.promotion?.label ?? null : null,
        promotionEndsAt: promotionActive ? model.promotion?.endsAt ?? null : null,
        billingMode: catalog.billingPolicy[activeRoute.source],
        executionLocation: activeRoute.source === "local" ? "local" as const : "cloud" as const,
        sortOrder: model.sortOrder,
      }];
    })
    .sort((left, right) => (tierOrder.get(left.tier) ?? 0) - (tierOrder.get(right.tier) ?? 0) || left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName))
    .map(({ sortOrder: _sortOrder, ...model }) => model);
  return { version: catalog.version, currency: "REN_CREDIT", models };
}

function errorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(`/api/den${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { response, payload };
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${count + 1}`;
}

function splitList(value: string) {
  return value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);
}

function localDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function newProvider(count: number): RenWorkAdminProvider {
  return {
    id: nextId("provider", count),
    displayName: "新供应商",
    kind: "relay",
    protocol: "openai_compatible",
    baseUrl: "https://api.example.com/v1",
    credentialRef: null,
    authMode: "service_secret",
    credentialStore: "server_secret",
    executionScope: "cloud_gateway",
    sharingScope: "organization",
    deviceOAuthPolicy: null,
    enabled: false,
    health: "unknown",
  };
}

function withProviderAuthMode(provider: RenWorkAdminProvider, authMode: RenWorkProviderAuthMode): RenWorkAdminProvider {
  if (authMode === "device_oauth") {
    return {
      ...provider,
      kind: "runtime",
      protocol: "opencode",
      baseUrl: null,
      credentialRef: null,
      authMode,
      credentialStore: "device_vault",
      executionScope: "personal_device",
      sharingScope: "user_private",
      deviceOAuthPolicy: provider.deviceOAuthPolicy ?? { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 },
    };
  }
  if (authMode === "service_secret") {
    return {
      ...provider,
      authMode,
      credentialStore: "server_secret",
      executionScope: "cloud_gateway",
      sharingScope: "organization",
      deviceOAuthPolicy: null,
    };
  }
  return {
    ...provider,
    authMode,
    credentialStore: "none",
    executionScope: provider.kind === "runtime" || provider.kind === "local" ? "personal_device" : "cloud_gateway",
    sharingScope: provider.kind === "runtime" || provider.kind === "local" ? "user_private" : "organization",
    credentialRef: null,
    deviceOAuthPolicy: null,
  };
}

function newRoute(modelSku: string, count: number, providerId: string): RenWorkAdminModelRoute {
  return {
    id: `route-${slug(modelSku) || "model"}-${count + 1}`,
    providerId,
    upstreamModelId: "provider/model-id",
    priority: (count + 1) * 10,
    enabled: true,
    source: "official",
  };
}

function newModel(count: number, providerId: string): RenWorkAdminModel {
  const sku = nextId("renwork-model", count);
  return {
    sku,
    displayName: "RenWork 新模型",
    description: "配置完成并验证后再发布给用户。",
    tier: "standard",
    status: "draft",
    autoEligible: false,
    contextWindow: null,
    tags: [],
    sortOrder: (count + 1) * 10,
    displayMultiplierBps: 10_000,
    priceMultiplierBps: 10_000,
    rates: {
      inputMicroCreditsPerMillion: 1_000_000,
      outputMicroCreditsPerMillion: 3_000_000,
      reasoningMicroCreditsPerMillion: 3_000_000,
      cacheReadMicroCreditsPerMillion: 200_000,
      cacheWriteMicroCreditsPerMillion: 1_250_000,
    },
    promotion: null,
    allowedPlanIds: ["free", "individual", "enterprise"],
    routes: providerId ? [newRoute(sku, 0, providerId)] : [],
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-orange-600" />
      {label}
    </label>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function RenWorkModelCatalogAdmin() {
  const [accessState, setAccessState] = useState<AccessState>("loading");
  const [catalog, setCatalog] = useState<RenWorkAdminModelCatalog | null>(null);
  const [savedVersion, setSavedVersion] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("policy");
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerResults, setProviderResults] = useState<Record<string, ProviderTestResult>>({});
  const [devices, setDevices] = useState<MeteredRuntimeDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [settlementAudit, setSettlementAudit] = useState<RenCreditAuditPayload | null>(null);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [settlementOrganizationId, setSettlementOrganizationId] = useState("");
  const [settlementStatus, setSettlementStatus] = useState("");

  const publicPreview = useMemo(() => {
    if (!catalog) return null;
    try {
      return toPublicPreview(catalog);
    } catch {
      return null;
    }
  }, [catalog]);

  const loadCatalog = async () => {
    setAccessState("loading");
    setPageError(null);
    try {
      const { response, payload } = await requestJson("/v1/admin/model-catalog");
      if (response.status === 401) {
        setAccessState("signed-out");
        return;
      }
      if (response.status === 403) {
        setAccessState("forbidden");
        return;
      }
      if (!response.ok) {
        setAccessState("error");
        setPageError(errorMessage(payload, `模型目录加载失败（${response.status}）。`));
        return;
      }
      const parsed = parseCatalogPayload(payload);
      if (!parsed) {
        setAccessState("error");
        setPageError("模型目录服务返回了无效数据。");
        return;
      }
      setCatalog(parsed);
      setSavedVersion(parsed.version);
      setAccessState("ready");
    } catch (error) {
      setAccessState("error");
      setPageError(error instanceof Error ? error.message : "模型目录加载失败。");
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const { response, payload } = await requestJson("/v1/admin/metered-runtime/devices");
      if (!response.ok || !isRecord(payload) || !Array.isArray(payload.devices)) {
        throw new Error(errorMessage(payload, `设备列表加载失败（${response.status}）。`));
      }
      setDevices(payload.devices as MeteredRuntimeDevice[]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "设备列表加载失败。");
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (accessState === "ready" && activeTab === "providers") void loadDevices();
  }, [accessState, activeTab]);

  const loadSettlements = async () => {
    setSettlementsLoading(true);
    setPageError(null);
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (settlementOrganizationId.trim()) query.set("organizationId", settlementOrganizationId.trim());
      if (settlementStatus) query.set("status", settlementStatus);
      const { response, payload } = await requestJson(`/v1/admin/rencredit/settlements?${query.toString()}`);
      if (!response.ok || !isRecord(payload) || !Array.isArray(payload.wallets) || !Array.isArray(payload.reservations) || !Array.isArray(payload.ledger)) {
        throw new Error(errorMessage(payload, `RenCredit 结算审计加载失败（${response.status}）。`));
      }
      setSettlementAudit(payload as unknown as RenCreditAuditPayload);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "RenCredit 结算审计加载失败。");
    } finally {
      setSettlementsLoading(false);
    }
  };

  useEffect(() => {
    if (accessState === "ready" && activeTab === "settlements" && !settlementAudit) void loadSettlements();
  }, [accessState, activeTab]);

  const updateDeviceStatus = async (device: MeteredRuntimeDevice, status: "active" | "revoked") => {
    setPageError(null);
    const { response, payload } = await requestJson(`/v1/admin/metered-runtime/devices/${encodeURIComponent(device.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setPageError(errorMessage(payload, `设备状态更新失败（${response.status}）。`));
      return;
    }
    setDevices((current) => current.map((candidate) => candidate.id === device.id ? { ...candidate, status } : candidate));
    setNotice(status === "active" ? `设备 ${device.deviceId} 已批准。` : `设备 ${device.deviceId} 已撤销。`);
  };

  const replaceProvider = (index: number, next: RenWorkAdminProvider) => {
    setCatalog((current) => current ? { ...current, providers: current.providers.map((provider, providerIndex) => providerIndex === index ? next : provider) } : current);
    setNotice(null);
  };

  const replaceModel = (index: number, next: RenWorkAdminModel) => {
    setCatalog((current) => current ? { ...current, models: current.models.map((model, modelIndex) => modelIndex === index ? next : model) } : current);
    setNotice(null);
  };

  const updateProviderId = (index: number, nextIdValue: string) => {
    setCatalog((current) => {
      if (!current) return current;
      const previousId = current.providers[index]?.id;
      if (!previousId) return current;
      return {
        ...current,
        providers: current.providers.map((provider, providerIndex) => providerIndex === index ? { ...provider, id: nextIdValue } : provider),
        models: current.models.map((model) => ({
          ...model,
          routes: model.routes.map((route) => route.providerId === previousId ? { ...route, providerId: nextIdValue } : route),
        })),
      };
    });
  };

  const removeProvider = (index: number) => {
    if (!catalog) return;
    const provider = catalog.providers[index];
    if (!provider) return;
    const usedBy = catalog.models.filter((model) => model.routes.some((route) => route.providerId === provider.id));
    if (usedBy.length > 0) {
      setPageError(`不能删除 ${provider.displayName}：仍被 ${usedBy.map((model) => model.displayName).join("、")} 使用。`);
      return;
    }
    setCatalog({ ...catalog, providers: catalog.providers.filter((_, providerIndex) => providerIndex !== index) });
    setProviderResults((current) => Object.fromEntries(Object.entries(current).filter(([providerId]) => providerId !== provider.id)));
  };

  const testProviderConnection = async (provider: RenWorkAdminProvider) => {
    setTestingProviderId(provider.id);
    setPageError(null);
    try {
      const { response, payload } = await requestJson(`/v1/admin/model-catalog/providers/${encodeURIComponent(provider.id)}/test`, { method: "POST" });
      if (!isRecord(payload) || typeof payload.providerId !== "string" || typeof payload.message !== "string" || typeof payload.latencyMs !== "number" || !(payload.health === "healthy" || payload.health === "degraded" || payload.health === "offline")) {
        throw new Error(errorMessage(payload, `连接测试失败（${response.status}）。`));
      }
      const result: ProviderTestResult = {
        ok: payload.ok === true,
        providerId: payload.providerId,
        health: payload.health,
        statusCode: typeof payload.statusCode === "number" ? payload.statusCode : null,
        latencyMs: payload.latencyMs,
        message: payload.message,
      };
      setProviderResults((current) => ({ ...current, [provider.id]: result }));
      setCatalog((current) => current ? {
        ...current,
        providers: current.providers.map((candidate) => candidate.id === provider.id ? { ...candidate, health: result.health } : candidate),
      } : current);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "连接测试失败。");
    } finally {
      setTestingProviderId(null);
    }
  };

  const publishCatalog = async () => {
    if (!catalog) return;
    setSaving(true);
    setPageError(null);
    setNotice(null);
    const now = new Date();
    const nextCatalog: RenWorkAdminModelCatalog = {
      ...catalog,
      version: `renwork-model-catalog-${now.toISOString().replaceAll("-", "").replaceAll(":", "").replaceAll(".", "").replaceAll("T", "").replaceAll("Z", "").slice(0, 14)}`,
      updatedAt: now.toISOString(),
    };
    try {
      validateDraftCatalog(nextCatalog);
      const { response, payload } = await requestJson("/v1/admin/model-catalog", {
        method: "PUT",
        body: JSON.stringify({ expectedVersion: savedVersion, catalog: nextCatalog }),
      });
      if (!response.ok) throw new Error(errorMessage(payload, `发布失败（${response.status}）。`));
      const parsed = parseCatalogPayload(payload);
      if (!parsed) throw new Error("发布成功但返回的目录无效，请刷新确认。");
      setCatalog(parsed);
      setSavedVersion(parsed.version);
      setNotice(`目录 ${parsed.version} 已发布，普通用户模型选择器将读取新目录。`);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "模型目录发布失败。");
    } finally {
      setSaving(false);
    }
  };

  if (accessState !== "ready" || !catalog) {
    const copy = accessState === "loading"
      ? "正在验证平台超级管理员权限并加载模型目录…"
      : accessState === "signed-out"
        ? "请先登录 RenWork 云端账号。"
        : accessState === "forbidden"
          ? "当前账号不在平台超级管理员白名单中。"
          : pageError ?? "模型目录暂不可用。";
    return (
      <section className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-8" data-testid="model-catalog-access" data-access-state={accessState}>
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            {accessState === "loading" ? <RefreshCw className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">RenWork 超级管理员验证</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            {accessState === "error" ? (
              <button type="button" onClick={() => void loadCatalog()} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">重新加载</button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const publishedCount = catalog.models.filter((model) => model.status === "published").length;
  const healthyProviderCount = catalog.providers.filter((provider) => provider.enabled && provider.health === "healthy").length;

  return (
    <section className="mx-auto w-full max-w-7xl" data-testid="renwork-model-catalog-admin">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="目录状态" value={catalog.status === "active" ? "已启用" : catalog.status} detail={catalog.version} />
        <StatCard label="供应商" value={`${catalog.providers.length}`} detail={`${healthyProviderCount} 个健康且启用`} />
        <StatCard label="用户模型" value={`${publishedCount}`} detail={`${catalog.models.length} 个模型配置`} />
        <StatCard label="用户预览" value={`${publicPreview?.models.length ?? 0}`} detail="只展示 RenWork SKU 与倍率" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-white p-2" role="tablist" aria-label="模型目录配置">
        {([
          ["policy", "计费策略"],
          ["providers", "供应商网关"],
          ["models", "模型与路由"],
          ["settlements", "结算审计"],
          ["preview", "用户预览"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={activeTab === value}
            onClick={() => setActiveTab(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === value ? "bg-orange-600 text-white" : "text-slate-600 hover:bg-orange-50 hover:text-orange-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pageError ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{pageError}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>{notice}</p>
        </div>
      ) : null}

      {activeTab === "policy" ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-3xl border border-orange-100 bg-white p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><ServerCog className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">统一 Token 计费策略</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">输入、输出、推理、缓存读取和缓存写入都会记录。选择“按 Token 扣费”时统一从 RenCredit 结算。</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {([
                ["official", "RenWork 官方模型", "平台托管供应商与中转网关"],
                ["byok", "企业自有 Key", "由企业配置的第三方模型账户"],
                ["local", "本地运行模型", "Ollama、OpenCode 或本地运行时"],
              ] as const).map(([source, title, description]) => (
                <label key={source} className="rounded-2xl border border-slate-200 p-4">
                  <span className="block text-sm font-semibold text-slate-950">{title}</span>
                  <span className="mt-1 block min-h-10 text-xs leading-5 text-slate-500">{description}</span>
                  <select
                    aria-label={`${title}计费模式`}
                    value={catalog.billingPolicy[source]}
                    onChange={(event) => setCatalog({ ...catalog, billingPolicy: { ...catalog.billingPolicy, [source]: event.target.value as RenWorkBillingMode } })}
                    className={`${fieldClass} mt-3`}
                  >
                    <option value="token_metered">按 Token 扣 RenCredit</option>
                    <option value="free">只记录用量，不扣 RenCredit</option>
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-orange-100 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-950">目录发布状态</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="目录状态" hint="只有 active 目录应提供给普通用户。">
                <select value={catalog.status} onChange={(event) => setCatalog({ ...catalog, status: event.target.value as RenWorkAdminModelCatalog["status"] })} className={fieldClass}>
                  <option value="draft">草稿</option>
                  <option value="active">启用</option>
                  <option value="retired">停用</option>
                </select>
              </Field>
              <Field label="当前版本" hint="发布时自动生成新版本，并使用旧版本做并发冲突保护。">
                <input value={catalog.version} disabled className={fieldClass} />
              </Field>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "providers" ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            服务端供应商只填写 <code className="rounded bg-white/70 px-1.5 py-0.5">env://变量名</code> 或 <code className="rounded bg-white/70 px-1.5 py-0.5">secret://路径</code> 引用；真实 Key 必须注入服务端，浏览器不会读取或回显。个人账号选择“设备 OAuth”：每台电脑独立授权，原始 OAuth 凭据只保存在该设备的系统安全存储中，不上传云端、不在团队成员之间共享。
          </div>
          <div className="rounded-3xl border border-orange-100 bg-white p-6" data-testid="metered-runtime-devices">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">个人 OAuth 设备审批</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">只批准设备公钥和执行资格；云端不会接收、保存或转发 OpenAI / Google 的个人 OAuth 凭据。</p>
              </div>
              <button type="button" onClick={() => void loadDevices()} disabled={devicesLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                <RefreshCw className={`size-3.5 ${devicesLoading ? "animate-spin" : ""}`} />刷新设备
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {devices.map((device) => (
                <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4" data-device-status={device.status}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{device.deviceId}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{device.organizationId} · {device.memberId} · {device.publicKeyFingerprint.slice(0, 16)}…</p>
                    <p className="mt-1 text-xs text-slate-500">状态：{device.status} · 最近在线：{new Date(device.lastSeenAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    {device.status !== "active" ? <button type="button" onClick={() => void updateDeviceStatus(device, "active")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">批准</button> : null}
                    {device.status !== "revoked" ? <button type="button" onClick={() => void updateDeviceStatus(device, "revoked")} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">撤销</button> : null}
                  </div>
                </div>
              ))}
              {!devicesLoading && devices.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">暂无待审批或已注册的个人设备。</p> : null}
            </div>
          </div>
          {catalog.providers.map((provider, index) => {
            const testResult = providerResults[provider.id];
            return (
              <article key={`${provider.id}-${index}`} className="rounded-3xl border border-orange-100 bg-white p-6" data-testid="provider-editor">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{provider.displayName}</h2>
                    <p className="mt-1 text-xs text-slate-500">{provider.id} · {provider.kind} · {provider.health}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={testingProviderId === provider.id} onClick={() => void testProviderConnection(provider)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
                      <RefreshCw className={`size-3.5 ${testingProviderId === provider.id ? "animate-spin" : ""}`} />{provider.authMode === "device_oauth" ? "适配器自检" : "连接测试"}
                    </button>
                    <button type="button" onClick={() => removeProvider(index)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 className="size-3.5" />删除</button>
                  </div>
                </div>
                {testResult ? (
                  <div className={`mt-4 rounded-xl border p-3 text-xs ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    {testResult.message} · {testResult.latencyMs} ms{testResult.statusCode ? ` · HTTP ${testResult.statusCode}` : ""}
                  </div>
                ) : null}
                <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="内部 ID"><input value={provider.id} onChange={(event) => updateProviderId(index, slug(event.target.value))} className={fieldClass} /></Field>
                  <Field label="显示名称"><input value={provider.displayName} onChange={(event) => replaceProvider(index, { ...provider, displayName: event.target.value })} className={fieldClass} /></Field>
                  <Field label="供应商类型">
                    <select value={provider.kind} onChange={(event) => replaceProvider(index, { ...provider, kind: event.target.value as RenWorkProviderKind })} className={fieldClass}>
                      {(["direct", "relay", "runtime", "custom", "byok", "local"] as const).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                    </select>
                  </Field>
                  <Field label="兼容协议">
                    <select value={provider.protocol} onChange={(event) => replaceProvider(index, { ...provider, protocol: event.target.value as RenWorkProviderProtocol })} className={fieldClass}>
                      {(["openai_compatible", "anthropic_compatible", "gemini", "opencode", "codex_cli", "antigravity_cli", "local"] as const).map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}
                    </select>
                  </Field>
                  <Field label="认证方式">
                    <select value={provider.authMode} onChange={(event) => replaceProvider(index, withProviderAuthMode(provider, event.target.value as RenWorkProviderAuthMode))} className={fieldClass} data-testid="provider-auth-mode">
                      <option value="service_secret">服务端密钥</option>
                      <option value="device_oauth">设备 OAuth（个人账号）</option>
                      <option value="none">无需认证</option>
                    </select>
                  </Field>
                  {provider.authMode === "service_secret" ? (
                    <>
                      <Field label="Base URL"><input value={provider.baseUrl ?? ""} onChange={(event) => replaceProvider(index, { ...provider, baseUrl: event.target.value.trim() || null })} placeholder="https://api.example.com/v1" className={fieldClass} /></Field>
                      <Field label="服务端密钥引用" hint="不填写真实 API Key。"><input value={provider.credentialRef ?? ""} onChange={(event) => replaceProvider(index, { ...provider, credentialRef: event.target.value.trim() || null })} placeholder="env://OPENROUTER_API_KEY" className={fieldClass} /></Field>
                    </>
                  ) : null}
                  {provider.authMode === "device_oauth" && provider.deviceOAuthPolicy ? (
                    <>
                      <Field label="每用户最多设备数" hint="同一用户的每台电脑都要单独授权。"><input type="number" min="1" value={provider.deviceOAuthPolicy.maxDevicesPerUser} onChange={(event) => replaceProvider(index, { ...provider, deviceOAuthPolicy: { ...provider.deviceOAuthPolicy!, maxDevicesPerUser: Number(event.target.value) } })} className={fieldClass} /></Field>
                      <Field label="每用户最大并发" hint="并发任务仍统一预占并扣除 RenCredit。"><input type="number" min="1" value={provider.deviceOAuthPolicy.maxConcurrentRunsPerUser} onChange={(event) => replaceProvider(index, { ...provider, deviceOAuthPolicy: { ...provider.deviceOAuthPolicy!, maxConcurrentRunsPerUser: Number(event.target.value) } })} className={fieldClass} /></Field>
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 lg:col-span-2" data-testid="device-oauth-policy-note">
                        凭据存储：系统安全存储 · 执行位置：个人设备 · 共享范围：仅当前用户。云端只保存设备状态、策略和不含内容的 RenCredit 用量收据。
                      </div>
                    </>
                  ) : null}
                  <Field label="健康状态">
                    <select value={provider.health} onChange={(event) => replaceProvider(index, { ...provider, health: event.target.value as RenWorkAdminProvider["health"] })} className={fieldClass}>
                      <option value="unknown">unknown</option><option value="healthy">healthy</option><option value="degraded">degraded</option><option value="offline">offline</option>
                    </select>
                  </Field>
                  <div className="flex items-end pb-2"><Toggle checked={provider.enabled} onChange={(enabled) => replaceProvider(index, { ...provider, enabled })} label="启用此供应商" /></div>
                </div>
              </article>
            );
          })}
          <button type="button" onClick={() => setCatalog({ ...catalog, providers: [...catalog.providers, newProvider(catalog.providers.length)] })} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />新增供应商</button>
        </div>
      ) : null}

      {activeTab === "models" ? (
        <div className="mt-5 space-y-4">
          {catalog.models.map((model, modelIndex) => (
            <article key={`${model.sku}-${modelIndex}`} className="rounded-3xl border border-orange-100 bg-white p-6" data-testid="model-editor">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{model.displayName}</h2>
                  <p className="mt-1 text-xs text-slate-500">{model.sku} · {model.tier} · {formatMultiplier(model.displayMultiplierBps)}</p>
                </div>
                <button type="button" onClick={() => setCatalog({ ...catalog, models: catalog.models.filter((_, index) => index !== modelIndex) })} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 className="size-3.5" />删除模型</button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="稳定模型 SKU"><input value={model.sku} onChange={(event) => replaceModel(modelIndex, { ...model, sku: slug(event.target.value) })} className={fieldClass} /></Field>
                <Field label="用户显示名称"><input value={model.displayName} onChange={(event) => replaceModel(modelIndex, { ...model, displayName: event.target.value })} className={fieldClass} /></Field>
                <Field label="能力档位">
                  <select value={model.tier} onChange={(event) => replaceModel(modelIndex, { ...model, tier: event.target.value as RenWorkAdminModel["tier"] })} className={fieldClass}>
                    <option value="auto">智能 Auto</option><option value="standard">标准</option><option value="professional">专业</option><option value="ultimate">极致</option>
                  </select>
                </Field>
                <Field label="发布状态">
                  <select value={model.status} onChange={(event) => replaceModel(modelIndex, { ...model, status: event.target.value as RenWorkAdminModel["status"] })} className={fieldClass}>
                    <option value="draft">草稿</option><option value="published">发布</option><option value="paused">暂停</option><option value="retired">退役</option>
                  </select>
                </Field>
                <Field label="上下文窗口"><input type="number" min="1" value={model.contextWindow ?? ""} onChange={(event) => replaceModel(modelIndex, { ...model, contextWindow: event.target.value ? Number(event.target.value) : null })} className={fieldClass} /></Field>
                <Field label="用户展示倍率"><input type="number" min="0" step="0.01" value={model.displayMultiplierBps / 10_000} onChange={(event) => replaceModel(modelIndex, { ...model, displayMultiplierBps: Math.round(Number(event.target.value) * 10_000) })} className={fieldClass} /></Field>
                <Field label="实际计价倍率"><input type="number" min="0" step="0.01" value={model.priceMultiplierBps / 10_000} onChange={(event) => replaceModel(modelIndex, { ...model, priceMultiplierBps: Math.round(Number(event.target.value) * 10_000) })} className={fieldClass} /></Field>
                <Field label="排序"><input type="number" min="0" value={model.sortOrder} onChange={(event) => replaceModel(modelIndex, { ...model, sortOrder: Number(event.target.value) })} className={fieldClass} /></Field>
                <Field label="标签" hint="逗号分隔"><input value={model.tags.join(", ")} onChange={(event) => replaceModel(modelIndex, { ...model, tags: splitList(event.target.value) })} className={fieldClass} /></Field>
                <Field label="允许套餐" hint="逗号分隔"><input value={model.allowedPlanIds.join(", ")} onChange={(event) => replaceModel(modelIndex, { ...model, allowedPlanIds: splitList(event.target.value) })} className={fieldClass} /></Field>
                <div className="flex items-end pb-2"><Toggle checked={model.autoEligible} onChange={(autoEligible) => replaceModel(modelIndex, { ...model, autoEligible })} label="允许 Auto 调度" /></div>
              </div>
              <Field label="用户说明">
                <textarea value={model.description} onChange={(event) => replaceModel(modelIndex, { ...model, description: event.target.value })} className={`${textAreaClass} mt-4`} />
              </Field>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-950">五类 Token 单价（RenCredit / 100 万 Token）</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {([
                    ["inputMicroCreditsPerMillion", "输入"],
                    ["outputMicroCreditsPerMillion", "输出"],
                    ["reasoningMicroCreditsPerMillion", "推理"],
                    ["cacheReadMicroCreditsPerMillion", "缓存读取"],
                    ["cacheWriteMicroCreditsPerMillion", "缓存写入"],
                  ] as const).map(([rateKey, label]) => (
                    <Field key={rateKey} label={label}>
                      <input type="number" min="0" step="0.000001" value={model.rates[rateKey] / 1_000_000} onChange={(event) => replaceModel(modelIndex, { ...model, rates: { ...model.rates, [rateKey]: Math.round(Number(event.target.value) * 1_000_000) } })} className={fieldClass} />
                    </Field>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-950">限时优惠</h3>
                  <Toggle checked={model.promotion !== null} onChange={(enabled) => replaceModel(modelIndex, { ...model, promotion: enabled ? { label: "限时优惠", multiplierBps: 5_000, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString() } : null })} label="启用" />
                </div>
                {model.promotion ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <Field label="优惠标签"><input value={model.promotion.label} onChange={(event) => replaceModel(modelIndex, { ...model, promotion: model.promotion ? { ...model.promotion, label: event.target.value } : null })} className={fieldClass} /></Field>
                    <Field label="折扣百分比"><input type="number" min="0" max="100" value={model.promotion.multiplierBps / 100} onChange={(event) => replaceModel(modelIndex, { ...model, promotion: model.promotion ? { ...model.promotion, multiplierBps: Math.round(Number(event.target.value) * 100) } : null })} className={fieldClass} /></Field>
                    <Field label="开始时间"><input type="datetime-local" value={localDateTime(model.promotion.startsAt)} onChange={(event) => replaceModel(modelIndex, { ...model, promotion: model.promotion ? { ...model.promotion, startsAt: isoDateTime(event.target.value) } : null })} className={fieldClass} /></Field>
                    <Field label="结束时间"><input type="datetime-local" value={localDateTime(model.promotion.endsAt)} onChange={(event) => replaceModel(modelIndex, { ...model, promotion: model.promotion ? { ...model.promotion, endsAt: isoDateTime(event.target.value) } : null })} className={fieldClass} /></Field>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-semibold text-slate-950">私有路由</h3><p className="mt-1 text-xs text-slate-500">按优先级选择健康供应商；普通用户不会看到这些名称。</p></div>
                  <button type="button" disabled={catalog.providers.length === 0} onClick={() => replaceModel(modelIndex, { ...model, routes: [...model.routes, newRoute(model.sku, model.routes.length, catalog.providers[0]?.id ?? "")] })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"><Plus className="size-3.5" />新增路由</button>
                </div>
                <div className="mt-4 space-y-3">
                  {model.routes.map((route, routeIndex) => (
                    <div key={`${route.id}-${routeIndex}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-6">
                      <Field label="路由 ID"><input value={route.id} onChange={(event) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, id: slug(event.target.value) } : candidate) })} className={fieldClass} /></Field>
                      <Field label="供应商">
                        <select value={route.providerId} onChange={(event) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, providerId: event.target.value } : candidate) })} className={fieldClass}>
                          {catalog.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.displayName}</option>)}
                        </select>
                      </Field>
                      <Field label="上游模型 ID"><input value={route.upstreamModelId} onChange={(event) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, upstreamModelId: event.target.value } : candidate) })} className={fieldClass} /></Field>
                      <Field label="来源">
                        <select value={route.source} onChange={(event) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, source: event.target.value as RenWorkRouteSource } : candidate) })} className={fieldClass}>
                          <option value="official">official</option><option value="byok">byok</option><option value="local">local</option>
                        </select>
                      </Field>
                      <Field label="优先级"><input type="number" min="0" value={route.priority} onChange={(event) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, priority: Number(event.target.value) } : candidate) })} className={fieldClass} /></Field>
                      <div className="flex items-end justify-between gap-2 pb-1"><Toggle checked={route.enabled} onChange={(enabled) => replaceModel(modelIndex, { ...model, routes: model.routes.map((candidate, index) => index === routeIndex ? { ...route, enabled } : candidate) })} label="启用" /><button type="button" aria-label="删除路由" onClick={() => replaceModel(modelIndex, { ...model, routes: model.routes.filter((_, index) => index !== routeIndex) })} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button></div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
          <button type="button" onClick={() => setCatalog({ ...catalog, models: [...catalog.models, newModel(catalog.models.length, catalog.providers[0]?.id ?? "")] })} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4" />新增模型</button>
        </div>
      ) : null}

      {activeTab === "settlements" ? (
        <div className="mt-5 space-y-5" data-testid="rencredit-settlement-audit">
          <div className="rounded-3xl border border-orange-100 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">RenCredit 实时结算审计</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">平台超级管理员可核对租户钱包、冻结、扣费、失败释放、模型 SKU 与实际私有路由。这里不显示密钥、提示词或模型回复内容。</p>
              </div>
              <button type="button" onClick={() => void loadSettlements()} disabled={settlementsLoading} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                <RefreshCw className={`size-4 ${settlementsLoading ? "animate-spin" : ""}`} />刷新审计
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Field label="组织 ID" hint="留空查看全部租户。"><input value={settlementOrganizationId} onChange={(event) => setSettlementOrganizationId(event.target.value)} placeholder="organization_…" className={fieldClass} /></Field>
              <Field label="结算状态"><select value={settlementStatus} onChange={(event) => setSettlementStatus(event.target.value)} className={fieldClass}><option value="">全部</option><option value="reserved">冻结中</option><option value="captured">已扣费</option><option value="released">已释放</option></select></Field>
              <div className="flex items-end"><button type="button" onClick={() => void loadSettlements()} disabled={settlementsLoading} className="h-10 w-full rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 disabled:opacity-50">应用筛选</button></div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(settlementAudit?.wallets ?? []).map((wallet) => (
              <div key={wallet.organizationId} className="rounded-2xl border border-orange-100 bg-white p-5" data-testid="rencredit-wallet-card">
                <p className="truncate text-sm font-semibold text-slate-950">{wallet.organizationName ?? wallet.organizationId}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{wallet.organizationId}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">可用余额</dt><dd className="mt-1 font-semibold text-slate-950">{formatMicroCredits(wallet.availableMicroCredits)}</dd></div><div><dt className="text-slate-500">冻结余额</dt><dd className="mt-1 font-semibold text-amber-700">{formatMicroCredits(wallet.reservedMicroCredits)}</dd></div></dl>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white">
            <div className="border-b border-slate-100 px-6 py-4"><h3 className="font-semibold text-slate-950">任务结算收据</h3><p className="mt-1 text-xs text-slate-500">按最新 100 条展示冻结、扣费与释放结果。</p></div>
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">租户 / 时间</th><th className="px-4 py-3">模型与路由</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">冻结 / 扣费 / 释放</th><th className="px-4 py-3">Token 用量</th></tr></thead><tbody className="divide-y divide-slate-100">
              {(settlementAudit?.reservations ?? []).map((reservation) => {
                const usage = reservation.actualUsage ?? {};
                const tokenTotal = Object.values(usage).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
                return <tr key={reservation.id} data-settlement-status={reservation.status}><td className="whitespace-nowrap px-4 py-3"><p className="font-medium text-slate-900">{reservation.organizationName ?? reservation.organizationId}</p><p className="mt-1 text-slate-500">{reservation.createdAt ? new Date(reservation.createdAt).toLocaleString() : "—"}</p></td><td className="px-4 py-3"><p className="font-medium text-slate-900">{reservation.modelSku}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{reservation.providerId} · {reservation.routeId} · {reservation.upstreamModelId}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 font-semibold ${reservation.status === "captured" ? "bg-emerald-50 text-emerald-700" : reservation.status === "released" ? "bg-slate-100 text-slate-700" : "bg-amber-50 text-amber-700"}`}>{reservation.status === "captured" ? "已扣费" : reservation.status === "released" ? "已释放" : "冻结中"}</span>{reservation.failureCode ? <p className="mt-2 text-red-600">{reservation.failureCode}</p> : null}</td><td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMicroCredits(reservation.reservedMicroCredits)} / {formatMicroCredits(reservation.capturedMicroCredits)} / {formatMicroCredits(reservation.releasedMicroCredits)}</td><td className="px-4 py-3 text-slate-700">{tokenTotal.toLocaleString()}</td></tr>;
              })}
            </tbody></table></div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-orange-100 bg-white">
            <div className="border-b border-slate-100 px-6 py-4"><h3 className="font-semibold text-slate-950">不可变租户账本</h3><p className="mt-1 text-xs text-slate-500">每笔 reserve、capture、release、grant、refund 和 adjustment 均保留余额变化。</p></div>
            <div className="divide-y divide-slate-100">{(settlementAudit?.ledger ?? []).map((entry) => <div key={entry.id} className="grid gap-2 px-6 py-4 text-xs md:grid-cols-5"><div className="md:col-span-2"><p className="font-medium text-slate-900">{entry.organizationName ?? entry.organizationId}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{entry.id}</p></div><p className="font-semibold text-slate-800">{entry.entryType}</p><p className="text-slate-600">可用 {entry.availableDeltaMicroCredits >= 0 ? "+" : ""}{formatMicroCredits(entry.availableDeltaMicroCredits)}<br />冻结 {entry.reservedDeltaMicroCredits >= 0 ? "+" : ""}{formatMicroCredits(entry.reservedDeltaMicroCredits)}</p><p className="text-slate-500">{entry.reasonCode}<br />{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}</p></div>)}</div>
          </div>
        </div>
      ) : null}

      {activeTab === "preview" ? (
        <div className="mt-5 rounded-3xl border border-orange-100 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Users className="size-5" /></div>
            <div><h2 className="text-lg font-semibold text-slate-950">普通用户模型选择器预览</h2><p className="mt-1 text-sm text-slate-600">供应商、Base URL、密钥引用和上游模型 ID 已全部隐藏。</p></div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {publicPreview?.models.map((model) => (
              <div key={model.sku} className="rounded-2xl border border-slate-200 p-5" data-testid="member-model-preview">
                <div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-slate-950">{model.displayName}</p><p className="mt-1 text-xs text-slate-500">{model.tier} · {model.sku}</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">{formatMultiplier(model.effectiveDisplayMultiplierBps)}</span></div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{model.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">{model.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>)}<span className={`rounded-full px-2.5 py-1 text-xs ${model.billingMode === "token_metered" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{model.billingMode === "token_metered" ? "按实际 Token 扣 RenCredit" : "记录用量，不扣 RenCredit"}</span></div>
              </div>
            ))}
          </div>
          {!publicPreview || publicPreview.models.length === 0 ? <p className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">当前没有可发布给用户的健康模型。请检查模型状态、路由和供应商健康状态。</p> : null}
        </div>
      ) : null}

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-white/95 p-4 backdrop-blur" data-testid="model-catalog-publish-bar">
        <div><p className="text-sm font-semibold text-slate-950">发布会立即更新普通用户可见的模型目录</p><p className="mt-1 text-xs text-slate-500">使用版本冲突保护；不会向前端下发任何供应商密钥。</p></div>
        <button type="button" onClick={() => void publishCatalog()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"><Save className="size-4" />{saving ? "正在发布…" : "发布目录"}</button>
      </div>
    </section>
  );
}
