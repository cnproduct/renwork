"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { INFERENCE_MODEL_ALIASES } from "@openwork/types/den/inference";
import {
  renworkPlanCatalogSchema,
  type RenworkPlan,
  type RenworkPlanAudience,
  type RenworkPlanCatalog,
  type RenworkPlanOffer,
} from "@openwork/types/renwork-commerce";
import { DenButton } from "../../_components/ui/button";
import { DenCard } from "../../_components/ui/card";
import { DenNotice } from "../../_components/ui/notice";
import { DenPageHeader } from "../../_components/ui/page-header";
import { DenSectionHeader } from "../../_components/ui/section-header";
import { DenTable, type DenTableColumn } from "../../_components/ui/table";
import { getErrorMessage, getRequestError, requestJson } from "../../_lib/den-flow";
import { getBillingRoute, getCustomLlmProvidersRoute, getOrgAccessFlags } from "../../_lib/den-org";
import { useDenFlow } from "../../_providers/den-flow-provider";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";

type InferenceWindowType = "five_hour" | "weekly" | "monthly";

type InferenceUsageBucket = {
  windowType: InferenceWindowType;
  windowStartAt: string;
  windowEndAt: string;
  limitAmount: number;
  usedAmount: number;
};

type InferenceStatus = {
  enabled: boolean;
  tier: "tier1" | "tier2";
  memberCount: number;
  proxyBaseUrl: string;
  upstreamProviderConfigured: boolean;
  subscribed: boolean;
  subscriptionRequest: SubscriptionRequest | null;
  buckets: InferenceUsageBucket[];
};

type SubscriptionRequest = {
  id: string;
  status: "pending";
  catalogVersion: string;
  planId: string;
  offerId: string;
  requestedBy: string;
  requestedAt: string;
};

type BillingInterval = "monthly" | "annual";

type CodexCloudStatus = {
  state: "disconnected" | "pending" | "connected" | "expired" | "error" | "unavailable";
  email?: string | null;
  planType?: string;
  model?: string;
  modelSku?: string | null;
  verificationUrl?: string;
  userCode?: string;
  message?: string;
};

function parseCodexCloudStatus(value: unknown): CodexCloudStatus | null {
  if (!value || typeof value !== "object" || !("state" in value)) return null;
  const state = value.state;
  if (state !== "disconnected" && state !== "pending" && state !== "connected"
    && state !== "expired" && state !== "error" && state !== "unavailable") return null;
  const field = (key: string) => key in value ? Reflect.get(value, key) : undefined;
  return {
    state,
    email: typeof field("email") === "string" ? field("email") : null,
    planType: typeof field("planType") === "string" ? field("planType") : undefined,
    model: typeof field("model") === "string" ? field("model") : undefined,
    modelSku: typeof field("modelSku") === "string" ? field("modelSku") : null,
    verificationUrl: typeof field("verificationUrl") === "string" ? field("verificationUrl") : undefined,
    userCode: typeof field("userCode") === "string" ? field("userCode") : undefined,
    message: typeof field("message") === "string" ? field("message") : undefined,
  };
}

const WINDOW_LABEL: Record<InferenceWindowType, string> = {
  five_hour: "5 hour usage limit",
  weekly: "Weekly usage limit",
  monthly: "Monthly usage limit",
};

const WINDOW_ORDER: InferenceWindowType[] = ["five_hour", "weekly", "monthly"];

function isWindowType(value: unknown): value is InferenceWindowType {
  return value === "five_hour" || value === "weekly" || value === "monthly";
}

function parseUsageBuckets(value: unknown): InferenceUsageBucket[] {
  if (!Array.isArray(value)) return [];
  const buckets: InferenceUsageBucket[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<InferenceUsageBucket>;
    if (
      !isWindowType(candidate.windowType) ||
      typeof candidate.windowStartAt !== "string" ||
      typeof candidate.windowEndAt !== "string" ||
      typeof candidate.limitAmount !== "number" ||
      typeof candidate.usedAmount !== "number"
    ) {
      continue;
    }
    buckets.push({
      windowType: candidate.windowType,
      windowStartAt: candidate.windowStartAt,
      windowEndAt: candidate.windowEndAt,
      limitAmount: candidate.limitAmount,
      usedAmount: candidate.usedAmount,
    });
  }
  return buckets;
}

function parseInferencePayload(payload: unknown): InferenceStatus | null {
  if (!payload || typeof payload !== "object" || !("inference" in payload)) {
    return null;
  }
  const inference = (payload as { inference?: unknown }).inference;
  if (!inference || typeof inference !== "object") {
    return null;
  }
  const value = inference as Partial<InferenceStatus> & { buckets?: unknown };
  const request = value.subscriptionRequest;
  const subscriptionRequest = request
    && typeof request === "object"
    && request.status === "pending"
    && typeof request.id === "string"
    && typeof request.catalogVersion === "string"
    && typeof request.planId === "string"
    && typeof request.offerId === "string"
    && typeof request.requestedBy === "string"
    && typeof request.requestedAt === "string"
    ? request
    : null;
  if (typeof value.enabled !== "boolean" || (value.tier !== "tier1" && value.tier !== "tier2")) {
    return null;
  }
  return {
    enabled: value.enabled,
    tier: value.tier,
    memberCount: typeof value.memberCount === "number" ? value.memberCount : 0,
    proxyBaseUrl: typeof value.proxyBaseUrl === "string" ? value.proxyBaseUrl : "",
    upstreamProviderConfigured: value.upstreamProviderConfigured === true,
    subscribed: value.subscribed === true,
    subscriptionRequest,
    buckets: parseUsageBuckets(value.buckets),
  };
}

function formatResetLabel(bucket: InferenceUsageBucket): string {
  const reset = new Date(bucket.windowEndAt);
  if (Number.isNaN(reset.getTime())) return "—";
  if (bucket.windowType === "five_hour") {
    return `Resets ${reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Resets ${reset.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function computeRemainingPercent(bucket: InferenceUsageBucket): number {
  if (bucket.limitAmount <= 0) return 0;
  const ratio = 1 - bucket.usedAmount / bucket.limitAmount;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, ratio * 100));
}

function UsageLimitsCard({ buckets }: { buckets: InferenceUsageBucket[] }) {
  const ordered = WINDOW_ORDER
    .map((windowType) => buckets.find((bucket) => bucket.windowType === windowType))
    .filter((bucket): bucket is InferenceUsageBucket => Boolean(bucket));

  if (ordered.length === 0) return null;

  return (
    <DenCard className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-6 py-4">
        <DenSectionHeader
          title="Usage limits"
          description="Shared across your organization and scale with the number of active members."
        />
      </div>
      <ul className="divide-y divide-gray-100">
        {ordered.map((bucket) => {
          const remaining = computeRemainingPercent(bucket);
          return (
            <li key={bucket.windowType} className="flex items-center gap-6 px-6 py-5">
              <div className="min-w-[200px]">
                <p className="text-[15px] font-medium text-gray-950">{WINDOW_LABEL[bucket.windowType]}</p>
                <p className="mt-1 text-[13px] text-gray-500">{formatResetLabel(bucket)}</p>
              </div>
              <div className="flex flex-1 items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-900 transition-[width] duration-500"
                    style={{ width: `${remaining}%` }}
                  />
                </div>
                <span className="min-w-[80px] text-right text-[13px] font-medium text-gray-700">
                  {remaining.toFixed(1)}% left
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </DenCard>
  );
}

/**
 * Editorial detail per model: what a knowledge worker should reach for it for,
 * and the vendor monogram shown in the lineup table. Keyed by model alias so
 * unmapped models still render with sane defaults.
 */
const MODEL_DETAILS: Record<string, { bestFor: string; monogram: string } | undefined> = {
  "renwork-auto": { bestFor: "Automatic task routing", monogram: "RW" },
  "renwork-standard": { bestFor: "Efficient everyday work", monogram: "RW" },
  "renwork-professional": { bestFor: "Complex business workflows", monogram: "RW" },
  "renwork-ultimate": { bestFor: "Highest-quality reasoning", monogram: "RW" },
  "renwork-code-kimi-k3": { bestFor: "Coding & agentic workflows", monogram: "RW" },
  "moonshotai/kimi-k3": { bestFor: "Research & synthesis", monogram: "MS" },
  "z-ai/glm-5.2": { bestFor: "Multi-step tasks", monogram: "ZA" },
  "moonshotai/kimi-k2.7-code": { bestFor: "Spreadsheets & scripts", monogram: "MS" },
  "tencent/hy3-preview": { bestFor: "Long documents", monogram: "TC" },
  "moonshotai/kimi-k2.6": { bestFor: "Everyday drafting", monogram: "MS" },
  "deepseek/deepseek-v4-flash": { bestFor: "Quick summaries", monogram: "DS" },
  "minimax/minimax-m2.7": { bestFor: "Tools & integrations", monogram: "MM" },
  "minimax/minimax-m3": { bestFor: "Images & screenshots", monogram: "MM" },
  "z-ai/glm-5.1": { bestFor: "Balanced default", monogram: "ZA" },
};

type LineupModel = {
  id: string;
  name: string;
  bestFor: string;
  monogram: string;
};

const MODEL_LINEUP: LineupModel[] = Object.entries(INFERENCE_MODEL_ALIASES)
  .filter(([, model]) => model.enabled)
  .map(([id, model]) => {
    const detail = MODEL_DETAILS[id];
    return {
      id,
      name: model.displayName.replace(/^RenWork:\s*/, ""),
      bestFor: detail?.bestFor ?? "General knowledge work",
      monogram: detail?.monogram ?? id.split("/")[0].slice(0, 2).toUpperCase(),
    };
  });

const MODEL_COLUMNS: readonly DenTableColumn<LineupModel>[] = [
  {
    key: "model",
    header: "Model",
    render: (model) => (
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-gray-100 text-[9px] font-semibold tracking-[0.02em] text-gray-500"
        >
          {model.monogram}
        </span>
        <span className="text-[13px] font-medium text-gray-900">{model.name}</span>
      </div>
    ),
  },
  {
    key: "bestFor",
    header: "Best for",
    width: "190px",
    render: (model) => <span className="text-[13px] text-gray-500">{model.bestFor}</span>,
  },
  {
    key: "id",
    header: "Model ID",
    width: "230px",
    render: (model) => <span className="whitespace-nowrap font-mono text-[12px] text-gray-500">{model.id}</span>,
  },
];

const PILLARS = [
  {
    label: "Offline activation",
    body: "Every personal and enterprise plan supports offline payment while online checkout is unavailable.",
  },
  {
    label: "Nothing to set up",
    body: "Every member is provisioned automatically. No provider accounts, no API keys.",
  },
  {
    label: "RenCredit metering",
    body: "Model usage is metered through the authoritative RenCredit wallet, reservation, settlement, and receipt ledger.",
  },
];

const STEPS: ReactNode[] = [
  "Choose a plan from the authoritative RenWork catalog",
  "Submit an offline activation request and complete the transfer or offline contract",
  "A platform super-admin verifies the payment and activates the plan",
  <>
    After approval, open RenWork and pick any model from the{" "}
    <code className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[12px] text-gray-700">RenWork</code> group
  </>,
  "Start working — usage is settled against your RenCredit balance",
];

function offerForInterval(plan: RenworkPlan, interval: BillingInterval): RenworkPlanOffer | null {
  return plan.offers.find((offer) => offer.billingInterval === interval)
    ?? plan.offers.find((offer) => offer.billingInterval === null)
    ?? null;
}

function formatOfferPrice(offer: RenworkPlanOffer) {
  if (offer.purchaseMode === "contact_sales") return "Contact sales";
  if (offer.purchaseMode === "request_trial") return "Pilot application";
  if (offer.purchaseMode === "free") return "Free";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: 0,
  }).format(offer.priceMinor / 100);
}

function PlanRequestCard({
  plan,
  offer,
  busy,
  pending,
  canManage,
  onRequest,
}: {
  plan: RenworkPlan;
  offer: RenworkPlanOffer;
  busy: boolean;
  pending: boolean;
  canManage: boolean;
  onRequest: (offerId: string) => void;
}) {
  const requestable = offer.purchaseMode === "request_access" || offer.purchaseMode === "contact_sales";
  return (
    <article className={`flex min-h-[260px] flex-col rounded-[16px] border bg-white p-5 ${plan.recommended ? "border-emerald-400 shadow-sm" : "border-gray-100"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-950">{plan.displayName}</h3>
          <p className="mt-1 text-[12px] leading-5 text-gray-500">{plan.summary}</p>
        </div>
        {plan.badge ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{plan.badge}</span> : null}
      </div>
      <div className="mt-4 text-2xl font-semibold text-gray-950">{formatOfferPrice(offer)}</div>
      <div className="mt-1 text-[11px] text-gray-500">
        {offer.billingInterval === "monthly" ? "Monthly subscription" : offer.billingInterval === "annual" ? "Annual subscription" : "Custom agreement"}
      </div>
      {offer.includedRenCredits !== null ? (
        <div className="mt-4 text-[12px] text-gray-600">{offer.includedRenCredits.toLocaleString()} RenCredit / month</div>
      ) : null}
      {plan.seatLimit ? <div className="mt-1 text-[12px] text-gray-600">Up to {plan.seatLimit} account{plan.seatLimit === 1 ? "" : "s"}</div> : null}
      <DenButton
        className="mt-auto w-full"
        type="button"
        loading={busy}
        disabled={!canManage || !requestable || pending}
        variant={plan.recommended ? "primary" : "secondary"}
        onClick={() => onRequest(offer.id)}
      >
        {pending ? "Offline request submitted" : offer.purchaseMode === "contact_sales" ? "Contact sales for offline contract" : "Request offline activation"}
      </DenButton>
      {"paymentChannels" in offer && offer.paymentChannels.includes("offline_manual") ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
          {offer.purchaseMode === "contact_sales"
            ? "Offline contract payment · publish the agreed amount, seats, and RenCredit before activation."
            : "Offline payment · verified and activated by a platform super-admin."}
        </p>
      ) : null}
    </article>
  );
}

function GettingStartedCard() {
  return (
    <DenCard className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div key={pillar.label} className="grid gap-2 rounded-[16px] border border-gray-100 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">{pillar.label}</p>
            <p className="text-[13px] leading-5 text-gray-500">{pillar.body}</p>
          </div>
        ))}
      </div>
      <ol className="grid gap-3 border-t border-gray-100 px-1 pt-6">
        {STEPS.map((step, index) => (
          <li key={index} className="flex items-baseline gap-3">
            <span className="shrink-0 font-mono text-[12px] text-gray-400">{index + 1}.</span>
            <span className="text-[13.5px] leading-6 text-gray-700">{step}</span>
          </li>
        ))}
      </ol>
    </DenCard>
  );
}

function PlanCatalog({
  catalog,
  loading,
  error,
  audience,
  interval,
  request,
  requestBusyOfferId,
  canManage,
  onAudienceChange,
  onIntervalChange,
  onRequest,
  onRetry,
}: {
  catalog: RenworkPlanCatalog | null;
  loading: boolean;
  error: string | null;
  audience: RenworkPlanAudience;
  interval: BillingInterval;
  request: SubscriptionRequest | null;
  requestBusyOfferId: string | null;
  canManage: boolean;
  onAudienceChange: (audience: RenworkPlanAudience) => void;
  onIntervalChange: (interval: BillingInterval) => void;
  onRequest: (offerId: string) => void;
  onRetry: () => void;
}) {
  const plans = catalog?.plans
    .filter((plan) => plan.audience === audience)
    .map((plan) => ({ plan, offer: offerForInterval(plan, interval) }))
    .filter((entry): entry is { plan: RenworkPlan; offer: RenworkPlanOffer } => entry.offer !== null)
    ?? [];

  return (
    <section id="renwork-plans" className="grid scroll-mt-6 gap-4">
      <DenSectionHeader
        title="Choose a RenWork plan"
        description={catalog ? `Authoritative catalog ${catalog.catalogVersion}` : "Plans are loaded from the RenWork authority service."}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-gray-100 bg-white p-1" aria-label="Plan audience">
          {(["personal", "enterprise"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${audience === value ? "bg-gray-900 text-white" : "text-gray-500"}`}
              onClick={() => onAudienceChange(value)}
            >
              {value === "personal" ? "Personal" : "Enterprise"}
            </button>
          ))}
        </div>
        {audience === "personal" ? (
          <div className="flex rounded-xl border border-gray-100 bg-white p-1" aria-label="Billing interval">
            {(["monthly", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${interval === value ? "bg-gray-900 text-white" : "text-gray-500"}`}
                onClick={() => onIntervalChange(value)}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? <DenNotice tone="info" message="Loading the authoritative RenWork plan catalog…" /> : null}
      {error ? (
        <div className="grid gap-2">
          <DenNotice tone="error" message={error} />
          <DenButton type="button" variant="secondary" onClick={onRetry}>Retry plan catalog</DenButton>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className={`grid gap-3 ${audience === "personal" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {plans.map(({ plan, offer }) => (
            <PlanRequestCard
              key={plan.id}
              plan={plan}
              offer={offer}
              busy={requestBusyOfferId === offer.id}
              pending={request?.offerId === offer.id}
              canManage={canManage}
              onRequest={onRequest}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ModelsLineup({ subscribed }: { subscribed: boolean }) {
  return (
    <section className="grid gap-3.5">
      <DenSectionHeader
        title="Models"
        description={
          subscribed
            ? `Every member of your workspace can use all ${MODEL_LINEUP.length} models.`
            : `Every member of your workspace can use all ${MODEL_LINEUP.length} models, the moment you subscribe.`
        }
      />
      <div className="overflow-hidden rounded-[16px] border border-gray-100 bg-white">
        <DenTable headerTone="plain" columns={MODEL_COLUMNS} rows={MODEL_LINEUP} getRowKey={(model) => model.id} />
      </div>
    </section>
  );
}

export function InferenceScreen() {
  const router = useRouter();
  const plansRef = useRef<HTMLDivElement>(null);
  const { runtimeConfig, runtimeConfigLoaded } = useDenFlow();
  const { activeOrg, orgContext, refreshOrgData, runReauthableAction } = useOrgDashboard();
  const [status, setStatus] = useState<InferenceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<RenworkPlanCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [audience, setAudience] = useState<RenworkPlanAudience>("personal");
  const [interval, setInterval] = useState<BillingInterval>("annual");
  const [requestBusyOfferId, setRequestBusyOfferId] = useState<string | null>(null);
  const [subscriptionRequest, setSubscriptionRequest] = useState<SubscriptionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codexStatus, setCodexStatus] = useState<CodexCloudStatus | null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexPrompt, setCodexPrompt] = useState("");
  const [codexResult, setCodexResult] = useState<string | null>(null);
  const [codexError, setCodexError] = useState<string | null>(null);

  const access = getOrgAccessFlags(
    orgContext?.currentMember.role ?? "member",
    orgContext?.currentMember.isOwner ?? false,
    orgContext?.roles,
  );
  const canManageModels = access.isAdmin;
  // RenWork Models are a hosted RenWork Cloud offering; self-hosted
  // (single-org) deployments manage their own LLM providers instead.
  const isSelfHosted = runtimeConfigLoaded && runtimeConfig.orgMode === "single_org";
  const activeOrgSlug = activeOrg?.slug ?? null;
  const showWeijianCodex = orgContext?.organization.name === "weijian" && canManageModels;

  async function loadCodexStatus(poll = false) {
    try {
      const { response, payload } = await requestJson(
        poll ? "/v1/subscription-codex/connect" : "/v1/subscription-codex",
        { method: "GET" },
        12000,
      );
      const parsed = parseCodexCloudStatus(payload);
      if (parsed) setCodexStatus(parsed);
      else if (!response.ok) setCodexStatus({ state: "unavailable" });
    } catch {
      setCodexStatus({ state: "unavailable" });
    }
  }

  useEffect(() => {
    if (showWeijianCodex) void loadCodexStatus();
  }, [showWeijianCodex, orgContext?.organization.id]);

  useEffect(() => {
    if (codexStatus?.state !== "pending") return;
    const timer = window.setInterval(() => void loadCodexStatus(true), 3000);
    return () => window.clearInterval(timer);
  }, [codexStatus?.state]);

  async function connectCodex() {
    setCodexError(null);
    try {
      await runReauthableAction("weijian-codex-connect", async () => {
        setCodexBusy(true);
        const { response, payload } = await requestJson("/v1/subscription-codex/connect", { method: "POST" }, 30000);
        if (!response.ok) throw getRequestError(payload, response, "无法开始 ChatGPT 授权。");
        const status = parseCodexCloudStatus(payload);
        if (!status) throw new Error("授权响应无效。");
        setCodexStatus(status);
      });
    } catch (cause) {
      setCodexError(cause instanceof Error ? cause.message : "无法开始 ChatGPT 授权。");
    } finally {
      setCodexBusy(false);
    }
  }

  async function disconnectCodex() {
    setCodexError(null);
    try {
      await runReauthableAction("weijian-codex-disconnect", async () => {
        setCodexBusy(true);
        const { response, payload } = await requestJson("/v1/subscription-codex/connect", { method: "DELETE" }, 20000);
        if (!response.ok) throw getRequestError(payload, response, "无法断开 ChatGPT。");
        setCodexStatus({ state: "disconnected" });
        setCodexResult(null);
      });
    } catch (cause) {
      setCodexError(cause instanceof Error ? cause.message : "无法断开 ChatGPT。");
    } finally {
      setCodexBusy(false);
    }
  }

  async function runCodexTask() {
    if (!codexStatus?.modelSku) {
      setCodexError("weijian 尚未获授 GPT-5.6 模型权限。");
      return;
    }
    setCodexError(null);
    setCodexResult(null);
    setCodexBusy(true);
    try {
      const { response, payload } = await requestJson("/v1/subscription-codex/tasks", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ prompt: codexPrompt, modelSku: codexStatus.modelSku }),
      }, 11 * 60_000);
      if (!response.ok) throw getRequestError(payload, response, "GPT-5.6 云端任务失败。");
      if (!payload || typeof payload !== "object" || !("text" in payload) || typeof payload.text !== "string") {
        throw new Error("任务结果无效。");
      }
      setCodexResult(payload.text);
    } catch (cause) {
      setCodexError(cause instanceof Error ? cause.message : "GPT-5.6 云端任务失败。");
    } finally {
      setCodexBusy(false);
    }
  }

  useEffect(() => {
    if (!isSelfHosted) return;
    router.replace(getCustomLlmProvidersRoute(activeOrgSlug));
  }, [isSelfHosted, activeOrgSlug, router]);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const { response, payload } = await requestJson("/v1/inference", { method: "GET" }, 12000);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Failed to load inference settings (${response.status}).`));
      }
      const parsed = parseInferencePayload(payload);
      if (!parsed) {
        throw new Error("Inference settings response was incomplete.");
      }
      setStatus(parsed);
      setSubscriptionRequest(parsed.subscriptionRequest);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load inference settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [orgContext?.organization.id]);

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const { response, payload } = await requestJson("/v1/renwork/commerce/catalog", { method: "GET" }, 12000);
      if (!response.ok) throw new Error(getErrorMessage(payload, `Failed to load plans (${response.status}).`));
      const parsed = renworkPlanCatalogSchema.safeParse(payload);
      if (!parsed.success) throw new Error("The RenWork plan catalog response was invalid.");
      setCatalog(parsed.data);
    } catch (loadError) {
      setCatalog(null);
      setCatalogError(loadError instanceof Error ? loadError.message : "Failed to load the authoritative RenWork plan catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  async function requestSubscriptionAccess(offerId: string) {
    if (!canManageModels) {
      setError("Only workspace owners and admins can request a RenWork plan.");
      return;
    }

    setError(null);
    try {
      await runReauthableAction("renwork-plan-request", async () => {
        setRequestBusyOfferId(offerId);
        const { response, payload } = await requestJson(
          "/v1/renwork/commerce/access-requests",
          { method: "POST", body: JSON.stringify({ offerId }) },
          12000,
        );
        if (!response.ok) {
          throw getRequestError(payload, response, `Plan request failed (${response.status}).`);
        }
        const request = payload && typeof payload === "object" && "request" in payload ? payload.request : null;
        const parsedRequest = request && typeof request === "object" && "status" in request && request.status === "pending"
          ? request as SubscriptionRequest
          : null;
        if (!parsedRequest) throw new Error("The plan request response was incomplete.");
        setSubscriptionRequest(parsedRequest);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit the plan request.");
    } finally {
      setRequestBusyOfferId(null);
    }
  }

  async function toggleEnabled() {
    if (!canManageModels) {
      setError("Only workspace admins can manage RenWork Models.");
      return;
    }
    if (!status) return;
    if (status.enabled || !status.subscribed) {
      router.push(getBillingRoute(activeOrg?.slug));
      return;
    }
    setError(null);
    try {
      await runReauthableAction("update-inference", async () => {
        setSaving(true);
        try {
          const { response, payload } = await requestJson(
            "/v1/inference",
            {
              method: "PATCH",
              body: JSON.stringify({ enabled: !status.enabled, tier: status.tier }),
            },
            20000,
          );
          if (!response.ok) {
            throw getRequestError(payload, response, `Failed to update inference settings (${response.status}).`);
          }
          const parsed = parseInferencePayload(payload);
          if (!parsed) {
            throw new Error("Inference settings response was incomplete.");
          }
          setStatus(parsed);
          await refreshOrgData();
        } finally {
          setSaving(false);
        }
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update inference settings.");
    }
  }

  if (isSelfHosted) {
    return null;
  }

  const enabled = status?.enabled === true;
  const subscribed = status?.subscribed === true;
  const showGettingStarted = !loading && status !== null && !subscribed;
  const actionLabel = subscribed ? (enabled ? "Manage subscription" : "Enable") : "View plans";

  return (
    <div className="mx-auto grid max-w-[860px] gap-6 px-8 pb-16 pt-8">
      <DenPageHeader
        title="RenWork Models"
        description="Reliable, hand-picked models for knowledge work. No API keys to manage."
        action={
          <DenButton
            type="button"
            onClick={subscribed ? toggleEnabled : () => plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            loading={loading || saving}
            disabled={!canManageModels}
            variant={enabled ? "secondary" : "primary"}
          >
            {actionLabel}
          </DenButton>
        }
        caption={subscribed ? "Active subscription · RenCredit metering enabled" : "No free plan · no local model or personal API-key fallback"}
      />

      {error ? <DenNotice message={error} tone="error" /> : null}

      {showWeijianCodex ? (
        <DenCard className="grid gap-4">
          <DenSectionHeader
            title="ChatGPT Pro 云端授权"
            description="仅限 weijian 当前获授权成员。登录在 OpenAI 页面完成，任务使用 GPT-5.6 Sol，并记入组织 RenCredit。"
          />
          <div className="text-[13px] text-gray-700">
            状态：{codexStatus?.state === "connected" ? `已连接 · ${codexStatus.model ?? "GPT-5.6 Sol"}`
              : codexStatus?.state === "pending" ? "等待你在 OpenAI 页面完成授权"
              : codexStatus?.state === "unavailable" ? "云端运行器暂不可用"
              : codexStatus?.state === "error" ? "授权失败"
              : "未连接"}
            {codexStatus?.email ? ` · ${codexStatus.email}` : ""}
          </div>
          {codexStatus?.state === "pending" && codexStatus.userCode ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px]">
              <p>在 OpenAI 页面输入此一次性代码：</p>
              <p className="my-2 font-mono text-xl font-semibold tracking-wider">{codexStatus.userCode}</p>
              <a href="https://auth.openai.com/codex/device" target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">
                打开 OpenAI 授权页面
              </a>
            </div>
          ) : null}
          {codexStatus?.message ? <DenNotice tone="error" message={codexStatus.message} /> : null}
          {codexError ? <DenNotice tone="error" message={codexError} /> : null}
          <div className="flex flex-wrap gap-2">
            {codexStatus?.state !== "connected" ? (
              <DenButton type="button" loading={codexBusy} onClick={() => void connectCodex()}>
                {codexStatus?.state === "pending" ? "重新发起授权" : "连接 ChatGPT Pro"}
              </DenButton>
            ) : (
              <DenButton type="button" variant="secondary" loading={codexBusy} onClick={() => void disconnectCodex()}>
                断开连接
              </DenButton>
            )}
            <DenButton type="button" variant="secondary" onClick={() => void loadCodexStatus()}>
              检查状态
            </DenButton>
          </div>
          {codexStatus?.state === "connected" ? (
            <div className="grid gap-2 border-t border-gray-100 pt-4">
              <label htmlFor="weijian-codex-prompt" className="text-[13px] font-medium text-gray-900">试运行 GPT-5.6 Sol</label>
              <textarea
                id="weijian-codex-prompt"
                value={codexPrompt}
                onChange={(event) => setCodexPrompt(event.target.value)}
                rows={4}
                maxLength={50000}
                className="w-full rounded-xl border border-gray-200 p-3 text-[13px]"
                placeholder="输入要交给云端 GPT-5.6 完成的任务"
              />
              <DenButton type="button" loading={codexBusy} disabled={!codexPrompt.trim()} onClick={() => void runCodexTask()}>
                运行并计入 RenCredit
              </DenButton>
              {codexResult ? <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-[13px] text-gray-800">{codexResult}</pre> : null}
            </div>
          ) : null}
        </DenCard>
      ) : null}

      {canManageModels ? null : (
        <DenNotice
          tone="info"
          message="Only workspace admins can subscribe or enable RenWork Models. Ask an owner, super-admin, or admin for this workspace."
        />
      )}

      {showGettingStarted ? <GettingStartedCard /> : null}

      {subscriptionRequest ? (
        <DenNotice
          tone="info"
          message={`Offline activation request ${subscriptionRequest.offerId} was submitted on ${new Date(subscriptionRequest.requestedAt).toLocaleString()}. Complete the offline payment or contract; a platform super-admin will verify receipt before models are enabled.`}
        />
      ) : null}

      {!subscribed ? (
        <div ref={plansRef}>
          <PlanCatalog
            catalog={catalog}
            loading={catalogLoading}
            error={catalogError}
            audience={audience}
            interval={interval}
            request={subscriptionRequest}
            requestBusyOfferId={requestBusyOfferId}
            canManage={canManageModels}
            onAudienceChange={(value) => {
              setAudience(value);
              if (value === "enterprise") setInterval("annual");
            }}
            onIntervalChange={setInterval}
            onRequest={(offerId) => void requestSubscriptionAccess(offerId)}
            onRetry={() => void loadCatalog()}
          />
        </div>
      ) : null}

      <ModelsLineup subscribed={subscribed} />

      {enabled && status ? <UsageLimitsCard buckets={status.buckets} /> : null}
    </div>
  );
}
