/** @jsxImportSource react */
import {
  ArrowUpRight,
  Check,
  Cloud,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";

import { t } from "../../../i18n";
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
    const steps = [
      { label: "验证身份", current: true },
      { label: "选择运行方式", current: false },
      { label: "开始工作", current: false },
    ];

    return (
      <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
        <div className="absolute inset-x-0 top-0 z-20 h-10 mac:titlebar-drag" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.045]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <main className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1040px] items-center gap-10 px-6 py-16 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
          <aside className="self-stretch rounded-2xl border border-dls-border bg-dls-surface p-6 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                {props.logoUrl ? (
                  <img
                    src={props.logoUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="max-h-9 shrink-0 object-contain object-left"
                  />
                ) : (
                  <RenWorkBrandMark size={36} className="shrink-0" />
                )}
                <div>
                  <div className="text-base font-semibold text-dls-text">{appName}</div>
                  <div className="text-xs text-dls-secondary">人人易AI 工作台</div>
                </div>
              </div>

              <ol className="mt-10 space-y-2" aria-label="首次连接进度">
                {steps.map((step, index) => (
                  <li
                    key={step.label}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${
                      step.current
                        ? "bg-dls-hover font-semibold text-dls-text"
                        : "text-dls-secondary"
                    }`}
                    aria-current={step.current ? "step" : undefined}
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg border border-dls-border bg-background text-xs">
                      {index === 0 ? <ShieldCheck className="size-4" aria-hidden="true" /> : index + 1}
                    </span>
                    {step.label}
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-8 text-xs leading-5 text-dls-secondary">
              登录建立身份、租户与权益通行证。选择本地运行后，本地文件仍由你掌控。
            </p>
          </aside>

          <section className="rounded-2xl border border-dls-border bg-background p-6 sm:p-9">
            <div className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-dls-border bg-dls-hover px-3 text-xs font-medium text-dls-text">
              <ShieldCheck className="size-4" aria-hidden="true" />
              身份通行证
            </div>
            <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-dls-text sm:text-[36px]">
              先连接账号，再决定运行位置
            </h1>
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-dls-secondary">
              注册或登录用于确认你的身份、所属租户和可用权益。完成后，你可以选择 RenWork 云端或本地 Agent、Ollama、CLI 与自己的模型 Key。
            </p>

            <div className="mt-6 rounded-xl border border-dls-border bg-dls-surface p-4">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-dls-text" aria-hidden="true" />
                <p className="text-xs leading-5 text-dls-secondary">
                  登录不会自动上传本地文件，也不会强制使用云端推理。运行方式将在下一步由你选择。
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                data-testid="renwork-signup"
                className="min-h-12 rounded-xl"
                onClick={() => props.onOpenBrowserAuth("sign-up")}
                disabled={props.authBusy || props.sessionBusy}
              >
                注册并连接
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-testid="renwork-signin"
                className="min-h-12 rounded-xl"
                onClick={() => props.onOpenBrowserAuth("sign-in")}
                disabled={props.authBusy || props.sessionBusy}
              >
                已有账号，登录
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {props.signinFallbackUrl ? (
              <div className="mt-4">
                <SignInFallbackNotice url={props.signinFallbackUrl} />
              </div>
            ) : null}

            {props.statusMessage && !props.authError ? (
              <div className={`${softNoticeClass} mt-4`} role="status" aria-live="polite">
                {props.statusMessage}
              </div>
            ) : null}

            {props.authError ? (
              <div className={`${errorBannerClass} mt-4`} role="alert">
                {props.authError}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dls-border bg-dls-surface px-4 text-left text-xs font-medium text-dls-secondary transition-colors hover:bg-dls-hover hover:text-dls-text"
                onClick={props.onToggleManualAuth}
                disabled={props.authBusy || props.sessionBusy}
                aria-expanded={props.manualAuthOpen}
              >
                {props.manualAuthOpen ? (
                  <ChevronUp className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-4" aria-hidden="true" />
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
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10"
                    onClick={props.onSubmitManualAuth}
                    disabled={
                      props.authBusy ||
                      props.sessionBusy ||
                      !props.manualAuthInput.trim()
                    }
                  >
                    {props.authBusy ? t("den.finishing") : t("den.finish_signin")}
                  </Button>
                </div>
              ) : null}
            </div>

            {props.onOrganizationServerSave ? (
              <div className="mt-5">
                <OrganizationServerAffordance
                  busy={props.organizationServerBusy === true}
                  error={props.organizationServerError ?? null}
                  onSave={props.onOrganizationServerSave}
                  url={props.organizationServerUrl ?? props.baseUrl}
                />
              </div>
            ) : null}

            {props.developerMode ? (
              <div className="mt-5 space-y-3 rounded-xl border border-dls-border bg-dls-surface p-4">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={props.onResetBaseUrl}
                    disabled={
                      props.authBusy || props.baseUrlBusy || props.sessionBusy
                    }
                  >
                    {t("den.cloud_control_plane_reset")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={props.onApplyBaseUrl}
                    disabled={
                      props.authBusy || props.baseUrlBusy || props.sessionBusy
                    }
                  >
                    {t("den.cloud_control_plane_save")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={props.onOpenControlPlane}
                  >
                    {t("den.cloud_control_plane_open")}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Panel variant (settings embed): unchanged                       */
  /* ---------------------------------------------------------------- */

  return panelContent;
}
