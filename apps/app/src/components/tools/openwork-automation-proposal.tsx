"use client"

import { useState } from "react"
import { AlertTriangle, CalendarClock, Check, ExternalLink, Sparkles } from "lucide-react"
import type { DynamicToolUIPart } from "ai"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { automationProposalSchema, AUTOMATION_FREE_MODEL, type AutomationProposal } from "@openwork/types/automations"

import { createDenClient, readDenSettings } from "@/app/lib/den"
import { Button } from "@/components/ui/button"
import { Tool } from "@/components/ui/tool"
import { useDenAuth } from "@/react-app/domains/cloud/den-auth-provider"
import { formatAutomationSchedule } from "@/react-app/domains/automations/automation-format"
import {
  automationModelOptions,
  describeAutomationModel,
  resolveProposalModel,
} from "@/react-app/domains/automations/automation-model-options"
import { automationsRoute } from "@/react-app/shell/workspace-routes"

function parseOutputValue(output: unknown): unknown {
  if (typeof output !== "string") return output
  try {
    return JSON.parse(output)
  } catch {
    return null
  }
}

/**
 * Reads an `automation.propose` affordance result out of a renwork_execute
 * tool part. Returns null for every other affordance so the generic capability
 * line keeps rendering them.
 */
export function parseAutomationProposal(output: unknown): AutomationProposal | null {
  const envelope = parseOutputValue(output)
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) return null
  const record = envelope as Record<string, unknown>
  if (record.ok !== true || record.id !== "automation.propose") return null
  const result = record.result
  if (result === null || typeof result !== "object" || Array.isArray(result)) return null
  const parsed = automationProposalSchema.safeParse((result as Record<string, unknown>).proposal)
  return parsed.success ? parsed.data : null
}

export function isAutomationProposalToolPart(part: DynamicToolUIPart): boolean {
  return (part.toolName === "renwork_execute" || part.toolName === "openwork_execute")
    && part.state === "output-available"
    && parseAutomationProposal(part.output) !== null
}

export function OpenWorkAutomationProposalTool({ part }: { part: DynamicToolUIPart }) {
  const navigate = useNavigate()
  const denAuth = useDenAuth()
  const [created, setCreated] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const proposal = part.state === "output-available" ? parseAutomationProposal(part.output) : null
  const settings = readDenSettings()
  const token = settings.authToken?.trim() ?? ""
  const organizationId = settings.activeOrgId?.trim() ?? ""
  const signedIn = denAuth.isSignedIn && Boolean(token) && Boolean(organizationId)
  const providersQuery = useQuery({
    queryKey: ["den", "automations", organizationId, "models"],
    queryFn: () => createDenClient({ baseUrl: settings.baseUrl, token }).listOrgLlmProviders(organizationId),
    enabled: signedIn && !created,
  })
  const providers = providersQuery.data ?? []
  const resolved = providersQuery.isError || providersQuery.data === undefined || !proposal
    ? null
    : resolveProposalModel(proposal.model, providers)
  const modelLabel = resolved
    ? describeAutomationModel(resolved.model, automationModelOptions(providers))
    : null

  if (!proposal) {
    return <Tool toolPart={part} title="提出了定时任务建议" />
  }

  const blocker = !signedIn
    ? "请先登录以创建并激活该自动化任务。"
    : null

  const create = async () => {
    setBusy(true)
    try {
      const client = createDenClient({ baseUrl: settings.baseUrl, token })
      const detail = await client.createAutomation(organizationId, {
        name: proposal.name,
        instructions: proposal.instructions,
        schedule: proposal.schedule,
        model: resolved?.model ?? proposal.model ?? {
          providerId: AUTOMATION_FREE_MODEL.providerId,
          modelId: AUTOMATION_FREE_MODEL.modelId,
        },
        workspaceId: proposal.workspaceId ?? null,
        connectors: proposal.connectors ?? [],
        effectiveStartAt: proposal.effectiveStartAt ?? null,
        effectiveEndAt: proposal.effectiveEndAt ?? null,
        notifyMiniProgram: proposal.notifyMiniProgram ?? true,
      })
      setCreated(detail.automation.id)
      toast.success("自动化任务已成功创建并在定时任务列表中就绪！")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法创建自动化任务")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="not-prose my-3 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-openwork-automation-proposal
      data-automation-created={created ?? undefined}
      data-automation-model-resolution={resolved?.resolution}
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className={created
          ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        }>
          {created ? <Check className="size-4" /> : <Sparkles className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {created ? "定时任务已创建并激活" : "💡 AI 识别到定时事项建议"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {created
              ? "已自动登记至「自动化 / 定时任务」列表，客户端将按计划周期自动执行。"
              : "您在对话中描述了周期性任务，确认后可直接同步至自动化管理面板。"}
          </p>
        </div>
      </div>

      {/* Body / Info */}
      <div className="space-y-3 px-4 py-3">
        <div className="rounded-xl border border-border/80 bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground" title={proposal.name}>{proposal.name}</p>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {formatAutomationSchedule(proposal.schedule)}
            </span>
          </div>
          {modelLabel && (
            <p className="mt-1 text-xs text-muted-foreground">执行模型：{modelLabel}</p>
          )}
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">执行指令与提示词：</span>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground">{proposal.instructions}</p>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/10 px-4 py-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {blocker ?? "任务将在客户端运行期间按计划执行"}
        </p>
        {created ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1 rounded-xl text-xs"
            data-open-automation={created}
            onClick={() => navigate(automationsRoute())}
          >
            <span>前往定时任务列表</span>
            <ExternalLink className="size-3" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => navigate(automationsRoute())}
            >
              在自动化中配置
            </Button>
            <Button
              type="button"
              size="sm"
              className="shrink-0 rounded-xl bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90"
              disabled={busy || blocker !== null || (signedIn && providersQuery.isLoading)}
              data-create-automation
              onClick={() => void create()}
            >
              {busy ? "创建中…" : "一键创建并启用"}
            </Button>
          </div>
        )}
      </div>

      {blocker && !created ? (
        <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{blocker}</span>
        </div>
      ) : null}
    </div>
  )
}
