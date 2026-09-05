/** @jsxImportSource react */
import {
  ArrowRight,
  ArrowUpRight,
  Cloud,
  ChevronDown,
  ChevronUp,
  Laptop,
} from "lucide-react";
import { Dithering } from "@paper-design/shaders-react";

import { t } from "../../../i18n";
import { resolveExtensionIconSrc } from "../../design-system/extension-icon-src";
import { RenWorkBrandMark } from "../../design-system/renwork-brand-mark";
import { DEFAULT_DEN_BASE_URL } from "../../../app/lib/den";
import { Button } from "@/components/ui/button";
import { TextInput } from "../../design-system/text-input";
import { OrganizationServerAffordance } from "../settings/cloud/organization-server-affordance";
import { SignInFallbackNotice } from "./signin-fallback-notice";

export type DenSignInSurfaceVariant = "panel" | "fullscreen";

export type DenSignInSurfaceProps = {
  variant?: DenSignInSurfaceVariant;
  appName?: string;
  logoUrl?: string | null;
  developerMode: boolean;
  baseUrl: string;
  baseUrlDraft: string;
  baseUrlError: string | null;
  statusMessage: string | null;
  signinFallbackUrl?: string | null;
  authError: string | null;
  authBusy: boolean;
  baseUrlBusy: boolean;
  sessionBusy: boolean;
  manualAuthOpen: boolean;
  manualAuthInput: string;
  organizationServerBusy?: boolean;
  organizationServerError?: string | null;
  organizationServerUrl?: string;
  onUseLocalMode?: () => void;
  onBaseUrlDraftInput: (value: string) => void;
  onOrganizationServerSave?: (url: string) => Promise<boolean>;
  onResetBaseUrl: () => void;
  onApplyBaseUrl: () => void;
  onOpenControlPlane: () => void;
  onOpenBrowserAuth: (mode: "sign-in" | "sign-up") => void;
  onToggleManualAuth: () => void;
  onManualAuthInput: (value: string) => void;
  onSubmitManualAuth: () => void;
};

const settingsPanelClass = "ow-soft-card rounded-[28px] p-5 md:p-6";
const settingsPanelSoftClass = "ow-soft-card-quiet rounded-2xl p-4";
const headerBadgeClass =
  "inline-flex min-h-8 items-center gap-2 rounded-xl border border-dls-border bg-dls-hover px-3 text-[13px] font-medium text-dls-text shadow-sm";
const softNoticeClass =
  "rounded-xl border border-dls-border bg-dls-hover px-3 py-2 text-xs text-dls-secondary";
const errorBannerClass =
  "rounded-xl border border-red-7/30 bg-red-1/40 px-3 py-2 text-xs text-red-11";

/* ------------------------------------------------------------------ */
/*  Main surface                                                      */
/* ------------------------------------------------------------------ */

/**
 * React port of the Solid `DenSignInSurface`
 * (`apps/app/src/app/cloud/den-signin-surface.tsx` on dev).
 *
 * Stateless presentation: all state + actions are driven by the parent
 * (ForcedSigninPage for the full-screen gate, or the Den settings panel
 * for the embedded "panel" variant). Matches the Solid contract 1:1 so
 * feature parity is obvious.
 */
export function DenSignInSurface(props: DenSignInSurfaceProps) {
  const variant: DenSignInSurfaceVariant = props.variant ?? "panel";
  const appName = props.appName?.trim() || "RenWork";
  const localModeAvailable = typeof props.onUseLocalMode === "function";

  /* -- Panel content (reused by both variants) -- */
  const panelContent = (
    <div className={`${settingsPanelClass} space-y-4`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className={headerBadgeClass}>
            <Cloud size={13} className="text-dls-secondary" />
            {t("den.cloud_section_title")}
          </div>
          <div>
            <div className="text-sm font-medium text-dls-text">
              {t("den.signin_title")}
            </div>
          </div>
        </div>
      </div>

      {props.developerMode ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <TextInput
            label={t("den.cloud_control_plane_url_label")}
            value={props.baseUrlDraft}
            onChange={(event) =>
              props.onBaseUrlDraftInput(event.currentTarget.value)
            }
            placeholder={DEFAULT_DEN_BASE_URL}
            hint={t("den.cloud_control_plane_url_hint")}
            disabled={props.authBusy || props.baseUrlBusy || props.sessionBusy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={props.onResetBaseUrl}
              disabled={props.authBusy || props.baseUrlBusy || props.sessionBusy}
            >
              {t("den.cloud_control_plane_reset")}
            </Button>
            <Button
              size="sm"
              onClick={props.onApplyBaseUrl}
              disabled={props.authBusy || props.baseUrlBusy || props.sessionBusy}
            >
              {t("den.cloud_control_plane_save")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={props.onOpenControlPlane}
            >
              {t("den.cloud_control_plane_open")}
              <ArrowUpRight size={13} />
            </Button>
          </div>
        </div>
      ) : null}

      {props.baseUrlError ? (
        <div className={errorBannerClass}>{props.baseUrlError}</div>
      ) : null}

      {props.statusMessage && !props.authError ? (
        <div className={softNoticeClass}>{props.statusMessage}</div>
      ) : null}

      <div className="space-y-2">
        <div className="max-w-[54ch] text-sm text-dls-secondary">
          {t("den.auto_reconnect_hint")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => props.onOpenBrowserAuth("sign-in")}>
          {t("den.signin_button")}
          <ArrowUpRight size={13} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => props.onOpenBrowserAuth("sign-up")}
        >
          {t("den.create_account")}
          <ArrowUpRight size={13} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={props.onToggleManualAuth}
          disabled={props.authBusy || props.sessionBusy}
        >
          {props.manualAuthOpen
            ? t("den.hide_signin_code")
            : t("den.paste_signin_code")}
        </Button>
      </div>

      {props.signinFallbackUrl ? (
        <SignInFallbackNotice url={props.signinFallbackUrl} />
      ) : null}

      {props.manualAuthOpen ? (
        <div className={`${settingsPanelSoftClass} space-y-3`}>
          <TextInput
            label={t("den.signin_link_label")}
            value={props.manualAuthInput}
            onChange={(event) =>
              props.onManualAuthInput(event.currentTarget.value)
            }
            placeholder={t("den.signin_link_placeholder")}
            disabled={props.authBusy || props.sessionBusy}
            hint={t("den.signin_link_hint")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={props.onSubmitManualAuth}
              disabled={
                props.authBusy ||
                props.sessionBusy ||
                !props.manualAuthInput.trim()
              }
            >
              {props.authBusy ? t("den.finishing") : t("den.finish_signin")}
            </Button>
            <div className="text-[11px] text-dls-secondary">
              {t("den.signin_code_note")}
            </div>
          </div>
        </div>
      ) : null}

      {props.authError ? (
        <div className={errorBannerClass}>{props.authError}</div>
      ) : null}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Fullscreen: two-column split layout                             */
  /* ---------------------------------------------------------------- */

  if (variant === "fullscreen") {
    // Paper first-load spec: same centered welcome card as WelcomePage.
    // Forced sign-in only removes the "Use Without Cloud" option.
    return (
      <div className="relative min-h-dvh bg-background text-foreground">
        {/* Pixel-dither mosaic background (dark:invert keeps it visible in dark mode) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.1] dark:invert">
          <Dithering
            className="size-full"
            speed={0.01}
            shape="warp"
            type="2x2"
            size={20.3}
            scale={1.19}
            frame={264559.21}
            colorBack="#00000000"
            colorFront="#000000"
          />
        </div>

        {/* Titlebar drag region */}
        <div className="absolute inset-x-0 top-0 z-20 h-10 mac:titlebar-drag" />

        <div className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-16">
          <div className="w-full max-w-[760px] rounded-3xl border border-border bg-background/95 backdrop-blur-md px-8 pb-12 pt-10 sm:px-14 sm:pb-14 sm:pt-12 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {props.logoUrl ? (
                  <img
                    src={props.logoUrl}
                    alt="RenWork"
                    width={32}
                    height={32}
                    className="max-h-8 shrink-0 object-contain object-left"
                    aria-hidden="true"
                  />
                ) : (
                  <RenWorkBrandMark size={32} className="shrink-0" />
                )}
                <div className="flex flex-col">
                  <span className="text-[16px] font-bold tracking-tight text-foreground">
                    {appName}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    人人易AI 数字员工工作台
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                {localModeAvailable ? "✨ Standalone 独立版" : "RenWork Cloud"}
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:mt-10">
              <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.03em] text-foreground sm:text-[34px] sm:leading-[42px]">
                欢迎使用 {appName}
              </h1>
              <p className="text-[15px] leading-[23px] text-muted-foreground">
                人人易AI 智能外贸数字员工工作台 · 让AI真正替你干活
              </p>
            </div>

            {/* Local mode is available only in an explicitly standalone distribution. */}
            {localModeAvailable ? (
              <div className="mt-7 rounded-2xl border-2 border-orange-500/30 bg-orange-500/5 p-5 sm:p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💻</span>
                    <div>
                      <h3 className="text-base font-bold text-foreground">本地独立运行模式 (推荐)</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        无需注册云端账号，本地直连 DeepSeek / OpenAI / Claude 等模型，海关买家穿透、社媒矩阵与外联邮件全流程在本地私密高效运行。
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-bold px-2.5 py-0.5 border border-orange-500/30">
                    免登录 · 隐私安全
                  </span>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full text-[15px] font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2"
                  onClick={props.onUseLocalMode}
                >
                  🚀 直接进入本地数字员工工作台
                  <ArrowRight size={16} />
                </Button>
              </div>
            ) : null}

            {localModeAvailable ? (
              <div className="mt-8 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  或连接云端企业协同中心 (可选)
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : null}

            {/* Managed distributions expose cloud sign-in as the only entry path. */}
            <div
              className={`${localModeAvailable ? "mt-4" : "mt-8"} flex flex-col gap-3`}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-11 w-full text-[14px] font-medium border-border hover:bg-accent cursor-pointer flex items-center justify-center gap-2"
                onClick={() => props.onOpenBrowserAuth("sign-up")}
                disabled={props.authBusy || props.sessionBusy}
              >
                <Cloud size={15} className="text-muted-foreground" />
                登录 RenWork Cloud 云端同步 ↗
              </Button>

              {props.signinFallbackUrl ? (
                <SignInFallbackNotice url={props.signinFallbackUrl} />
              ) : null}

              {props.onOrganizationServerSave ? (
                <OrganizationServerAffordance
                  busy={props.organizationServerBusy === true}
                  error={props.organizationServerError ?? null}
                  onSave={props.onOrganizationServerSave}
                  url={props.organizationServerUrl ?? props.baseUrl}
                />
              ) : null}

              {props.statusMessage && !props.authError ? (
                <div className={softNoticeClass}>{props.statusMessage}</div>
              ) : null}

              {props.authError ? (
                <div className={errorBannerClass}>{props.authError}</div>
              ) : null}

              {/* Paste code disclosure */}
              <div className="space-y-3">
                <button
                  type="button"
                   className="flex w-full items-center gap-2 rounded-xl border border-dls-border bg-dls-surface/60 px-4 py-2.5 text-left text-xs font-medium text-dls-secondary transition-colors hover:bg-dls-surface"
                  onClick={props.onToggleManualAuth}
                  disabled={props.authBusy || props.sessionBusy}
                >
                  {props.manualAuthOpen ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  {props.manualAuthOpen
                    ? t("den.hide_signin_code")
                    : t("den.paste_signin_code")}
                </button>

                {props.manualAuthOpen ? (
                  <div className="space-y-3 rounded-xl border border-dls-border bg-dls-surface p-4">
                    <TextInput
                      label={t("den.signin_link_label")}
                      value={props.manualAuthInput}
                      onChange={(event) =>
                        props.onManualAuthInput(event.currentTarget.value)
                      }
                      placeholder={t("den.signin_link_placeholder")}
                      disabled={props.authBusy || props.sessionBusy}
                      hint={t("den.signin_link_hint")}
                    />
                    <button
                      type="button"
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-dls-accent px-4 text-xs font-semibold text-[var(--dls-accent-fg)] transition-all hover:bg-[var(--dls-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={props.onSubmitManualAuth}
                      disabled={
                        props.authBusy ||
                        props.sessionBusy ||
                        !props.manualAuthInput.trim()
                      }
                    >
                      {props.authBusy
                        ? t("den.finishing")
                        : t("den.finish_signin")}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Developer mode */}
              {props.developerMode ? (
                <div className="space-y-3 rounded-xl border border-dls-border bg-dls-surface p-4">
                  <TextInput
                    label={t("den.cloud_control_plane_url_label")}
                    value={props.baseUrlDraft}
                    onChange={(event) =>
                      props.onBaseUrlDraftInput(event.currentTarget.value)
                    }
                    placeholder={DEFAULT_DEN_BASE_URL}
                    hint={t("den.cloud_control_plane_url_hint")}
                    disabled={
                      props.authBusy || props.baseUrlBusy || props.sessionBusy
                    }
                  />
                  {props.baseUrlError ? (
                    <div className={errorBannerClass}>{props.baseUrlError}</div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-dls-border bg-dls-surface px-3.5 text-xs font-medium text-dls-text transition-colors hover:bg-dls-hover hover:border-dls-border disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={props.onResetBaseUrl}
                      disabled={
                        props.authBusy || props.baseUrlBusy || props.sessionBusy
                      }
                    >
                      {t("den.cloud_control_plane_reset")}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-dls-accent px-3.5 text-xs font-semibold text-[var(--dls-accent-fg)] transition-all hover:bg-[var(--dls-accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={props.onApplyBaseUrl}
                      disabled={
                        props.authBusy || props.baseUrlBusy || props.sessionBusy
                      }
                    >
                      {t("den.cloud_control_plane_save")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Panel variant (settings embed): unchanged                       */
  /* ---------------------------------------------------------------- */

  return panelContent;
}
