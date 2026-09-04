/** @jsxImportSource react */
import * as React from "react";
import type {
  RenworkPlan,
  RenworkPlanAudience,
  RenworkPlanFeatures,
  RenworkPlanOffer,
} from "@openwork/types/renwork-commerce";
import { formatRenCredit, type RenWorkPublicModelCatalog } from "@openwork/rencredit-metering";
import { Check, Coins, History, LockKeyhole, ReceiptText, RefreshCcw, ShieldCheck, Users } from "lucide-react";

import { isDenOrgAdminRole, type DenRenCreditLedgerEntry, type DenRenCreditTaskReceipt } from "@/app/lib/den";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { usePlatform } from "@/react-app/kernel/platform";
import { useCloudSession } from "../cloud/cloud-session-provider";
import {
  SettingsInset,
  SettingsNotice,
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionHeaderContent,
  SettingsSectionHeaderDescription,
  SettingsSectionHeaderTitle,
  SettingsStack,
} from "../settings-section";

type BillingInterval = "monthly" | "annual";

const FEATURE_LABELS: Array<{ key: keyof RenworkPlanFeatures; labelKey: string }> = [
  { key: "managedCloud", labelKey: "commerce.feature_managed_cloud" },
  { key: "officialPlugins", labelKey: "commerce.feature_official_plugins" },
  { key: "buyerGrowth", labelKey: "commerce.feature_buyer_growth" },
  { key: "sharedWorkspace", labelKey: "commerce.feature_shared_workspace" },
  { key: "sharedRenCreditPool", labelKey: "commerce.feature_shared_credit_pool" },
  { key: "roleManagement", labelKey: "commerce.feature_role_management" },
  { key: "adminAudit", labelKey: "commerce.feature_admin_audit" },
  { key: "privateDeployment", labelKey: "commerce.feature_private_deployment" },
];

function offerForInterval(plan: RenworkPlan, interval: BillingInterval): RenworkPlanOffer | null {
  return plan.offers.find((offer) => offer.billingInterval === interval)
    ?? plan.offers.find((offer) => offer.billingInterval === null)
    ?? null;
}

function offerPrice(offer: RenworkPlanOffer): string {
  if (offer.purchaseMode === "free") return t("commerce.price_free");
  if (offer.purchaseMode === "request_trial") return t("commerce.price_pilot");
  if (offer.purchaseMode === "contact_sales") return t("commerce.price_contact");
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: 0,
  }).format(offer.priceMinor / 100);
}

function formatCurrencyMinor(value: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function offerCta(offer: RenworkPlanOffer): string {
  if (offer.cta === "current") return t("commerce.cta_current");
  if (offer.cta === "request_trial") return t("commerce.cta_request_trial");
  if (offer.cta === "request_access") return t("commerce.cta_request_access");
  if (offer.cta === "contact_sales") return t("commerce.cta_contact_sales");
  return t("commerce.cta_checkout");
}

function offlinePaymentLabel(offer: RenworkPlanOffer): string | null {
  if (!("paymentChannels" in offer) || !offer.paymentChannels.includes("offline_manual")) return null;
  return offer.purchaseMode === "contact_sales"
    ? t("commerce.offline_payment_custom")
    : t("commerce.offline_payment_channel");
}

function formatRenCreditBalance(microCredits: number): string {
  const sign = microCredits < 0 ? "−" : "";
  return `${sign}${formatRenCredit(Math.abs(microCredits))}`;
}

function formatRenCreditDelta(microCredits: number): string {
  if (microCredits === 0) return "0";
  return `${microCredits > 0 ? "+" : "−"}${formatRenCredit(Math.abs(microCredits))}`;
}

function formatReceiptDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function receiptStatus(receipt: DenRenCreditTaskReceipt) {
  if (receipt.status === "reserved") return { label: t("commerce.receipt_status_reserved"), className: "border-amber-7/40 bg-amber-3 text-amber-11" };
  if (receipt.status === "captured") return { label: t("commerce.receipt_status_captured"), className: "border-emerald-7/40 bg-emerald-3 text-emerald-11" };
  return { label: t("commerce.receipt_status_released"), className: "border-dls-border bg-dls-hover text-dls-secondary" };
}

function receiptAmount(receipt: DenRenCreditTaskReceipt) {
  if (receipt.status === "reserved") return receipt.reservedMicroCredits;
  return receipt.capturedMicroCredits;
}

function receiptTokenTotal(receipt: DenRenCreditTaskReceipt) {
  const usage = receipt.actualUsage;
  if (!usage) return null;
  return usage.inputTokens + usage.outputTokens + usage.reasoningTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

function receiptContextTokenTotal(receipt: DenRenCreditTaskReceipt) {
  const usage = receipt.actualUsage;
  if (!usage) return null;
  return usage.inputTokens + usage.outputTokens + usage.reasoningTokens;
}

function TaskReceiptRow({ receipt, contextWindow }: { receipt: DenRenCreditTaskReceipt; contextWindow: number | null }) {
  const status = receiptStatus(receipt);
  const tokenTotal = receiptTokenTotal(receipt);
  const contextTokens = receiptContextTokenTotal(receipt);
  const contextPercent = contextTokens !== null && contextWindow
    ? Math.min(100, Math.round((contextTokens / contextWindow) * 1000) / 10)
    : null;
  const usage = receipt.actualUsage;
  return (
    <div className="border-b border-dls-border py-4 last:border-b-0" data-testid="rencredit-task-receipt">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-dls-text">{receipt.modelSku}</span>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
            {receipt.billingMode === "free" ? <Badge variant="secondary">{t("commerce.receipt_free")}</Badge> : null}
          </div>
          <div className="mt-1 break-all text-xs text-dls-secondary">
            {formatReceiptDate(receipt.createdAt)} · {t("commerce.receipt_task_id", { id: receipt.runId })}
          </div>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <div className="text-sm font-semibold tabular-nums text-dls-text">
            {receipt.status === "released" ? formatRenCreditBalance(0) : formatRenCreditBalance(receiptAmount(receipt))}
          </div>
          <div className="mt-1 text-xs text-dls-secondary">
            {receipt.status === "reserved"
              ? t("commerce.receipt_frozen")
              : receipt.status === "released"
                ? t("commerce.receipt_no_charge")
                : t("commerce.receipt_charged")}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-dls-border bg-dls-sidebar/60 p-3" data-testid="rencredit-context-capacity">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-dls-text">{t("commerce.context_capacity_title")}</span>
            <span className="tabular-nums text-dls-secondary">
              {contextTokens === null
                ? "—"
                : contextWindow
                  ? t("commerce.context_capacity_value", {
                      used: new Intl.NumberFormat().format(contextTokens),
                      limit: new Intl.NumberFormat().format(contextWindow),
                      percent: contextPercent ?? 0,
                    })
                  : t("commerce.context_capacity_unknown", { used: new Intl.NumberFormat().format(contextTokens) })}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-dls-border"
            role="progressbar"
            aria-label={t("commerce.context_capacity_title")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={contextPercent ?? 0}
          >
            <div className="h-full rounded-full bg-blue-9 transition-[width]" style={{ width: `${contextPercent ?? 0}%` }} />
          </div>
          <div className="mt-2 text-[11px] leading-4 text-dls-secondary">{t("commerce.context_capacity_note")}</div>
        </div>

        <div className="rounded-xl border border-dls-border bg-dls-sidebar/60 p-3" data-testid="rencredit-settlement">
          <div className="text-xs font-medium text-dls-text">{t("commerce.settlement_title")}</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-dls-secondary">{t("commerce.settlement_reserved")}</div><div className="mt-1 tabular-nums text-dls-text">{formatRenCreditBalance(receipt.reservedMicroCredits)}</div></div>
            <div><div className="text-dls-secondary">{t("commerce.settlement_captured")}</div><div className="mt-1 tabular-nums text-dls-text">{formatRenCreditBalance(receipt.capturedMicroCredits)}</div></div>
            <div><div className="text-dls-secondary">{t("commerce.settlement_released")}</div><div className="mt-1 tabular-nums text-dls-text">{formatRenCreditBalance(receipt.releasedMicroCredits)}</div></div>
          </div>
        </div>
      </div>

      {usage ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-dls-secondary sm:grid-cols-5" data-testid="rencredit-token-breakdown">
          <span>{t("commerce.token_input", { value: new Intl.NumberFormat().format(usage.inputTokens) })}</span>
          <span>{t("commerce.token_output", { value: new Intl.NumberFormat().format(usage.outputTokens) })}</span>
          <span>{t("commerce.token_reasoning", { value: new Intl.NumberFormat().format(usage.reasoningTokens) })}</span>
          <span>{t("commerce.token_cache_read", { value: new Intl.NumberFormat().format(usage.cacheReadTokens) })}</span>
          <span>{t("commerce.token_cache_write", { value: new Intl.NumberFormat().format(usage.cacheWriteTokens) })}</span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-dls-secondary">{t("commerce.receipt_usage_pending")}</div>
      )}

      {tokenTotal !== null ? (
        <div className="mt-2 text-[11px] text-dls-secondary">
          {t("commerce.receipt_billed_tokens", { total: new Intl.NumberFormat().format(tokenTotal) })}
          {receipt.effectivePriceMultiplierBps !== null
            ? ` · RenCredit ×${(receipt.effectivePriceMultiplierBps / 10_000).toFixed(2)} · policy v${receipt.pricingPolicyVersion ?? 0}`
            : ""}
        </div>
      ) : null}
    </div>
  );
}

function ledgerLabel(entry: DenRenCreditLedgerEntry) {
  if (entry.entryType === "grant") return t("commerce.ledger_grant");
  if (entry.entryType === "reserve") return t("commerce.ledger_reserve");
  if (entry.entryType === "capture") return t("commerce.ledger_capture");
  if (entry.entryType === "release") return t("commerce.ledger_release");
  if (entry.entryType === "refund") return t("commerce.ledger_refund");
  return t("commerce.ledger_adjustment");
}

function ledgerDisplayDelta(entry: DenRenCreditLedgerEntry) {
  if (entry.entryType === "capture") return -entry.amountMicroCredits;
  return entry.availableDeltaMicroCredits;
}

function PlanCard(props: {
  plan: RenworkPlan;
  offer: RenworkPlanOffer;
  onAction: () => void;
}) {
  const enabledFeatures = FEATURE_LABELS.filter((feature) => props.plan.features[feature.key]);
  const isCurrent = props.offer.cta === "current";
  const offlineLabel = offlinePaymentLabel(props.offer);

  return (
    <article
      data-testid={`renwork-plan-${props.plan.id}`}
      className={`flex min-h-[380px] flex-col rounded-2xl border bg-dls-surface p-5 ${props.plan.recommended ? "border-emerald-8 shadow-sm" : "border-dls-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-dls-text">{props.plan.displayName}</h3>
          <p className="mt-1 text-xs leading-5 text-dls-secondary">{props.plan.summary}</p>
        </div>
        {props.plan.badge ? <Badge variant="secondary">{props.plan.badge}</Badge> : null}
      </div>

      <div className="mt-5">
        <div className="text-2xl font-semibold text-dls-text">{offerPrice(props.offer)}</div>
        <div className="mt-1 text-xs text-dls-secondary">
          {props.offer.billingInterval === "monthly"
            ? t("commerce.interval_monthly_hint")
            : props.offer.billingInterval === "annual"
              ? t("commerce.interval_annual_hint")
              : t("commerce.interval_not_applicable")}
        </div>
        {props.offer.purchaseMode === "request_access" && props.offer.billingInterval === "annual" && props.offer.monthlyEquivalentPriceMinor ? (
          <div className="mt-1 text-xs font-medium text-emerald-11">
            {t("commerce.annual_monthly_equivalent", { price: formatCurrencyMinor(props.offer.monthlyEquivalentPriceMinor, props.offer.currency) })}
          </div>
        ) : null}
      </div>

      <Button
        className="mt-4 w-full"
        variant={isCurrent ? "outline" : "default"}
        disabled={isCurrent}
        onClick={props.onAction}
      >
        {offerCta(props.offer)}
      </Button>

      {offlineLabel ? (
        <div className="mt-3 rounded-xl border border-amber-7/30 bg-amber-3 px-3 py-2 text-xs leading-5 text-amber-11" data-testid="offline-payment-channel">
          {offlineLabel}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 border-t border-dls-border pt-4">
        {props.offer.includedRenCredits !== null ? (
          <div className="flex items-start gap-2 text-xs text-dls-secondary">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-10" />
            <span>{t("commerce.included_credits", { credits: new Intl.NumberFormat().format(props.offer.includedRenCredits) })}</span>
          </div>
        ) : null}
        {props.plan.seatLimit ? (
          <div className="flex items-start gap-2 text-xs text-dls-secondary">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-10" />
            <span>{t("commerce.seat_limit", { seats: props.plan.seatLimit })}</span>
          </div>
        ) : null}
        {props.plan.qualityModelLimit ? (
          <div className="flex items-start gap-2 text-xs text-dls-secondary">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-10" />
            <span>{props.plan.qualityModelLimit.fairUse
              ? t("commerce.quality_model_fair_use")
              : t("commerce.quality_model_limit", { calls: props.plan.qualityModelLimit.calls ?? 0, hours: props.plan.qualityModelLimit.windowHours })}</span>
          </div>
        ) : null}
        {enabledFeatures.map((feature) => (
          <div key={feature.key} className="flex items-start gap-2 text-xs text-dls-secondary">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-10" />
            <span>{t(feature.labelKey)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function RenworkCommerceView() {
  const { activeOrganization, baseUrl, client, isSignedIn } = useCloudSession();
  const platform = usePlatform();
  const [audience, setAudience] = React.useState<RenworkPlanAudience>("personal");
  const [interval, setInterval] = React.useState<BillingInterval>("annual");
  const [catalog, setCatalog] = React.useState<Awaited<ReturnType<typeof client.getRenworkPlanCatalog>> | null>(null);
  const [wallet, setWallet] = React.useState<Awaited<ReturnType<typeof client.getRenCreditWallet>> | null>(null);
  const [receipts, setReceipts] = React.useState<DenRenCreditTaskReceipt[]>([]);
  const [modelCatalog, setModelCatalog] = React.useState<RenWorkPublicModelCatalog | null>(null);
  const [ledger, setLedger] = React.useState<DenRenCreditLedgerEntry[]>([]);
  const [walletLoading, setWalletLoading] = React.useState(false);
  const [walletError, setWalletError] = React.useState(false);
  const [activityError, setActivityError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadCatalog = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await client.getRenworkPlanCatalog());
    } catch (loadError) {
      setCatalog(null);
      setError(loadError instanceof Error ? loadError.message : t("commerce.catalog_error"));
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const canViewLedger = isDenOrgAdminRole(activeOrganization?.role);

  const loadCreditAccount = React.useCallback(async () => {
    const organizationId = activeOrganization?.id;
    if (!isSignedIn || !organizationId) {
      setWallet(null);
      setReceipts([]);
      setModelCatalog(null);
      setLedger([]);
      setWalletError(false);
      setActivityError(false);
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    setWalletError(false);
    setActivityError(false);
    const [walletResult, receiptsResult, ledgerResult, modelCatalogResult] = await Promise.allSettled([
      client.getRenCreditWallet(organizationId),
      client.getRenCreditTaskReceipts(organizationId),
      canViewLedger ? client.getRenCreditLedger(organizationId) : Promise.resolve([]),
      client.getRenWorkModelCatalog(organizationId),
    ]);
    if (walletResult.status === "fulfilled") setWallet(walletResult.value);
    else {
      setWallet(null);
      setWalletError(true);
    }
    if (receiptsResult.status === "fulfilled") setReceipts(receiptsResult.value);
    else {
      setReceipts([]);
      setActivityError(true);
    }
    if (ledgerResult.status === "fulfilled") setLedger(ledgerResult.value);
    else {
      setLedger([]);
      setActivityError(true);
    }
    setModelCatalog(modelCatalogResult.status === "fulfilled" ? modelCatalogResult.value : null);
    setWalletLoading(false);
  }, [activeOrganization?.id, canViewLedger, client, isSignedIn]);

  React.useEffect(() => {
    void loadCreditAccount();
  }, [loadCreditAccount]);

  const plans = catalog?.plans
    .filter((plan) => plan.audience === audience)
    .map((plan) => ({ plan, offer: offerForInterval(plan, interval) }))
    .filter((entry): entry is { plan: RenworkPlan; offer: RenworkPlanOffer } => entry.offer !== null)
    ?? [];

  const modelContextWindows = React.useMemo(() => new Map(
    modelCatalog?.models.map((model) => [model.sku, model.contextWindow] as const) ?? [],
  ), [modelCatalog]);

  const openBilling = () => {
    const target = new URL("/dashboard/billing", baseUrl);
    target.searchParams.set("source", "renwork-desktop");
    void platform.openLink(target.toString());
  };

  return (
    <SettingsStack data-testid="renwork-commerce-view">
      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("commerce.account_center_title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>
              {t("commerce.account_center_description")}
            </SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsInset className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-10" />
            <div>
              <div className="text-sm font-medium text-dls-text">{t("commerce.subscription_title")}</div>
              <div className="mt-1 text-xs text-dls-secondary">
                {isSignedIn ? t("commerce.subscription_pilot") : t("commerce.subscription_signin")}
              </div>
              {activeOrganization?.name ? (
                <div className="mt-2 text-xs text-dls-secondary">
                  {t("commerce.workspace_label", { workspace: activeOrganization.name })}
                </div>
              ) : null}
            </div>
          </SettingsInset>

          <SettingsInset
            className="flex min-w-0 items-start gap-3 overflow-hidden"
            data-testid={wallet ? "rencredit-balance" : "rencredit-balance-unavailable"}
          >
            <Coins className="mt-0.5 size-5 shrink-0 text-amber-10" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-dls-text">RenCredit</div>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <div className="whitespace-nowrap text-[11px] uppercase tracking-wide text-dls-secondary">{t("commerce.credit_available")}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-dls-text">
                    {walletLoading ? "…" : wallet ? formatRenCreditBalance(wallet.availableMicroCredits) : "—"}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 whitespace-nowrap text-[11px] uppercase tracking-wide text-dls-secondary">
                    <LockKeyhole className="size-3" />{t("commerce.credit_frozen")}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-dls-text" data-testid="rencredit-reserved-balance">
                    {walletLoading ? "…" : wallet ? formatRenCreditBalance(wallet.reservedMicroCredits) : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-1 text-xs text-dls-secondary">
                {wallet
                  ? t("commerce.credit_durable")
                  : walletError
                    ? t("commerce.credit_error")
                    : t("commerce.credit_pending")}
              </div>
            </div>
          </SettingsInset>
        </div>

        <SettingsNotice>{t("commerce.subscription_required_notice")}</SettingsNotice>
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("commerce.activity_title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>{t("commerce.activity_description")}</SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
          <Button size="sm" variant="outline" disabled={walletLoading || !isSignedIn} onClick={() => void loadCreditAccount()}>
            <RefreshCcw className={walletLoading ? "animate-spin" : ""} />
            {t("commerce.refresh")}
          </Button>
        </SettingsSectionHeader>

        {activityError ? <SettingsNotice tone="error">{t("commerce.activity_error")}</SettingsNotice> : null}

        <SettingsInset className="min-w-0 overflow-hidden">
          <div className="flex items-start gap-3">
            <ReceiptText className="mt-0.5 size-5 shrink-0 text-blue-10" />
            <div>
              <div className="text-sm font-medium text-dls-text">{t("commerce.receipts_title")}</div>
              <div className="mt-1 text-xs text-dls-secondary">{t("commerce.receipts_description")}</div>
            </div>
          </div>
          <div className="mt-3">
            {walletLoading && receipts.length === 0 ? (
              <div className="py-4 text-sm text-dls-secondary">{t("commerce.activity_loading")}</div>
            ) : receipts.length === 0 ? (
              <div className="py-4 text-sm text-dls-secondary">{t("commerce.receipts_empty")}</div>
            ) : receipts.map((receipt) => (
              <TaskReceiptRow
                key={receipt.id}
                receipt={receipt}
                contextWindow={modelContextWindows.get(receipt.modelSku) ?? null}
              />
            ))}
          </div>
        </SettingsInset>

        {canViewLedger ? (
          <SettingsInset className="min-w-0 overflow-hidden" data-testid="rencredit-admin-ledger">
            <div className="flex items-start gap-3">
              <History className="mt-0.5 size-5 shrink-0 text-violet-10" />
              <div>
                <div className="text-sm font-medium text-dls-text">{t("commerce.ledger_title")}</div>
                <div className="mt-1 text-xs text-dls-secondary">{t("commerce.ledger_description")}</div>
              </div>
            </div>
            <div className="mt-3">
              {walletLoading && ledger.length === 0 ? (
                <div className="py-4 text-sm text-dls-secondary">{t("commerce.activity_loading")}</div>
              ) : ledger.length === 0 ? (
                <div className="py-4 text-sm text-dls-secondary">{t("commerce.ledger_empty")}</div>
              ) : ledger.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-2 border-b border-dls-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" data-testid="rencredit-ledger-entry">
                  <div>
                    <div className="text-sm font-medium text-dls-text">{ledgerLabel(entry)}</div>
                    <div className="mt-1 break-words text-xs text-dls-secondary">{formatReceiptDate(entry.createdAt)} · {entry.reasonCode}</div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-semibold tabular-nums text-dls-text">{formatRenCreditDelta(ledgerDisplayDelta(entry))}</div>
                    <div className="mt-1 text-xs text-dls-secondary">
                      {t("commerce.ledger_balance_after", {
                        available: formatRenCreditBalance(entry.availableBalanceAfter),
                        frozen: formatRenCreditBalance(entry.reservedBalanceAfter),
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SettingsInset>
        ) : null}
      </SettingsSection>

      <SettingsSection>
        <SettingsSectionHeader>
          <SettingsSectionHeaderContent>
            <SettingsSectionHeaderTitle>{t("commerce.plans_title")}</SettingsSectionHeaderTitle>
            <SettingsSectionHeaderDescription>
              {catalog
                ? t("commerce.catalog_version", { version: catalog.catalogVersion })
                : t("commerce.catalog_authoritative")}
            </SettingsSectionHeaderDescription>
          </SettingsSectionHeaderContent>
        </SettingsSectionHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-dls-border bg-dls-sidebar p-1" aria-label={t("commerce.audience_label")}>
            {(["personal", "enterprise"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={audience === value ? "secondary" : "ghost"}
                onClick={() => {
                  setAudience(value);
                  if (value === "enterprise") setInterval("annual");
                }}
              >
                {value === "personal" ? t("commerce.personal") : t("commerce.enterprise")}
              </Button>
            ))}
          </div>

          {audience === "personal" ? <div className="flex rounded-xl border border-dls-border bg-dls-sidebar p-1" aria-label={t("commerce.interval_label")}>
            {(["monthly", "annual"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={interval === value ? "secondary" : "ghost"}
                onClick={() => setInterval(value)}
              >
                {value === "monthly" ? t("commerce.monthly") : t("commerce.annual")}
              </Button>
            ))}
          </div> : null}
        </div>

        {loading ? (
          <SettingsInset className="flex items-center gap-2 text-sm text-dls-secondary">
            <RefreshCcw className="size-4 animate-spin" />
            {t("commerce.catalog_loading")}
          </SettingsInset>
        ) : null}

        {error ? (
          <SettingsNotice tone="error">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t("commerce.catalog_error")}</span>
              <Button size="sm" variant="outline" onClick={() => void loadCatalog()}>
                {t("commerce.retry")}
              </Button>
            </div>
          </SettingsNotice>
        ) : null}

        {!loading && !error ? (
          <div className={`grid gap-3 ${audience === "personal" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
            {plans.map(({ plan, offer }) => (
              <PlanCard key={plan.id} plan={plan} offer={offer} onAction={openBilling} />
            ))}
          </div>
        ) : null}

        {audience === "enterprise" ? (
          <SettingsInset className="flex items-start gap-3">
            <Users className="mt-0.5 size-5 shrink-0 text-dls-secondary" />
            <div className="text-xs leading-5 text-dls-secondary">
              {t("commerce.enterprise_admin_notice")}
            </div>
          </SettingsInset>
        ) : null}
      </SettingsSection>
    </SettingsStack>
  );
}
