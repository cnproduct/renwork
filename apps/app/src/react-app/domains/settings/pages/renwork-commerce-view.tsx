/** @jsxImportSource react */
import * as React from "react";
import type {
  RenworkPlan,
  RenworkPlanAudience,
  RenworkPlanFeatures,
  RenworkPlanOffer,
} from "@openwork/types/renwork-commerce";
import { Check, Coins, RefreshCcw, ShieldCheck, Users } from "lucide-react";

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
  { key: "localFreeCore", labelKey: "commerce.feature_local_free_core" },
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

function offerCta(offer: RenworkPlanOffer): string {
  if (offer.cta === "current") return t("commerce.cta_current");
  if (offer.cta === "request_trial") return t("commerce.cta_request_trial");
  if (offer.cta === "contact_sales") return t("commerce.cta_contact_sales");
  return t("commerce.cta_checkout");
}

function PlanCard(props: {
  plan: RenworkPlan;
  offer: RenworkPlanOffer;
  onAction: () => void;
}) {
  const enabledFeatures = FEATURE_LABELS.filter((feature) => props.plan.features[feature.key]);
  const isCurrent = props.offer.cta === "current";

  return (
    <article
      data-testid={`renwork-plan-${props.plan.id}`}
      className="flex min-h-[340px] flex-col rounded-2xl border border-dls-border bg-dls-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-dls-text">{props.plan.displayName}</h3>
          <p className="mt-1 text-xs leading-5 text-dls-secondary">{props.plan.summary}</p>
        </div>
        {props.plan.audience === "enterprise" ? (
          <Badge variant="secondary">{t("commerce.enterprise_badge")}</Badge>
        ) : null}
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
      </div>

      <Button
        className="mt-4 w-full"
        variant={isCurrent ? "outline" : "default"}
        disabled={isCurrent}
        onClick={props.onAction}
      >
        {offerCta(props.offer)}
      </Button>

      <div className="mt-5 flex flex-col gap-2 border-t border-dls-border pt-4">
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

  const plans = catalog?.plans
    .filter((plan) => plan.audience === audience)
    .map((plan) => ({ plan, offer: offerForInterval(plan, interval) }))
    .filter((entry): entry is { plan: RenworkPlan; offer: RenworkPlanOffer } => entry.offer !== null)
    ?? [];

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

          <SettingsInset className="flex items-start gap-3" data-testid="rencredit-balance-unavailable">
            <Coins className="mt-0.5 size-5 shrink-0 text-amber-10" />
            <div>
              <div className="text-sm font-medium text-dls-text">RenCredit</div>
              <div className="mt-1 text-xl font-semibold text-dls-text">—</div>
              <div className="mt-1 text-xs text-dls-secondary">{t("commerce.credit_pending")}</div>
            </div>
          </SettingsInset>
        </div>

        <SettingsNotice>{t("commerce.free_core_notice")}</SettingsNotice>
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
                onClick={() => setAudience(value)}
              >
                {value === "personal" ? t("commerce.personal") : t("commerce.enterprise")}
              </Button>
            ))}
          </div>

          <div className="flex rounded-xl border border-dls-border bg-dls-sidebar p-1" aria-label={t("commerce.interval_label")}>
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
          </div>
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
          <div className="grid gap-3 md:grid-cols-2">
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
