/** @jsxImportSource react */
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  Cloud,
  Globe,
  HardDrive,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

import {
  currentLocale,
  LANGUAGE_OPTIONS,
  setLocale,
  type Language,
} from "../../../i18n";
import { useBootState } from "../../shell/boot-state";
import { Page, PageTitlebarRegion } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  ScrollArea,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area";

export type ModelSourceOption = "managed" | "local" | "byok";

type WelcomePageProps = {
  onContinue: (option: ModelSourceOption) => void;
  busy?: boolean;
  error?: string | null;
  defaultOption?: ModelSourceOption;
  accountLabel?: string | null;
  organizationName?: string | null;
};

export function WelcomePage({
  onContinue,
  busy,
  error,
  defaultOption = "managed",
  accountLabel,
  organizationName,
}: WelcomePageProps) {
  const [selectedOption, setSelectedOption] =
    useState<ModelSourceOption>(defaultOption);
  const [currentLang, setCurrentLang] = useState<Language>(currentLocale());
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { markRouteReady } = useBootState();
  const localChoiceActive =
    selectedOption === "local" || selectedOption === "byok";

  useEffect(() => {
    markRouteReady();
  }, [markRouteReady]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        langMenuRef.current &&
        !langMenuRef.current.contains(event.target as Node)
      ) {
        setLangMenuOpen(false);
      }
    }

    if (langMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [langMenuOpen]);

  const handleLanguageChange = (language: Language) => {
    setLocale(language);
    setCurrentLang(language);
    setLangMenuOpen(false);
  };

  const currentLangLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === currentLang)?.nativeName ||
    "简体中文";
  const account = accountLabel?.trim() || "RenWork 账号";
  const organization = organizationName?.trim() || "个人工作区";
  const continueLabel =
    selectedOption === "managed"
      ? "继续使用 RenWork 云端"
      : selectedOption === "byok"
        ? "继续配置自己的 Key"
        : "继续配置本地 Agent";

  return (
    <Page className="flex min-h-dvh select-none flex-col bg-background">
      <PageTitlebarRegion />

      <ScrollArea className="relative z-10 flex-1">
        <ScrollAreaViewport>
          <main className="mx-auto flex min-h-dvh w-full max-w-[960px] flex-col px-6 pb-8 pt-14 sm:px-10 sm:pt-16">
            <div
              className="flex flex-col gap-4 rounded-2xl border border-dls-border bg-dls-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              data-testid="verified-account"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-dls-hover text-dls-text">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-dls-secondary">
                    身份已验证
                  </div>
                  <div className="truncate text-sm font-semibold text-dls-text">
                    {account}
                  </div>
                </div>
              </div>
              <div className="text-xs text-dls-secondary">
                当前租户：<span className="font-medium text-dls-text">{organization}</span>
              </div>
            </div>

            <div className="mt-10 max-w-[680px]">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-dls-secondary">
                第 2 步 · 选择运行方式
              </div>
              <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-dls-text sm:text-[36px]">
                数据由你决定放在哪里
              </h1>
              <p className="mt-3 max-w-[62ch] text-sm leading-6 text-dls-secondary">
                登录只用于确认身份、租户与可用权益。选择本地运行不会自动上传本地文件，也不会强制使用云端推理。
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <button
                type="button"
                data-testid="runtime-managed"
                aria-pressed={selectedOption === "managed"}
                onClick={() => setSelectedOption("managed")}
                className={`min-h-44 rounded-2xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selectedOption === "managed"
                    ? "border-dls-text bg-dls-hover"
                    : "border-dls-border bg-dls-surface hover:bg-dls-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-dls-border bg-background text-dls-text">
                    <Cloud className="size-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-dls-secondary">
                    托管服务
                  </span>
                </div>
                <div className="mt-5 text-base font-semibold text-dls-text">
                  RenWork 云端
                </div>
                <p className="mt-2 text-sm leading-5 text-dls-secondary">
                  由 RenWork 管理模型接入与云端能力，适合多设备和团队协同。
                </p>
              </button>

              <button
                type="button"
                data-testid="runtime-local"
                aria-pressed={localChoiceActive}
                onClick={() => setSelectedOption("local")}
                className={`min-h-44 rounded-2xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  localChoiceActive
                    ? "border-dls-text bg-dls-hover"
                    : "border-dls-border bg-dls-surface hover:bg-dls-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-dls-border bg-background text-dls-text">
                    <HardDrive className="size-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-dls-secondary">
                    本地免费核心
                  </span>
                </div>
                <div className="mt-5 text-base font-semibold text-dls-text">
                  本地运行
                </div>
                <p className="mt-2 text-sm leading-5 text-dls-secondary">
                  使用本机 Agent、Ollama、CLI 或自己的模型 Key，本地知识工作保持在本机。
                </p>
              </button>
            </div>

            {localChoiceActive ? (
              <section
                className="mt-4 rounded-2xl border border-dls-border bg-dls-surface p-4"
                aria-label="本地运行配置"
              >
                <div className="mb-3 px-1 text-xs font-medium text-dls-secondary">
                  选择本地模型连接方式
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="runtime-local-agent"
                    aria-pressed={selectedOption === "local"}
                    onClick={() => setSelectedOption("local")}
                    className={`min-h-24 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedOption === "local"
                        ? "border-dls-text bg-dls-hover"
                        : "border-dls-border bg-background hover:bg-dls-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-dls-text">
                      <Bot className="size-4" aria-hidden="true" />
                      本地 Agent / Ollama / CLI
                    </div>
                    <p className="mt-2 text-xs leading-5 text-dls-secondary">
                      连接已安装的本地智能体或本地模型服务。
                    </p>
                  </button>
                  <button
                    type="button"
                    data-testid="runtime-byok"
                    aria-pressed={selectedOption === "byok"}
                    onClick={() => setSelectedOption("byok")}
                    className={`min-h-24 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedOption === "byok"
                        ? "border-dls-text bg-dls-hover"
                        : "border-dls-border bg-background hover:bg-dls-hover"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-dls-text">
                      <KeyRound className="size-4" aria-hidden="true" />
                      使用自己的模型 Key
                    </div>
                    <p className="mt-2 text-xs leading-5 text-dls-secondary">
                      密钥由你配置，用量由对应模型服务商结算。
                    </p>
                  </button>
                </div>
              </section>
            ) : null}

            {error ? (
              <p className="mt-4 text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-4 border-t border-dls-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative" ref={langMenuRef}>
                <button
                  type="button"
                  onClick={() => setLangMenuOpen((open) => !open)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dls-border bg-dls-surface px-3 text-xs font-medium text-dls-secondary transition-colors hover:bg-dls-hover hover:text-dls-text"
                  aria-expanded={langMenuOpen}
                >
                  <Globe className="size-4" aria-hidden="true" />
                  {currentLangLabel}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
                {langMenuOpen ? (
                  <div className="absolute bottom-full left-0 z-50 mb-2 max-h-60 w-48 overflow-y-auto rounded-xl border border-dls-border bg-popover p-1 shadow-lg">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLanguageChange(option.value)}
                        className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-xs text-popover-foreground hover:bg-accent"
                      >
                        <span>{option.nativeName}</span>
                        {currentLang === option.value ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button
                type="button"
                size="lg"
                data-testid="runtime-continue"
                className="min-h-12 min-w-56 rounded-xl"
                onClick={() => onContinue(selectedOption)}
                disabled={busy}
              >
                {busy ? "正在创建工作区…" : continueLabel}
              </Button>
            </div>
          </main>
        </ScrollAreaViewport>
      </ScrollArea>
    </Page>
  );
}
