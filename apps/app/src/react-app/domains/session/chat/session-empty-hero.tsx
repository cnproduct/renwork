/** @jsxImportSource react */
import { useState } from "react";

import type { ComposerAttachment } from "@/app/types";
import { resolveOrganizationPromptCardContent } from "@/components/chat/task-suggestions";
import { useOrgRestrictions } from "@/react-app/domains/cloud/desktop-config-provider";
import { NewTaskComposer, type NewTaskComposerContext } from "./new-task-composer";

type HeroSuggestion = {
  title: string;
  description: string;
  prompt: string;
};

const DEFAULT_SUGGESTIONS: HeroSuggestion[] = [
  {
    title: "OKKI & 海关买家穿透",
    description: "提取公海与海关提单，穿透采购负责人联系方式",
    prompt: "请帮我启动 OKKI / 海关提单真实买家穿透流程，分析目标海外采购商的真实采购数据与决策人联系方式。",
  },
  {
    title: "6 语种社媒矩阵营销",
    description: "一键生成并发布多语言专业图文至 LinkedIn 与 Facebook",
    prompt: "请为我们的外贸产品生成 6 语种（英语、德语、日语、西语、阿语、中文）的社媒矩阵营销推文与配图建议。",
  },
  {
    title: "Zoho 自动化外贸开发信",
    description: "批量生成个性化高转化开发信，自动通过 Zoho 发送与跟进",
    prompt: "请帮我根据目标海外买家画像，撰写并规划一套针对性极强的 Zoho 自动化外贸开发信与跟进序列。",
  },
  {
    title: "外贸海关数据智能清洗",
    description: "上传海关提单或客户表格，自动清洗去重与补齐字段",
    prompt: "请帮我清洗这份海关/外贸客户数据表格，剔除无效数据并按采购体量与国家维度进行结构化分类。",
  },
];

export type SessionEmptyHeroProps = {
  providerCount: number;
  /** Disable submission while a default workspace is being prepared. */
  busy?: boolean;
  /** Called with the task prompt and attachments; the caller creates the session (and workspace if needed). */
  onRunTask: (prompt: string, attachments: ComposerAttachment[]) => void;
  onOpenProviderAuth?: () => void;
  /** Workspace-scoped wiring for the full composer (skills, agents, models). */
  composer?: NewTaskComposerContext | null;
};

/**
 * Paper "first chat" empty state: the real session composer front and
 * center with suggestion cards below. Suggestions come from desktop
 * policies (organization onboarding prompts) when configured, with
 * built-in defaults otherwise.
 */
export function SessionEmptyHero(props: SessionEmptyHeroProps) {
  const [prompt, setPrompt] = useState("");
  const orgRestrictions = useOrgRestrictions();

  const organizationPrompts = orgRestrictions.onboardingPrompts;
  const suggestions: HeroSuggestion[] = organizationPrompts !== undefined
    ? organizationPrompts.map((orgPrompt, index) => {
      const card = resolveOrganizationPromptCardContent({
        prompt: orgPrompt,
        description: orgRestrictions.onboardingPromptDescriptions?.[index],
        index,
      });
      return { title: card.title, description: card.description, prompt: card.selectionPrompt };
    })
    : DEFAULT_SUGGESTIONS;

  const submit = (resolvedPrompt: string, attachments: ComposerAttachment[]) => {
    const trimmedPrompt = resolvedPrompt.trim();
    if (!trimmedPrompt || props.busy) return;
    props.onRunTask(trimmedPrompt, attachments);
  };

  const fillPrompt = (value: string) => {
    setPrompt(value);
    window.dispatchEvent(new Event("openwork:focusPrompt"));
  };

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-6 px-4 max-lg:px-4 sm:px-6">
      <div className="space-y-1.5 text-center">
        <h2 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-foreground">
          今天需要为您完成什么外贸任务？
        </h2>
        <p className="text-[13px] text-muted-foreground">在下方输入您的需求，或点击下方内置的人人易 AI 数字员工工具开始</p>
      </div>

      <NewTaskComposer
        draft={prompt}
        onDraftChange={setPrompt}
        onRunTask={submit}
        busy={props.busy ?? false}
        context={props.composer ?? null}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            className="rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:bg-accent"
            onClick={() => fillPrompt(suggestion.prompt)}
          >
            <div className="truncate text-[13px] font-medium text-foreground">{suggestion.title}</div>
            <div className="mt-0.5 line-clamp-2 text-[12px] leading-[17px] text-muted-foreground">
              {suggestion.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
