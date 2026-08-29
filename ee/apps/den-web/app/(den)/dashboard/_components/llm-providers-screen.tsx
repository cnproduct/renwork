"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Save, ShieldCheck, Sparkles, Users } from "lucide-react";
import { DashboardPageTemplate } from "../../_components/ui/dashboard-page-template";
import { DenButton } from "../../_components/ui/button";
import { DenCard } from "../../_components/ui/card";
import { DenNotice } from "../../_components/ui/notice";
import { getErrorMessage, requestJson } from "../../_lib/den-flow";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";

const MICROCREDITS_PER_RENCREDIT = 1_000_000;

type CatalogModel = {
  sku: string;
  displayName: string;
  description: string;
  tier: string;
  effectiveDisplayMultiplierBps: number;
};

type ModelPolicy = {
  allowedModelSkus: string[] | null;
  defaultModelSku: string | null;
  dailyBudgetMicroCredits: number | null;
  monthlyBudgetMicroCredits: number | null;
  memberMonthlyBudgetMicroCredits: Record<string, number | null>;
};

function toRenCredit(value: number | null) {
  return value === null ? "" : String(value / MICROCREDITS_PER_RENCREDIT);
}

function toMicroCredits(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("RenCredit limits must be zero or a positive number.");
  return Math.round(amount * MICROCREDITS_PER_RENCREDIT);
}

/** The legacy BYOK route now hosts Owner-only policy. Provider control moved to platform administration. */
export function LlmProvidersScreen() {
  const { orgContext, runReauthableAction } = useOrgDashboard();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [policy, setPolicy] = useState<ModelPolicy | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const policyResult = await requestJson("/v1/model-policy", { method: "GET" }, 12_000);
        if (!policyResult.response.ok) throw new Error(getErrorMessage(policyResult.payload, "Only the organization owner can manage model policy."));
        const policyPayload = policyResult.payload as { policy?: ModelPolicy; availableModels?: CatalogModel[] };
        if (!policyPayload.policy) throw new Error("The organization model policy response was incomplete.");
        if (!cancelled) {
          setModels(Array.isArray(policyPayload.availableModels) ? policyPayload.availableModels : []);
          setPolicy(policyPayload.policy);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load model policy.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const allowedSkus = useMemo(
    () => new Set(policy?.allowedModelSkus ?? models.map((model) => model.sku)),
    [models, policy?.allowedModelSkus],
  );

  const updatePolicy = (next: Partial<ModelPolicy>) => {
    setPolicy((current) => current ? { ...current, ...next } : current);
    setSaved(null);
  };

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      await runReauthableAction("save-model-policy", async () => {
        const { response, payload } = await requestJson("/v1/model-policy", { method: "PUT", body: JSON.stringify(policy) }, 12_000);
        if (!response.ok) throw new Error(getErrorMessage(payload, "Could not save model policy."));
      });
      setSaved("Model access, default model, budgets, and member quotas were saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save model policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardPageTemplate
      title="Model policy"
      description="Organization Owners choose published models and RenCredit limits. Provider routes, keys, tests, and deletion are platform super-admin only."
      icon={ShieldCheck}
      colors={["#FFF7ED", "#C2410C", "#FB923C", "#FFEDD5"]}
    >
      <div className="mb-5 flex justify-end"><DenButton onClick={() => void save()} disabled={busy || saving || !policy}><Save className="size-4" />{saving ? "Saving…" : "Save policy"}</DenButton></div>
      {error ? <DenNotice tone="error" message={error} /> : null}
      {saved ? <DenNotice tone="info" message={saved} /> : null}
      {busy || !policy ? <DenCard className="p-6 text-sm text-gray-500">Loading organization model policy…</DenCard> : (
        <div className="space-y-6">
          <DenCard className="p-6">
            <div className="mb-5 flex items-start gap-3"><Sparkles className="mt-0.5 size-5 text-orange-600" /><div><h2 className="font-semibold text-gray-950">Model allowlist and default</h2><p className="text-sm text-gray-500">Members can select only these platform-published models.</p></div></div>
            <div className="space-y-3">
              {models.map((model) => (
                <label key={model.sku} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-4">
                  <input type="checkbox" className="mt-1 size-4 accent-orange-600" checked={allowedSkus.has(model.sku)} onChange={(event) => {
                    const next = new Set(allowedSkus);
                    event.target.checked ? next.add(model.sku) : next.delete(model.sku);
                    const list = [...next];
                    updatePolicy({ allowedModelSkus: list, defaultModelSku: policy.defaultModelSku && list.includes(policy.defaultModelSku) ? policy.defaultModelSku : list[0] ?? null });
                  }} />
                  <span className="min-w-0 flex-1"><span className="block font-medium text-gray-950">{model.displayName}</span><span className="block text-sm text-gray-500">{model.description}</span></span>
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-700">×{(model.effectiveDisplayMultiplierBps / 10_000).toFixed(2)}</span>
                </label>
              ))}
            </div>
            <label className="mt-5 block text-sm font-medium text-gray-800">Default model
              <select className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5" value={policy.defaultModelSku ?? ""} onChange={(event) => updatePolicy({ defaultModelSku: event.target.value || null })}>
                <option value="">Select a default</option>
                {models.filter((model) => allowedSkus.has(model.sku)).map((model) => <option key={model.sku} value={model.sku}>{model.displayName}</option>)}
              </select>
            </label>
          </DenCard>

          <DenCard className="p-6">
            <div className="mb-5 flex items-start gap-3"><Coins className="mt-0.5 size-5 text-orange-600" /><div><h2 className="font-semibold text-gray-950">Organization RenCredit budgets</h2><p className="text-sm text-gray-500">Leave blank for unlimited. Zero blocks new metered tasks.</p></div></div>
            <div className="grid gap-4 md:grid-cols-2">
              <BudgetInput label="Daily RenCredit limit" value={policy.dailyBudgetMicroCredits} onChange={(value) => updatePolicy({ dailyBudgetMicroCredits: value })} onError={setError} />
              <BudgetInput label="Monthly RenCredit limit" value={policy.monthlyBudgetMicroCredits} onChange={(value) => updatePolicy({ monthlyBudgetMicroCredits: value })} onError={setError} />
            </div>
          </DenCard>

          <DenCard className="p-6">
            <div className="mb-5 flex items-start gap-3"><Users className="mt-0.5 size-5 text-orange-600" /><div><h2 className="font-semibold text-gray-950">Member monthly quotas</h2><p className="text-sm text-gray-500">Each quota is enforced atomically with wallet reservation.</p></div></div>
            <div className="space-y-3">
              {orgContext?.members.map((member) => (
                <div key={member.id} className="grid items-center gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-[1fr_220px]">
                  <div><p className="font-medium text-gray-950">{member.user.name || member.user.email}</p><p className="text-sm text-gray-500">{member.user.email}{member.isOwner ? " · Owner" : ""}</p></div>
                  <BudgetInput label="Monthly RenCredit" value={policy.memberMonthlyBudgetMicroCredits[member.id] ?? null} onChange={(value) => updatePolicy({ memberMonthlyBudgetMicroCredits: { ...policy.memberMonthlyBudgetMicroCredits, [member.id]: value } })} onError={setError} />
                </div>
              ))}
            </div>
          </DenCard>
        </div>
      )}
    </DashboardPageTemplate>
  );
}

function BudgetInput({ label, value, onChange, onError }: { label: string; value: number | null; onChange: (value: number | null) => void; onError: (message: string | null) => void }) {
  return <label className="text-sm font-medium text-gray-800">{label}<input className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5" inputMode="decimal" placeholder="Unlimited" value={toRenCredit(value)} onChange={(event) => { try { onChange(toMicroCredits(event.target.value)); onError(null); } catch (cause) { onError((cause as Error).message); } }} /></label>;
}
