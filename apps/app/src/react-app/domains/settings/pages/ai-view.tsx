/** @jsxImportSource react */
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, KeyRound, Laptop2, Sparkles, X } from "lucide-react";

import { t } from "@/i18n";
import { isCloudManagedProviderKey } from "@/react-app/domains/connections/provider-auth/cloud-provider-config";
import { ProviderIcon } from "../../../design-system/provider-icon";
import { SettingsNotice, SettingsStatusBadge } from "../settings-section";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemFootnote,
  LayoutSectionItemHeader,
  LayoutSectionItemHeaderActions,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
  LayoutStack,
} from "../settings-layout";

type ConnectedProvider = {
  id: string;
  name: string;
  source?: "env" | "api" | "config" | "custom";
};

export type AiSettingsViewProps = {
  busy: boolean;
  providerAuthBusy: boolean;
  providerStatusLabel: string;
  providerStatusStyle: string;
  providerSummary: string;
  connectedProviders: ConnectedProvider[];
  disconnectingProviderId: string | null;
  providerConnectError: string | null;
  providerDisconnectStatus: string | null;
  providerDisconnectError: string | null;
  onOpenProviderAuth: () => void | Promise<void>;
  onOpenCustomProviders?: () => void;
  onDisconnectProvider: (providerId: string) => void | Promise<void>;
  canDisconnectProvider: (provider: ConnectedProvider) => boolean;
  canAddProviders: boolean;
  canConnectPersonalSubscriptions?: boolean;
  onOpenPersonalSubscriptionAuth?: () => void | Promise<void>;
  personalSubscriptionProviderIds?: Set<string>;
  organizationName?: string;
  /** Set of local provider IDs that were imported from cloud. */
  cloudProviderIds?: Set<string>;
  showOpenWorkModelsSubscribe?: boolean;
  /** Subtle fallback row when RenWork Models is not connected and the banner was dismissed. */
  showOpenWorkModelsConnect?: boolean;
  /** Den entitlement is present but local engine has no selectable openwork models yet. */
  showOpenWorkModelsSyncing?: boolean;
  onSubscribeOpenWorkModels?: () => void | Promise<void>;
  onDismissOpenWorkModels?: () => void | Promise<void>;
  cloudProvidersView?: ReactNode;
  cliRuntimesView?: ReactNode;
};

function providerSourceLabel(source?: ConnectedProvider["source"]) {
  if (source === "env") return t("settings.provider_source_env");
  if (source === "api") return t("settings.provider_source_api");
  if (source === "config") return t("settings.provider_source_config");
  if (source === "custom") return t("settings.provider_source_config");
  return null;
}

function providerSourceBadgeClassName(input: { orgManaged: boolean; source?: ConnectedProvider["source"] }) {
  if (input.orgManaged) {
    return "shrink-0 rounded-full border border-blue-6 bg-blue-2 px-2 py-0.5 text-[10px] font-medium text-blue-11";
  }
  if (input.source === "env") {
    return "shrink-0 rounded-full border border-amber-6 bg-amber-2 px-2 py-0.5 text-[10px] font-medium text-amber-11";
  }
  return "shrink-0 rounded-full border border-dls-border bg-dls-sidebar/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground";
}

function providerStatusTone(label: string): "ready" | "warning" | "neutral" {
  if (label.toLowerCase().includes("connected")) return "ready";
  if (label.toLowerCase().includes("error") || label.toLowerCase().includes("fail")) return "warning";
  return "neutral";
}

export function AiSettingsView(props: AiSettingsViewProps) {
  const organizationProviderLabel = props.organizationName?.trim() || t("settings.provider_source_organization");

  return (
    <LayoutStack>
      {/* ---- Providers ---- */}
      <LayoutSection>
        <LayoutSectionHeader>
          <LayoutSectionTitle>{t("settings.providers_title")}</LayoutSectionTitle>
          <LayoutSectionDescription>{t("settings.providers_desc")}</LayoutSectionDescription>
        </LayoutSectionHeader>

        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>
              {props.providerSummary}
              <SettingsStatusBadge
                tone={providerStatusTone(props.providerStatusLabel)}
                label={props.providerStatusLabel}
              />
            </LayoutSectionItemTitle>
            {props.canAddProviders ? (
              <LayoutSectionItemHeaderActions>
                {props.onOpenCustomProviders ? (
                  <Button
                    variant="outline"
                    onClick={() => void props.onOpenCustomProviders?.()}
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="size-3.5" />
                    自定义大模型管理
                  </Button>
                ) : null}
                <Button
                  onClick={() => void props.onOpenProviderAuth()}
                  disabled={props.busy || props.providerAuthBusy}
                >
                  {props.providerAuthBusy
                    ? t("settings.loading_providers")
                    : t("settings.connect_provider")}
                </Button>
              </LayoutSectionItemHeaderActions>
            ) : null}
          </LayoutSectionItemHeader>
        </LayoutSectionItem>

        {props.showOpenWorkModelsSubscribe ? (
          <LayoutSectionItem className="relative overflow-hidden rounded-2xl border border-blue-6 bg-blue-2/30 px-4 py-4">
            <button
              type="button"
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-blue-11 transition-colors hover:bg-blue-3/70"
              onClick={() => void props.onDismissOpenWorkModels?.()}
              aria-label="Dismiss RenWork Models banner"
            >
              <X className="size-3.5" />
            </button>
            <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <ProviderIcon providerId="openwork" size={22} className="mt-0.5 shrink-0 text-blue-11" />
                <div className="min-w-0 space-y-2">
                  <div>
                    <div className="text-sm font-medium text-dls-text">RenWork Models</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Hosted frontier models for RenWork tasks without managing provider API keys.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-blue-11">
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-6 bg-blue-3 px-2 py-0.5">
                      <CheckCircle2 className="size-3" /> Managed by RenWork Cloud
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-6 bg-blue-3 px-2 py-0.5">
                      <KeyRound className="size-3" /> No API key setup
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.renwork_model_billing_info")}
                  </p>
                </div>
              </div>
              <Button
                className="shrink-0"
                onClick={() => void props.onSubscribeOpenWorkModels?.()}
                disabled={props.busy || props.providerAuthBusy}
              >
                Subscribe
                <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </LayoutSectionItem>
        ) : null}

        {props.connectedProviders.length > 0 && props.canAddProviders ? (
          <div className="space-y-2">
            {props.connectedProviders.map((provider) => {
              const orgManaged = isCloudManagedProviderKey(provider.id);
              const managedByCloud = orgManaged || props.cloudProviderIds?.has(provider.id) === true;
              const sourceLabel = orgManaged
                ? organizationProviderLabel
                : providerSourceLabel(provider.source);
              return (
                <LayoutSectionItem
                  key={provider.id}
                  className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-dls-border px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ProviderIcon providerId={provider.id} size={20} className="text-dls-text" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-dls-text">{provider.name}</span>
                        {sourceLabel ? (
                          <span className={providerSourceBadgeClassName({ orgManaged, source: provider.source })}>
                            {sourceLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">{provider.id}</div>
                    </div>
                  </div>
                  {props.canAddProviders && !managedByCloud ? (
                    <Button
                      variant="destructive"
                      onClick={() => void props.onDisconnectProvider(provider.id)}
                      disabled={
                        props.busy ||
                        props.providerAuthBusy ||
                        props.disconnectingProviderId !== null ||
                        !props.canDisconnectProvider(provider)
                      }
                    >
                      {props.disconnectingProviderId === provider.id
                        ? t("settings.disconnecting")
                        : props.canDisconnectProvider(provider)
                          ? t("settings.disconnect")
                          : t("settings.managed_by_env")}
                    </Button>
                  ) : null}
                </LayoutSectionItem>
              );
            })}
          </div>
        ) : null}

        {props.showOpenWorkModelsConnect ? (
          <LayoutSectionItem className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-dls-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderIcon providerId="openwork" size={20} className="text-muted-foreground" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-dls-text">RenWork Models</span>
                  <span className="shrink-0 rounded-full border border-dls-border bg-dls-sidebar/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Not connected
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Hosted frontier models without managing API keys.
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => void props.onSubscribeOpenWorkModels?.()}
              disabled={props.busy || props.providerAuthBusy}
            >
              Connect
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </LayoutSectionItem>
        ) : null}

        {props.showOpenWorkModelsSyncing ? (
          <LayoutSectionItem className="flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-6/50 bg-amber-2/20 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderIcon providerId="openwork" size={20} className="text-amber-11" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-dls-text">RenWork Models</span>
                  <span className="shrink-0 rounded-full border border-amber-6 bg-amber-3 px-2 py-0.5 text-[10px] font-medium text-amber-11">
                    Included — syncing
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  RenWork Models will become available automatically when the pending workspace reload completes.
                </div>
              </div>
            </div>
          </LayoutSectionItem>
        ) : null}

        {props.providerConnectError ? (
          <SettingsNotice tone="error">{props.providerConnectError}</SettingsNotice>
        ) : null}
        {props.providerDisconnectStatus ? (
          <SettingsNotice>{props.providerDisconnectStatus}</SettingsNotice>
        ) : null}
        {props.providerDisconnectError ? (
          <SettingsNotice tone="error">{props.providerDisconnectError}</SettingsNotice>
        ) : null}

        <LayoutSectionItemFootnote>
          {props.canAddProviders
            ? t("settings.api_keys_info")
            : t("settings.renwork_provider_admin_only")}
        </LayoutSectionItemFootnote>
      </LayoutSection>

      {props.canConnectPersonalSubscriptions ? (
        <LayoutSection>
          <LayoutSectionHeader>
            <LayoutSectionTitle>本机订阅账号</LayoutSectionTitle>
            <LayoutSectionDescription>
              在当前电脑连接个人订阅，不上传 OAuth 凭据，也不向普通用户开放 API Key。
            </LayoutSectionDescription>
          </LayoutSectionHeader>

          <LayoutSectionItem className="gap-4 rounded-2xl border border-indigo-5/40 bg-indigo-2/20 px-4 py-4">
            <LayoutSectionItemHeader>
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-indigo-5/40 bg-indigo-3/30 text-indigo-11">
                  <Laptop2 className="size-4" />
                </div>
                <div className="min-w-0">
                  <LayoutSectionItemTitle>OpenAI Codex 与 Google Antigravity</LayoutSectionItemTitle>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    支持 ChatGPT Plus/Pro 与 Gemini/Antigravity 的本机 OAuth。登录只建立本机执行凭据；模型白名单、预算和价格仍由 RenWork 平台控制。
                  </p>
                </div>
              </div>
              <LayoutSectionItemHeaderActions>
                <Button
                  variant="outline"
                  onClick={() => void props.onOpenPersonalSubscriptionAuth?.()}
                  disabled={props.busy || props.providerAuthBusy}
                >
                  {props.providerAuthBusy ? "正在读取…" : "连接订阅账号"}
                </Button>
              </LayoutSectionItemHeaderActions>
            </LayoutSectionItemHeader>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: "openai", name: "OpenAI Codex", plan: "ChatGPT Plus / Pro" },
                { id: "google", name: "Google Antigravity", plan: "Gemini subscription" },
              ].map((provider) => {
                const connected = props.personalSubscriptionProviderIds?.has(provider.id) === true;
                return (
                  <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl border border-dls-border bg-dls-surface px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProviderIcon providerId={provider.id} size={20} className="shrink-0 text-dls-text" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-dls-text">{provider.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{provider.plan}</div>
                      </div>
                    </div>
                    {connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void props.onDisconnectProvider(provider.id)}
                        disabled={props.busy || props.providerAuthBusy}
                      >
                        断开
                      </Button>
                    ) : (
                      <span className="shrink-0 rounded-full border border-dls-border px-2 py-0.5 text-[10px] text-muted-foreground">未连接</span>
                    )}
                  </div>
                );
              })}
            </div>

            <SettingsNotice>
              RenWork 内的每次调用仍先冻结 RenCredit，完成后按实际输入、输出、推理与缓存 Token 结算；失败或取消会释放冻结额度。
              直接在 Codex CLI、Antigravity CLI 或其他应用中发起的调用不会经过 RenWork，因此不会计入 RenCredit。
            </SettingsNotice>
          </LayoutSectionItem>
        </LayoutSection>
      ) : null}

      {props.cliRuntimesView}

      {props.cloudProvidersView}

    </LayoutStack>
  );
}
