/** @jsxImportSource react */
import { useEffect } from "react";
import { Dithering } from "@paper-design/shaders-react";

import { t } from "../../../i18n";
import { useBootState } from "../../shell/boot-state";
import { resolveExtensionIconSrc } from "@/react-app/design-system/extension-icon-src";
import {
  Page,
  PageTitlebarRegion,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";
import { useShellConfig } from "../../shell/shell-config";

type WelcomePageProps = {
  onGetStarted: () => void;
  onSelectFolder?: () => void;
  getStartedLabel?: string;
  busy?: boolean;
  error?: string | null;
  manualFolder?: string;
  onManualFolderChange?: (value: string) => void;
  onUseManualFolder?: () => void;
  showManualFolder?: boolean;
  onTeamSignIn?: () => void;
  onJoinOrganization?: () => void;
};

export function WelcomePage({
  onGetStarted,
  onSelectFolder,
  getStartedLabel,
  busy,
  error,
  manualFolder,
  onManualFolderChange,
  onUseManualFolder,
  showManualFolder,
  onTeamSignIn,
  onJoinOrganization,
}: WelcomePageProps) {
  const { config: shellConfig } = useShellConfig();
  const appName = "RenWork · 人人易AI";
  const { markRouteReady } = useBootState();

  useEffect(() => {
    markRouteReady();
  }, [markRouteReady]);

  return (
    <Page className="min-h-dvh">
      <PageTitlebarRegion />

      <ScrollArea className="relative z-10">
        <ScrollAreaViewport>
          <div className="relative flex min-h-dvh items-center justify-center px-6 py-16">
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.08] dark:invert">
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

            <div className="relative z-10 w-full max-w-[760px] rounded-3xl border border-border bg-background/95 backdrop-blur-md px-8 pb-12 pt-10 shadow-2xl sm:px-14 sm:pb-14 sm:pt-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveExtensionIconSrc("/openwork-mark.svg")}
                    alt="RenWork"
                    width={32}
                    height={32}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col">
                    <span className="text-[16px] font-bold tracking-tight text-foreground">
                      {appName}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      数字员工工作台 (Digital Employee)
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  ✨ Standalone 独立版
                </span>
              </div>

              <div className="mt-8 flex flex-col gap-2 sm:mt-10">
                <h1 className="text-[28px] font-bold leading-[36px] tracking-[-0.03em] text-foreground sm:text-[34px] sm:leading-[42px]">
                  {t("welcome.title")}
                </h1>
                <p className="text-[15px] leading-[23px] text-muted-foreground">
                  {t("welcome.subtitle")}
                </p>
              </div>

              {/* Foreign Trade Digital Employee Capabilities Grid */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-accent/30 p-3.5 flex items-start gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">OKKI 海关买家穿透</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">自动化挖掘采购商、提单记录与关键人联系方式</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-accent/30 p-3.5 flex items-start gap-3">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">6语种社媒矩阵营销</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">生成英/日/德/越/泰/中文图文并发布到 LinkedIn/FB</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-accent/30 p-3.5 flex items-start gap-3">
                  <span className="text-2xl">✉️</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Zoho 自动化外联</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">起草高转化个性化开发信并通过 SMTP 智能轮询发信</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-accent/30 p-3.5 flex items-start gap-3">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">多模型自由切换</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">支持 DeepSeek / OpenAI / Claude / Gemini 本地直连</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-13 w-full text-[16px] font-semibold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20 cursor-pointer"
                  onClick={onGetStarted}
                  disabled={busy}
                  data-testid="welcome-use-without-cloud"
                >
                  {busy
                    ? t("welcome.creating_workspace")
                    : (getStartedLabel || t("welcome.use_without_cloud"))}
                </Button>

                {onSelectFolder ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full text-[14px] font-medium cursor-pointer"
                    onClick={onSelectFolder}
                    disabled={busy}
                  >
                    📁 选择或切换本地工作目录
                  </Button>
                ) : null}

                {onTeamSignIn ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="h-11 w-full text-[14px] font-medium"
                    onClick={onTeamSignIn}
                    disabled={busy}
                    data-testid="welcome-team-signin"
                  >
                    {t("welcome.sign_in_cloud")}
                  </Button>
                ) : null}

                {onJoinOrganization ? (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 cursor-pointer"
                      onClick={onJoinOrganization}
                      data-testid="welcome-join-org"
                    >
                      {t("welcome.join_org")}
                    </button>
                  </div>
                ) : null}

                {error ? (
                  <p className="text-center text-xs text-destructive">{error}</p>
                ) : null}

                {showManualFolder ? (
                  <div className="rounded-xl border border-dashed border-border p-3">
                    <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                      Daytona folder path
                      <input
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-ring"
                        value={manualFolder ?? ""}
                        onChange={(event) => onManualFolderChange?.(event.target.value)}
                        placeholder="/workspace/my-project"
                      />
                    </label>
                    <Button
                      className="mt-2 w-full"
                      variant="outline"
                      onClick={onUseManualFolder}
                      disabled={busy || !manualFolder?.trim()}
                    >
                      Use this folder
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </Page>
  );
}
