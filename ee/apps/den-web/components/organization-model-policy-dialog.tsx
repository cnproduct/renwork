"use client";

import { Coins, RefreshCw, Save, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MICROCREDITS_PER_RENCREDIT = 1_000_000;

type OrganizationSummary = {
  id: string;
  name: string;
};

type CatalogModel = {
  sku: string;
  displayName: string;
  description: string;
  effectiveDisplayMultiplierBps: number;
};

type OrganizationMember = {
  id: string;
  role: string;
  userId: string | null;
  name: string | null;
  email: string | null;
};

type ModelPolicy = {
  allowedModelSkus: string[] | null;
  defaultModelSku: string | null;
  dailyBudgetMicroCredits: number | null;
  monthlyBudgetMicroCredits: number | null;
  memberMonthlyBudgetMicroCredits: Record<string, number | null>;
};

type ModelPolicyPayload = {
  organization: OrganizationSummary;
  policy: ModelPolicy;
  availableModels: CatalogModel[];
  catalogAvailable: boolean;
  members: OrganizationMember[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function parsePolicy(value: unknown): ModelPolicy | null {
  if (!isRecord(value)) return null;
  const allowedModelSkus = value.allowedModelSkus === null
    ? null
    : Array.isArray(value.allowedModelSkus)
      ? value.allowedModelSkus.filter((sku): sku is string => typeof sku === "string")
      : undefined;
  const dailyBudgetMicroCredits = parseNullableNumber(value.dailyBudgetMicroCredits);
  const monthlyBudgetMicroCredits = parseNullableNumber(value.monthlyBudgetMicroCredits);
  if (allowedModelSkus === undefined || dailyBudgetMicroCredits === undefined || monthlyBudgetMicroCredits === undefined) return null;
  if (!(value.defaultModelSku === null || typeof value.defaultModelSku === "string")) return null;
  if (!isRecord(value.memberMonthlyBudgetMicroCredits)) return null;
  const memberMonthlyBudgetMicroCredits: Record<string, number | null> = {};
  for (const [memberId, amount] of Object.entries(value.memberMonthlyBudgetMicroCredits)) {
    const parsed = parseNullableNumber(amount);
    if (parsed === undefined) return null;
    memberMonthlyBudgetMicroCredits[memberId] = parsed;
  }
  return {
    allowedModelSkus,
    defaultModelSku: value.defaultModelSku,
    dailyBudgetMicroCredits,
    monthlyBudgetMicroCredits,
    memberMonthlyBudgetMicroCredits,
  };
}

function parsePayload(value: unknown): ModelPolicyPayload | null {
  if (!isRecord(value) || !isRecord(value.organization) || !Array.isArray(value.availableModels) || !Array.isArray(value.members)) return null;
  if (typeof value.organization.id !== "string" || typeof value.organization.name !== "string") return null;
  const policy = parsePolicy(value.policy);
  if (!policy) return null;
  const availableModels: CatalogModel[] = [];
  for (const model of value.availableModels) {
    if (!isRecord(model) || typeof model.sku !== "string" || typeof model.displayName !== "string") continue;
    availableModels.push({
      sku: model.sku,
      displayName: model.displayName,
      description: typeof model.description === "string" ? model.description : "",
      effectiveDisplayMultiplierBps: typeof model.effectiveDisplayMultiplierBps === "number" ? model.effectiveDisplayMultiplierBps : 10_000,
    });
  }
  const members: OrganizationMember[] = [];
  for (const member of value.members) {
    if (!isRecord(member) || typeof member.id !== "string" || typeof member.role !== "string") continue;
    members.push({
      id: member.id,
      role: member.role,
      userId: typeof member.userId === "string" ? member.userId : null,
      name: typeof member.name === "string" ? member.name : null,
      email: typeof member.email === "string" ? member.email : null,
    });
  }
  return {
    organization: { id: value.organization.id, name: value.organization.name },
    policy,
    availableModels,
    catalogAvailable: value.catalogAvailable === true,
    members,
  };
}

function errorMessage(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.message === "string" && value.message.trim()) return value.message;
  return fallback;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/den${path}`, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
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

function toRenCredit(value: number | null) {
  return value === null ? "" : String(value / MICROCREDITS_PER_RENCREDIT);
}

function toMicroCredits(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("额度必须是零或正数。");
  return Math.round(amount * MICROCREDITS_PER_RENCREDIT);
}

export function OrganizationModelPolicyDialog({ organization, onClose }: {
  organization: OrganizationSummary | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<ModelPolicyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (!organization) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await request(`/v1/admin/organizations/${encodeURIComponent(organization.id)}/model-policy`);
      if (!result.response.ok) throw new Error(errorMessage(result.payload, "无法读取组织模型策略。"));
      const parsed = parsePayload(result.payload);
      if (!parsed) throw new Error("组织模型策略响应不完整。");
      setPayload(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取组织模型策略。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPayload(null);
    if (organization) void load();
  }, [organization?.id]);

  const models = payload?.availableModels ?? [];
  const policy = payload?.policy ?? null;
  const allowedSkus = useMemo(
    () => new Set(policy?.allowedModelSkus ?? models.map((model) => model.sku)),
    [models, policy?.allowedModelSkus],
  );

  if (!organization) return null;

  const updatePolicy = (next: Partial<ModelPolicy>) => {
    setPayload((current) => current ? { ...current, policy: { ...current.policy, ...next } } : current);
    setNotice(null);
  };

  const save = async () => {
    if (!payload) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await request(`/v1/admin/organizations/${encodeURIComponent(organization.id)}/model-policy`, {
        method: "PUT",
        body: JSON.stringify(payload.policy),
      });
      if (!result.response.ok) throw new Error(errorMessage(result.payload, "无法保存组织模型策略。"));
      setNotice("模型白名单、默认模型、组织预算和成员额度已保存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法保存组织模型策略。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="organization-model-policy-title" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-orange-100 bg-[#fffaf5] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-orange-100 bg-[#fffaf5]/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-orange-600">RenWork 平台超级管理员</p>
            <h2 id="organization-model-policy-title" className="mt-1 text-2xl font-semibold text-slate-950">{organization.name} · 模型与额度策略</h2>
            <p className="mt-1 text-sm text-slate-600">统一管理该组织可选模型、默认模型、预算与成员额度。供应商密钥仍只在全局模型目录管理。</p>
          </div>
          <button type="button" aria-label="关闭模型策略" onClick={onClose} className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-950"><X className="size-5" /></button>
        </div>

        <div className="space-y-5 p-6">
          {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
          {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
          {loading || !payload || !policy ? (
            <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white p-6 text-sm text-slate-600"><RefreshCw className="size-5 animate-spin text-orange-600" />正在读取组织策略…</div>
          ) : (
            <>
              <section className="rounded-3xl border border-orange-100 bg-white p-5" data-testid="admin-organization-model-policy">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-orange-600" /><div><h3 className="font-semibold text-slate-950">模型白名单与默认模型</h3><p className="text-sm text-slate-500">组织成员只能从这里允许的平台模型中选择。</p></div></div>
                  <button type="button" disabled={!payload.catalogAvailable} onClick={() => updatePolicy({ allowedModelSkus: null })} className="rounded-full border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 disabled:opacity-50">允许全部已发布模型</button>
                </div>
                {!payload.catalogAvailable ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">全局模型目录暂不可用。现有模型策略将被保留，你仍可修改预算与成员额度。</p> : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {models.map((model) => (
                    <label key={model.sku} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                      <input type="checkbox" className="mt-1 size-4 accent-orange-600" checked={allowedSkus.has(model.sku)} onChange={(event) => {
                        const next = new Set(allowedSkus);
                        if (event.target.checked) next.add(model.sku); else next.delete(model.sku);
                        const list = [...next];
                        updatePolicy({ allowedModelSkus: list, defaultModelSku: policy.defaultModelSku && list.includes(policy.defaultModelSku) ? policy.defaultModelSku : list[0] ?? null });
                      }} />
                      <span className="min-w-0 flex-1"><span className="block font-medium text-slate-950">{model.displayName}</span><span className="block text-xs leading-5 text-slate-500">{model.description}</span></span>
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-700">×{(model.effectiveDisplayMultiplierBps / 10_000).toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-800">默认模型
                  <select value={policy.defaultModelSku ?? ""} disabled={!payload.catalogAvailable} onChange={(event) => updatePolicy({ defaultModelSku: event.target.value || null })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 disabled:bg-slate-50">
                    <option value="">未指定</option>
                    {models.filter((model) => allowedSkus.has(model.sku)).map((model) => <option key={model.sku} value={model.sku}>{model.displayName}</option>)}
                  </select>
                </label>
              </section>

              <section className="rounded-3xl border border-orange-100 bg-white p-5">
                <div className="flex items-start gap-3"><Coins className="mt-0.5 size-5 text-orange-600" /><div><h3 className="font-semibold text-slate-950">组织 RenCredit 预算</h3><p className="text-sm text-slate-500">留空表示不设置上限；零表示阻止新的计量任务。</p></div></div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <BudgetInput label="每日 RenCredit 上限" value={policy.dailyBudgetMicroCredits} onChange={(value) => updatePolicy({ dailyBudgetMicroCredits: value })} onError={setError} />
                  <BudgetInput label="每月 RenCredit 上限" value={policy.monthlyBudgetMicroCredits} onChange={(value) => updatePolicy({ monthlyBudgetMicroCredits: value })} onError={setError} />
                </div>
              </section>

              <section className="rounded-3xl border border-orange-100 bg-white p-5">
                <div className="flex items-start gap-3"><Users className="mt-0.5 size-5 text-orange-600" /><div><h3 className="font-semibold text-slate-950">成员月额度</h3><p className="text-sm text-slate-500">成员额度和组织钱包预留在同一事务中执行。</p></div></div>
                <div className="mt-4 space-y-3">
                  {payload.members.map((member) => (
                    <div key={member.id} className="grid items-center gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_220px]">
                      <div><p className="font-medium text-slate-950">{member.name || member.email || member.id}</p><p className="text-sm text-slate-500">{member.email || "尚未绑定用户"} · {member.role}</p></div>
                      <BudgetInput label="每月 RenCredit" value={policy.memberMonthlyBudgetMicroCredits[member.id] ?? null} onChange={(value) => updatePolicy({ memberMonthlyBudgetMicroCredits: { ...policy.memberMonthlyBudgetMicroCredits, [member.id]: value } })} onError={setError} />
                    </div>
                  ))}
                  {payload.members.length === 0 ? <p className="text-sm text-slate-500">该组织目前没有有效成员。</p> : null}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-orange-100 bg-[#fffaf5]/95 px-6 py-4 backdrop-blur">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">关闭</button>
          <button type="button" onClick={() => void save()} disabled={!payload || loading || saving} className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="size-4" />{saving ? "保存中…" : "保存组织策略"}</button>
        </div>
      </div>
    </div>
  );
}

function BudgetInput({ label, value, onChange, onError }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  onError: (message: string | null) => void;
}) {
  return <label className="text-sm font-medium text-slate-800">{label}<input className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5" inputMode="decimal" placeholder="不设上限" value={toRenCredit(value)} onChange={(event) => { try { onChange(toMicroCredits(event.target.value)); onError(null); } catch (cause) { onError(cause instanceof Error ? cause.message : "额度无效。"); } }} /></label>;
}
