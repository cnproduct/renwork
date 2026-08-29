/** @jsxImportSource react */
import { useEffect, useState, useRef } from "react";
import { Sparkles, ShieldCheck, Globe, ChevronDown, Check, Home } from "lucide-react";

import { currentLocale, setLocale, LANGUAGE_OPTIONS, type Language } from "../../../i18n";
import { useBootState } from "../../shell/boot-state";
import { Page, PageTitlebarRegion } from "@/components/page";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";

export type ModelSourceOption = "managed";

type WelcomePageProps = {
  onContinue: (option: ModelSourceOption) => void;
  busy?: boolean;
  error?: string | null;
  defaultOption?: ModelSourceOption;
};

export function WelcomePage({
  onContinue,
  busy,
  error,
  defaultOption = "managed",
}: WelcomePageProps) {
  const selectedOption = defaultOption;
  const [currentLang, setCurrentLang] = useState<Language>(currentLocale());
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { markRouteReady } = useBootState();

  useEffect(() => {
    markRouteReady();
  }, [markRouteReady]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    if (langMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [langMenuOpen]);

  const handleLanguageChange = (lang: Language) => {
    setLocale(lang);
    setCurrentLang(lang);
    setLangMenuOpen(false);
  };

  const currentLangLabel =
    LANGUAGE_OPTIONS.find((opt) => opt.value === currentLang)?.nativeName || "简体中文";

  return (
    <Page className="min-h-dvh bg-background select-none flex flex-col justify-between">
      <PageTitlebarRegion />

      {/* Top bar with traffic lights & Home icon */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-[#FF5F56]" />
            <div className="size-3 rounded-full bg-[#FFBD2E]" />
            <div className="size-3 rounded-full bg-[#27C93F]" />
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title="Home"
          >
            <Home className="size-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="relative z-10 flex-1">
        <ScrollAreaViewport>
          <div className="relative flex min-h-[calc(100vh-140px)] items-center justify-center px-6 py-8">
            <div className="w-full max-w-[620px] flex flex-col items-center">
              {/* Header Title & Subtitle */}
              <div className="text-center mb-8">
                <h1 className="text-[32px] font-bold tracking-tight text-foreground sm:text-[36px]">
                  开始使用 RenWork
                </h1>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground max-w-lg mx-auto">
                  一个账号，连接企业增长全链路。模型由 RenWork 统一托管、计量并使用 RenCredit 结算。
                </p>
              </div>

              <div className="w-full space-y-3.5">
                <div
                  data-testid="welcome-model-source-managed"
                  className="group relative flex items-center justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-4.5 shadow-sm dark:bg-emerald-950/20"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-3">
                    <div
                      className="size-12 rounded-2xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400"
                    >
                      <Sparkles className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-foreground">
                          RenWork 官方模型
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          推荐
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-normal text-muted-foreground">
                        登录后按个人版或企业版权益选择模型；所有正式模型用量统一计入 RenCredit。
                      </p>
                    </div>
                  </div>

                  {/* Radio Indicator */}
                  <div className="shrink-0 flex items-center justify-center">
                    <div className="size-5 rounded-full border-2 border-emerald-600 dark:border-emerald-400 flex items-center justify-center">
                      <div className="size-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 text-left">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    默认不开放自有 API Key、本地大模型或供应商配置。临时活动模型与特殊授权由 RenWork 平台超级管理员统一开通并设置有效期。
                  </p>
                </div>
              </div>

              {/* Error display */}
              {error ? (
                <p className="mt-3 text-center text-xs font-medium text-destructive">{error}</p>
              ) : null}

              {/* Continue Button */}
              <div className="w-full mt-6">
                <Button
                  data-testid="welcome-model-source-continue"
                  type="button"
                  size="lg"
                  className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[15px] font-semibold tracking-wide transition-all shadow-md cursor-pointer"
                  onClick={() => onContinue(selectedOption)}
                  disabled={busy}
                >
                  {busy ? "正在检查账号权益..." : "登录并查看套餐"}
                </Button>
              </div>
            </div>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>

      {/* Bottom Footer Bar */}
      <div className="relative z-20 flex items-center justify-between px-8 py-5 border-t border-border/40">
        <div className="flex flex-col gap-2">
          {/* Language Selector Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background/80 hover:bg-accent/50 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs w-fit"
            >
              <Globe className="size-3.5" />
              <span>{currentLangLabel}</span>
              <ChevronDown className="size-3 opacity-60 ml-0.5" />
            </button>

            {langMenuOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-48 max-h-60 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleLanguageChange(opt.value)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-accent cursor-pointer"
                  >
                    <span>{opt.nativeName}</span>
                    {currentLang === opt.value ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copyright */}
          <span className="text-[12px] text-muted-foreground/80">
            © 2026 RenWork · 保留所有权利。
          </span>
        </div>

        {/* Support avatar badge */}
        <div className="flex items-center gap-2">
          <div className="relative size-9 rounded-full bg-gradient-to-tr from-orange-400 via-pink-400 to-indigo-400 p-[1.5px] shadow-sm cursor-pointer hover:scale-105 transition-transform">
            <div className="size-full rounded-full bg-background flex items-center justify-center overflow-hidden">
              <span className="text-base">👩🏻‍💼</span>
            </div>
            <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
        </div>
      </div>
    </Page>
  );
}
