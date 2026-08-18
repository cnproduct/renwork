/** @jsxImportSource react */
import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cloud,
  Copy,
  History,
  Layers,
  MoreHorizontal,
  Monitor,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
} from "lucide-react"
import { useNavigate, useSearchParams } from "react-router"
import type {
  AutomationDetail,
  AutomationRun,
  AutomationRunEvent,
  AutomationState,
  CreateAutomation,
} from "@openwork/types/automations"
import { AUTOMATION_FREE_MODEL } from "@openwork/types/automations"

import { createDenClient, DenApiError, readDenSettings } from "@/app/lib/den"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/sonner"
import { useDenAuth } from "@/react-app/domains/cloud/den-auth-provider"
import { useDesktopRestriction } from "@/react-app/domains/cloud/desktop-config-provider"
import { ConfirmModal } from "@/react-app/design-system/modals/confirm-modal"
import { AutomationEditor } from "./automation-editor"
import { dispatchAutomationsStateChanged } from "./automation-events"
import { automationExecutionThreadRoute, automationExecutionIdentity } from "./automation-cloud-thread"
import { formatAutomationSchedule, formatAutomationTime } from "./automation-format"
import type { AutomationProviderCatalog } from "./automation-model-options"
import { automationModelOptions, describeAutomationModel } from "./automation-model-options"

const ACTIVE_RUN_STATUSES = new Set<AutomationRun["status"]>(["queued", "claimed", "running"])

function stateLabel(state: AutomationState) {
  if (state === "active") return "运行中"
  if (state === "inactive") return "已暂停"
  if (state === "needs_attention") return "需关注"
  return state.slice(0, 1).toUpperCase() + state.slice(1)
}

function stateVariant(state: AutomationState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "active") return "default"
  if (state === "needs_attention") return "destructive"
  return state === "inactive" ? "secondary" : "outline"
}

function runVariant(status: AutomationRun["status"]): "default" | "secondary" | "destructive" | "outline" {
  if (status === "succeeded") return "default"
  if (status === "failed") return "destructive"
  if (ACTIVE_RUN_STATUSES.has(status)) return "secondary"
  return "outline"
}

function runLabel(run: AutomationRun) {
  if (run.status === "skipped" && run.error?.code === "runner_unavailable") {
    return "已错过 — 客户端未连接"
  }
  if (run.status === "skipped" && (run.error?.code === "model_access_lost" || run.error?.code === "provider_unavailable")) {
    return "已跳过 — 模型不可用"
  }
  if (run.status === "succeeded") return "执行成功"
  if (run.status === "failed") return "执行失败"
  if (run.status === "running") return "执行中"
  if (run.status === "queued") return "排队中"
  return run.status
}

function ExecutionIcon({ run }: { run: AutomationRun }) {
  return run.executionThread?.executionLocation === "desktop"
    ? <Monitor className="size-3" />
    : <Cloud className="size-3" />
}

function describeError(error: unknown) {
  if (error instanceof DenApiError) {
    if (error.status === 401 || error.status === 403) return "请登录对应组织以使用自动化功能。"
    if (error.status === 404) return "该自动化任务已不存在。"
    return error.message
  }
  return error instanceof Error ? error.message : "无法加载自动化任务。"
}

function inputFromDetail(detail: AutomationDetail): CreateAutomation {
  return {
    name: detail.automation.name,
    instructions: detail.revision.instructions,
    schedule: detail.revision.schedule,
    model: detail.revision.model,
    workspaceId: detail.revision.workspaceId ?? null,
    connectors: detail.revision.connectors ?? [],
    effectiveStartAt: detail.revision.effectiveStartAt ?? null,
    effectiveEndAt: detail.revision.effectiveEndAt ?? null,
    notifyMiniProgram: detail.revision.notifyMiniProgram ?? false,
  }
}

function eventSummary(event: AutomationRunEvent) {
  const payload = event.payload
  const preferred = ["message", "text", "summary", "name", "warning", "error"]
    .flatMap((key) => typeof payload[key] === "string" ? [payload[key]] : [])
    .at(0)
  if (preferred) return preferred
  const serialized = JSON.stringify(payload)
  return serialized === "{}" ? "无附加细节。" : serialized
}

function usageLabel(run: AutomationRun) {
  const input = run.usage.inputTokens === null ? "—" : run.usage.inputTokens.toLocaleString()
  const output = run.usage.outputTokens === null ? "—" : run.usage.outputTokens.toLocaleString()
  const cost = run.usage.costMicros === null ? "—" : `$${(run.usage.costMicros / 1_000_000).toFixed(4)}`
  return `${input} 输入 · ${output} 输出 · ${cost}`
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6" role="status" aria-label="加载自动化任务">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  )
}

export function AutomationsPage(props: { providerCatalog?: AutomationProviderCatalog } = {}) {
  const denAuth = useDenAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<"scheduled" | "runs">("scheduled")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState(false)
  const [repairingModel, setRepairingModel] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const settings = readDenSettings()
  const organizationId = settings.activeOrgId?.trim() || null
  const token = settings.authToken?.trim() || null
  const client = useMemo(
    () => token ? createDenClient({ baseUrl: settings.baseUrl, token }) : null,
    [settings.baseUrl, token],
  )
  const selectedId = searchParams.get("automation")?.trim() || null
  const selectedRunId = searchParams.get("run")?.trim() || null
  const selectedThreadId = searchParams.get("thread")?.trim() || null
  const creating = searchParams.get("create") === "1"
  const ready = denAuth.isSignedIn && Boolean(client && organizationId)
  const queryRoot = ["den", "automations", organizationId]
  const zenModelRestricted = useDesktopRestriction("allowZenModel")
  const freeStarterInRuntime = props.providerCatalog === undefined || Boolean(
    props.providerCatalog[AUTOMATION_FREE_MODEL.providerId]?.[AUTOMATION_FREE_MODEL.modelId],
  )

  const listQuery = useQuery({
    queryKey: [...queryRoot, "list"],
    queryFn: () => client!.listAutomations(organizationId!, { limit: 100 }),
    enabled: ready,
    refetchInterval: 15_000,
  })
  const providersQuery = useQuery({
    queryKey: [...queryRoot, "models"],
    queryFn: () => client!.listOrgLlmProviders(organizationId!),
    enabled: ready,
  })
  const detailQuery = useQuery({
    queryKey: [...queryRoot, "detail", selectedId],
    queryFn: () => client!.getAutomation(organizationId!, selectedId!),
    enabled: ready && Boolean(selectedId),
  })
  const runsQuery = useQuery({
    queryKey: [...queryRoot, "runs", selectedId],
    queryFn: () => client!.listAutomationRuns(organizationId!, selectedId!, { limit: 100 }),
    enabled: ready && Boolean(selectedId),
    refetchInterval: 5_000,
  })
  const receiptQuery = useQuery({
    queryKey: [...queryRoot, "receipt", selectedRunId],
    queryFn: () => client!.getAutomationRun(organizationId!, selectedRunId!),
    enabled: ready && Boolean(selectedRunId),
    refetchInterval: (queryState) => {
      const run = queryState.state.data?.run
      return run && ACTIVE_RUN_STATUSES.has(run.status) ? 3_000 : false
    },
  })

  const models = useMemo(
    () => automationModelOptions(providersQuery.data ?? [], {
      includeFreeStarter: !zenModelRestricted && freeStarterInRuntime,
    }),
    [freeStarterInRuntime, providersQuery.data, zenModelRestricted],
  )

  const allItems = useMemo(() => {
    return listQuery.data?.items.filter((item) => item.automation.state !== "archived") ?? []
  }, [listQuery.data])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return allItems
    return allItems.filter((item) => (
      item.automation.name.toLowerCase().includes(normalized)
      || item.revision.instructions.toLowerCase().includes(normalized)
    ))
  }, [allItems, query])

  const activeItems = useMemo(() => {
    return filteredItems.filter((item) => item.automation.state === "active" || item.automation.state === "needs_attention")
  }, [filteredItems])

  const pausedItems = useMemo(() => {
    return filteredItems.filter((item) => item.automation.state === "inactive")
  }, [filteredItems])

  const openAutomation = (automationId: string | null) => {
    const next = new URLSearchParams()
    if (automationId) next.set("automation", automationId)
    setSearchParams(next)
    setEditing(false)
    setRepairingModel(false)
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryRoot })
    dispatchAutomationsStateChanged()
  }

  const act = async (key: string, action: () => Promise<void>, success: string) => {
    setBusyAction(key)
    try {
      await action()
      await refresh()
      toast.success(success)
    } catch (error) {
      toast.error(describeError(error))
    } finally {
      setBusyAction(null)
    }
  }

  if (denAuth.status === "checking") return <LoadingState />
  if (!denAuth.isSignedIn) {
    return (
      <div className="mx-auto max-w-xl p-6 pt-16">
        <Alert variant="warning">
          <Cloud aria-hidden="true" />
          <AlertTitle>登录以开启自动化任务</AlertTitle>
          <AlertDescription>
            RenWork 定时调度引擎在客户端运行期间自动接管并执行每日、每周、每月及按间隔配置的周期事项。
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  if (!organizationId || !client) {
    return (
      <div className="mx-auto max-w-xl p-6 pt-16">
        <Alert variant="warning">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>请选择工作组织</AlertTitle>
          <AlertDescription>自动化任务归属于当前选定的工作组织与工作空间。</AlertDescription>
        </Alert>
      </div>
    )
  }
  if (listQuery.isLoading) return <LoadingState />
  if (listQuery.error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-6 pt-16 text-center" role="alert">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <h2 className="font-medium">自动化任务暂不可用</h2>
          <p className="mt-2 text-sm text-muted-foreground">{describeError(listQuery.error)}</p>
        </div>
        <Button variant="outline" onClick={() => void listQuery.refetch()}><RefreshCw className="size-4 mr-1" />重试</Button>
      </div>
    )
  }

  // View: Add Automation Task
  if (creating) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="返回列表" onClick={() => openAutomation(null)}>
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="text-base font-semibold text-foreground">⏰ 自动化 / 添加自动化任务</h2>
          </div>
        </div>
        <AutomationEditor
          busy={busyAction === "create"}
          modelOptions={models}
          providerCatalog={props.providerCatalog}
          submitLabel="保存并启用"
          onCancel={() => openAutomation(null)}
          onSave={async (input) => {
            setBusyAction("create")
            try {
              const detail = await client.createAutomation(organizationId, input)
              await refresh()
              openAutomation(detail.automation.id)
              toast.success("自动化任务已创建并就绪")
            } catch (error) {
              toast.error(describeError(error))
            } finally {
              setBusyAction(null)
            }
          }}
        />
      </div>
    )
  }

  // View: Detail / Edit of a Selected Task
  if (selectedId) {
    if (detailQuery.isLoading) return <LoadingState />
    if (detailQuery.error || !detailQuery.data) {
      return (
        <div className="mx-auto max-w-xl space-y-4 p-6 pt-16 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <p>{describeError(detailQuery.error)}</p>
          <Button variant="outline" onClick={() => openAutomation(null)}>返回自动化列表</Button>
        </div>
      )
    }
    const detail = detailQuery.data
    const task = detail.automation
    const modelNeedsAttention = task.needsAttentionReason?.code === "model_access_lost"
      || task.needsAttentionReason?.code === "provider_unavailable"
    const runs = runsQuery.data?.items ?? []
    const selectedReceipt = receiptQuery.data
    const threadMatches = !selectedThreadId || selectedReceipt?.run.executionThread?.id === selectedThreadId

    if (editing && (detail.revision.executionTarget ?? "desktop") === "desktop") {
      return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="返回详情" onClick={() => setEditing(false)}>
                <ArrowLeft className="size-4" />
              </Button>
              <h2 className="text-base font-semibold text-foreground">⏰ 自动化 / 编辑自动化任务</h2>
            </div>
          </div>
          <AutomationEditor
            initial={inputFromDetail(detail)}
            initialKey={detail.revision.id}
            busy={busyAction === "update"}
            openModelPickerOnMount={repairingModel}
            modelOptions={models}
            providerCatalog={props.providerCatalog}
            submitLabel="保存修改"
            onCancel={() => {
              setEditing(false)
              setRepairingModel(false)
            }}
            onSave={async (input) => {
              setBusyAction("update")
              try {
                await client.updateAutomation(organizationId, task.id, input)
                await refresh()
                setEditing(false)
                setRepairingModel(false)
                toast.success("自动化任务已更新")
              } catch (error) {
                toast.error(describeError(error))
              } finally {
                setBusyAction(null)
              }
            }}
          />
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="ghost" size="icon" aria-label="返回自动化列表" onClick={() => openAutomation(null)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold">{task.name}</h2>
                <Badge variant={stateVariant(task.state)}>{stateLabel(task.state)}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatAutomationSchedule(detail.revision.schedule)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(detail.revision.executionTarget ?? "desktop") === "desktop" ? (
              <Button variant="outline" className="rounded-lg" onClick={() => {
                setRepairingModel(false)
                setEditing(true)
              }}><Pencil className="size-4 mr-1" />编辑</Button>
            ) : null}
            {task.state === "active" ? (
              <Button
                variant="outline"
                className="rounded-lg"
                disabled={busyAction !== null}
                onClick={() => void act("deactivate", async () => {
                  await client.deactivateAutomation(organizationId, task.id)
                }, "已暂停该自动化任务")}
              >
                <Pause className="size-4 mr-1" />暂停
              </Button>
            ) : task.state === "inactive" ? (
              <Button
                variant="outline"
                className="rounded-lg"
                disabled={busyAction !== null}
                onClick={() => void act("activate", async () => {
                  await client.activateAutomation(organizationId, task.id)
                }, "自动化任务已激活")}
              >
                <Play className="size-4 mr-1" />启用
              </Button>
            ) : null}
            <Button
              className="rounded-lg"
              disabled={busyAction !== null || task.state === "archived" || task.state === "needs_attention"}
              onClick={() => void act("run", async () => {
                const run = await client.runAutomationNow(organizationId, task.id)
                const next = new URLSearchParams({ automation: task.id, run: run.id })
                setSearchParams(next)
              }, "任务已加入执行队列")}
            >
              <Play className="size-4 mr-1" />立即运行
            </Button>
            <Button variant="ghost" size="icon" aria-label="归档自动化任务" onClick={() => setArchiveOpen(true)}>
              <Archive className="size-4" />
            </Button>
          </div>
        </div>

        {task.needsAttentionReason ? (
          <Alert variant="warning" data-automation-model-attention={modelNeedsAttention || undefined}>
            {modelNeedsAttention ? <AlertTriangle /> : <AlertCircle />}
            <AlertTitle>{modelNeedsAttention ? "模型需要关注" : "需要人工处理"}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{task.needsAttentionReason.message}</p>
              {modelNeedsAttention && (detail.revision.executionTarget ?? "desktop") === "desktop" ? (
                <>
                  <p>该自动化任务已暂停。其提示词、触发频率与运行历史不受影响。</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRepairingModel(true)
                      setEditing(true)
                    }}
                  >
                    选择支持的模型
                  </Button>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-5">
            <Card variant="outline" className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">任务提示词与指令</CardTitle>
                <CardDescription>版本 v{detail.revision.version}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{detail.revision.instructions}</p>
              </CardContent>
            </Card>

            <Card variant="outline" className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">运行环境与配置</CardTitle>
                <CardDescription>客户端在后台自动触发与接管调度</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="min-w-0"><span className="text-xs text-muted-foreground">模型</span><p className="break-words font-medium">{describeAutomationModel(detail.revision.model, models)}</p></div>
                <div className="min-w-0"><span className="text-xs text-muted-foreground">下次计划时间</span><p className="break-words font-medium">{task.state === "needs_attention" ? "暂无计划" : formatAutomationTime(task.nextDueAt)}</p></div>
                <div className="min-w-0"><span className="text-xs text-muted-foreground">最长运行限制</span><p className="break-words font-medium">{Math.round(detail.revision.maximumRuntimeMs / 60_000)} 分钟</p></div>
                <div className="min-w-0"><span className="text-xs text-muted-foreground">关联连接器</span><p className="break-words font-medium">已授权免密执行</p></div>
              </CardContent>
            </Card>

            <Card variant="outline" className="rounded-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold"><History className="size-4" />运行历史</CardTitle>
                <CardDescription>记录定时与手动触发的运行详情。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {runsQuery.isLoading ? <Skeleton className="h-24 rounded-xl" /> : null}
                {!runsQuery.isLoading && runs.length === 0 ? <p className="text-sm text-muted-foreground">暂无运行记录。</p> : null}
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted/30"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={runVariant(run.status)}>{runLabel(run)}</Badge>
                        <span className="text-xs text-muted-foreground">{run.trigger === "scheduled" ? "定时触发" : run.trigger === "manual" ? "手动触发" : "补偿触发"}</span>
                        {run.executionThread ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ExecutionIcon run={run} />{automationExecutionIdentity(run.executionThread).label}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{formatAutomationTime(run.startedAt ?? run.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {!ACTIVE_RUN_STATUSES.has(run.status) ? <span className="text-xs text-muted-foreground">{usageLabel(run)}</span> : null}
                      {ACTIVE_RUN_STATUSES.has(run.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyAction !== null}
                          onClick={() => void act(`cancel:${run.id}`, async () => {
                            await client.cancelAutomationRun(organizationId, run.id)
                          }, "已请求取消任务")}
                        >取消</Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (run.executionThread) navigate(automationExecutionThreadRoute(run.executionThread))
                          else setSearchParams(new URLSearchParams({ automation: task.id, run: run.id }))
                        }}
                      >查看详情</Button>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card variant="outline" className="h-fit rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Monitor className="size-4" />执行链路详情</CardTitle>
              <CardDescription>{selectedRunId ? "运行回执与事件时间线" : "点击运行记录查看链路详情。"}</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedRunId ? (
                <div className="py-10 text-center text-sm text-muted-foreground">未选择任何运行记录。</div>
              ) : receiptQuery.isLoading ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : receiptQuery.error || !selectedReceipt ? (
                <Alert variant="warning"><AlertCircle /><AlertDescription>{describeError(receiptQuery.error)}</AlertDescription></Alert>
              ) : !threadMatches ? (
                <Alert variant="warning"><AlertCircle /><AlertDescription>该线程与当前选定的运行记录不匹配。</AlertDescription></Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={runVariant(selectedReceipt.run.status)}>{runLabel(selectedReceipt.run)}</Badge>
                  </div>
                  {selectedReceipt.run.error ? (
                    <Alert variant="destructive"><AlertCircle /><AlertTitle>{selectedReceipt.run.error.code}</AlertTitle><AlertDescription>{selectedReceipt.run.error.message}</AlertDescription></Alert>
                  ) : null}
                  {selectedReceipt.run.resultSummary ? (
                    <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">结果摘要</p><p className="mt-1 whitespace-pre-wrap text-sm">{selectedReceipt.run.resultSummary}</p></div>
                  ) : null}
                  <div className="text-xs text-muted-foreground">{usageLabel(selectedReceipt.run)}</div>
                  <ol className="space-y-3 border-s border-border ps-4">
                    {selectedReceipt.events.map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -start-[1.2rem] top-1.5 size-2 rounded-full bg-muted-foreground" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{event.type.replaceAll("_", " ")}</span>
                          <time className="text-xs text-muted-foreground">{formatAutomationTime(event.createdAt)}</time>
                        </div>
                        <p className="mt-1 break-words text-xs text-muted-foreground">{eventSummary(event)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ConfirmModal
          open={archiveOpen}
          variant="danger"
          title="归档自动化任务？"
          message="归档后将停止后续所有计划运行，但历史记录仍将保留。"
          confirmLabel="确认归档"
          cancelLabel="取消"
          onCancel={() => setArchiveOpen(false)}
          onConfirm={() => {
            setArchiveOpen(false)
            void act("archive", async () => {
              await client.archiveAutomation(organizationId, task.id)
              openAutomation(null)
            }, "任务已归档")
          }}
        />
      </div>
    )
  }

  // Main View: Tasks List (Matching Reference Image 1)
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Bar with Tabs and Actions */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        {/* Tabs: 定时任务 / 运行记录 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "scheduled"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("scheduled")}
          >
            <Clock className="size-3.5" />
            <span>定时任务</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "runs"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            onClick={() => setActiveTab("runs")}
          >
            <History className="size-3.5" />
            <span>运行记录</span>
          </button>
        </div>

        {/* Right Actions: Search, Batch Manage, From Template, + Add Automation */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              className="h-8 rounded-lg bg-muted/40 pl-8 text-xs focus:bg-background"
              value={query}
              placeholder="搜索自动化/记录"
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg text-xs font-normal"
            onClick={() => toast.info("批量管理模式已就绪")}
          >
            <Layers className="size-3.5" />
            <span>批量管理</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg text-xs font-normal"
            onClick={() => {
              toast.info("已加载外贸常用模板：B2B选品雷达、RFQ监控、社媒矩阵自动发布")
              setSearchParams(new URLSearchParams({ create: "1" }))
            }}
          >
            <Copy className="size-3.5" />
            <span>从模版添加</span>
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => setSearchParams(new URLSearchParams({ create: "1" }))}
          >
            <Plus className="size-3.5" />
            <span>添加自动化</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 ? (
          <Empty className="my-12">
            <EmptyHeader>
              <EmptyMedia variant="icon"><CalendarClock className="size-10 text-muted-foreground/60" /></EmptyMedia>
              <EmptyTitle>{query ? "未找到匹配的自动化任务" : "暂无自动化任务"}</EmptyTitle>
              <EmptyDescription>
                {query ? "请尝试其他搜索词。" : "您可以点击右上角「+ 添加自动化」，或在对话中直接安排每日、每周、每月重复事项，系统将自动同步至此处。"}
              </EmptyDescription>
            </EmptyHeader>
            {!query ? (
              <EmptyContent>
                <Button onClick={() => setSearchParams(new URLSearchParams({ create: "1" }))}>
                  <Plus className="size-4 mr-1" />添加首个自动化任务
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Active Group: 当前 */}
            {activeItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground px-1">当前 ({activeItems.length})</div>
                <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                  {activeItems.map((item) => {
                    const isOverdue = item.automation.nextDueAt && item.automation.nextDueAt < Date.now()
                    return (
                      <div
                        key={item.automation.id}
                        className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                      >
                        {/* Left: Icon, Title, Tag, Frequency */}
                        <div
                          className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
                          onClick={() => openAutomation(item.automation.id)}
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <Clock className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                                {item.automation.name}
                              </h3>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {item.revision.model.modelId.length > 18 ? item.revision.model.modelId.slice(0, 16) + "..." : item.revision.model.modelId}
                              </span>
                              <span>{formatAutomationSchedule(item.revision.schedule)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Status Tag, Edit, Menu */}
                        <div className="flex items-center gap-3 shrink-0">
                          {isOverdue ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                              已错过计划时间，将补跑一次
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              就绪 · 下次 {formatAutomationTime(item.automation.nextDueAt)}
                            </span>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              openAutomation(item.automation.id)
                              setEditing(true)
                            }}
                          >
                            编辑
                          </Button>

                          <div className="relative">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setActiveMenuId(activeMenuId === item.automation.id ? null : item.automation.id)}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>

                            {activeMenuId === item.automation.id && (
                              <div
                                className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-border bg-popover p-1 shadow-lg"
                                onMouseLeave={() => setActiveMenuId(null)}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    void act("run", async () => {
                                      await client!.runAutomationNow(organizationId!, item.automation.id)
                                    }, "任务已立即加入执行队列")
                                  }}
                                >
                                  <Play className="size-3.5" />
                                  <span>立即运行</span>
                                </button>

                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    void act("deactivate", async () => {
                                      await client!.deactivateAutomation(organizationId!, item.automation.id)
                                    }, "已暂停任务")
                                  }}
                                >
                                  <Pause className="size-3.5" />
                                  <span>暂停任务</span>
                                </button>

                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setActiveMenuId(null)
                                    void act("archive", async () => {
                                      await client!.archiveAutomation(organizationId!, item.automation.id)
                                    }, "任务已删除归档")
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>删除</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Paused Group: 已暂停 */}
            {pausedItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground px-1">已暂停 ({pausedItems.length})</div>
                <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                  {pausedItems.map((item) => (
                    <div
                      key={item.automation.id}
                      className="group flex items-center justify-between p-4 opacity-75 transition-opacity hover:opacity-100 hover:bg-muted/30"
                    >
                      {/* Left */}
                      <div
                        className="flex items-center gap-3.5 cursor-pointer min-w-0 flex-1"
                        onClick={() => openAutomation(item.automation.id)}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Pause className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-muted-foreground">
                            {item.automation.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/80">
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                              {item.revision.model.modelId.length > 18 ? item.revision.model.modelId.slice(0, 16) + "..." : item.revision.model.modelId}
                            </span>
                            <span>{formatAutomationSchedule(item.revision.schedule)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          已暂停
                        </span>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            openAutomation(item.automation.id)
                            setEditing(true)
                          }}
                        >
                          编辑
                        </Button>

                        <div className="relative">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setActiveMenuId(activeMenuId === item.automation.id ? null : item.automation.id)}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>

                          {activeMenuId === item.automation.id && (
                            <div
                              className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-border bg-popover p-1 shadow-lg"
                              onMouseLeave={() => setActiveMenuId(null)}
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  void act("activate", async () => {
                                    await client!.activateAutomation(organizationId!, item.automation.id)
                                  }, "任务已重新启用")
                                }}
                              >
                                <Play className="size-3.5" />
                                <span>重新启用</span>
                              </button>

                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setActiveMenuId(null)
                                  void act("archive", async () => {
                                    await client!.archiveAutomation(organizationId!, item.automation.id)
                                  }, "任务已删除")
                                }}
                              >
                                <Trash2 className="size-3.5" />
                                <span>删除</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
