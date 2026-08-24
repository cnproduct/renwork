/** @jsxImportSource react */
import React, { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  Copy,
  Cpu,
  FileText,
  Globe,
  History,
  Layers,
  Loader2,
  Mail,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Ship,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react"
import { useSearchParams } from "react-router"

import type { OpenworkServerClient, LocalAutomationTask, LocalAutomationRunLog } from "@/app/lib/openwork-server"
import { useDenAuth } from "@/react-app/domains/cloud/den-auth-provider"
import { readDenSettings, createDenClient } from "@/app/lib/den"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { dispatchAutomationsStateChanged } from "./automation-events"
import type { AutomationProviderCatalog } from "./automation-model-options"

export type AutomationsPageProps = {
  providerCatalog?: AutomationProviderCatalog
  openworkClient?: OpenworkServerClient | null
}

const CATEGORY_MAP: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  leadgen: { label: "采购商拓客", icon: Globe, color: "text-blue-500 bg-blue-500/10" },
  social: { label: "社媒矩阵运营", icon: Share2, color: "text-purple-500 bg-purple-500/10" },
  customs: { label: "海关异动监控", icon: Ship, color: "text-emerald-500 bg-emerald-500/10" },
  nurture: { label: "客户复购唤醒", icon: Mail, color: "text-amber-500 bg-amber-500/10" },
  market: { label: "行业竞品情报", icon: TrendingUp, color: "text-rose-500 bg-rose-500/10" },
  custom: { label: "自定义工作流", icon: Sparkles, color: "text-primary bg-primary/10" },
}

const WEEKDAYS = [
  { id: 1, label: "周一" },
  { id: 2, label: "周二" },
  { id: 3, label: "周三" },
  { id: 4, label: "周四" },
  { id: 5, label: "周五" },
  { id: 6, label: "周六" },
  { id: 0, label: "周日" },
]

function formatScheduleText(schedule: LocalAutomationTask["schedule"]): string {
  if (!schedule) return "未设置周期"
  const timeStr = `${String(schedule.hour ?? 9).padStart(2, "0")}:${String(schedule.minute ?? 0).padStart(2, "0")}`
  if (schedule.kind === "daily") {
    return `每天 ${timeStr}`
  }
  if (schedule.kind === "weekly") {
    const days = (schedule.daysOfWeek ?? [1])
      .map((d) => WEEKDAYS.find((w) => w.id === d)?.label || `周${d}`)
      .join("、")
    return `每周 (${days}) ${timeStr}`
  }
  if (schedule.kind === "interval") {
    const mins = schedule.intervalMinutes ?? 60
    if (mins >= 60) return `每 ${Math.round(mins / 60)} 小时`
    return `每 ${mins} 分钟`
  }
  if (schedule.kind === "once") {
    if (schedule.at) {
      return `单次：${new Date(schedule.at).toLocaleString()}`
    }
    return "单次执行"
  }
  return "自定义周期"
}

function formatRelativeTime(timestampMs?: number): string {
  if (!timestampMs) return "—"
  const diff = timestampMs - Date.now()
  if (diff < 0) {
    const past = Math.abs(diff)
    if (past < 60_000) return "刚刚"
    if (past < 3600_000) return `${Math.floor(past / 60_000)} 分钟前`
    if (past < 86400_000) return `${Math.floor(past / 3600_000)} 小时前`
    return new Date(timestampMs).toLocaleDateString()
  }
  if (diff < 60_000) return "不到 1 分钟后"
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟后`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时后`
  return `${Math.floor(diff / 86400_000)} 天后`
}

export function AutomationsPage(props: AutomationsPageProps) {
  const { openworkClient } = props
  const denAuth = useDenAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeEngineTab, setActiveEngineTab] = useState<"local" | "cloud">("local")
  const [searchQuery, setSearchQuery] = useState("")

  // Edit / Add modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorFullscreen, setEditorFullscreen] = useState(false)
  const [editingTask, setEditingTask] = useState<LocalAutomationTask | null>(null)

  // Form states
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formCategory, setFormCategory] = useState<LocalAutomationTask["category"]>("custom")
  const [formInstructions, setFormInstructions] = useState("")
  const [formScheduleKind, setFormScheduleKind] = useState<"daily" | "weekly" | "interval" | "once">("daily")
  const [formHour, setFormHour] = useState(9)
  const [formMinute, setFormMinute] = useState(30)
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1])
  const [formIntervalMinutes, setFormIntervalMinutes] = useState(60)
  const [formProviderId, setFormProviderId] = useState("openrouter_custom")
  const [formModelId, setFormModelId] = useState("stealth/ox-alpha")

  // Log viewer modal state
  const [logsModalOpen, setLogsModalOpen] = useState(false)
  const [selectedTaskForLogs, setSelectedTaskForLogs] = useState<LocalAutomationTask | null>(null)

  // Running tasks state
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)

  // Fetch local automations
  const { data: localData, isLoading: isLoadingLocal, refetch: refetchLocal } = useQuery({
    queryKey: ["local-automations"],
    queryFn: async () => {
      if (!openworkClient) return { automations: [], totalRuns: 0, schedulerActive: true }
      return openworkClient.listLocalAutomations()
    },
    enabled: Boolean(openworkClient),
    refetchInterval: 10_000,
  })

  // Fetch local automation runs
  const { data: runsData, refetch: refetchRuns } = useQuery({
    queryKey: ["local-automation-runs", selectedTaskForLogs?.id],
    queryFn: async () => {
      if (!openworkClient) return { runs: [] }
      return openworkClient.listLocalAutomationRuns(50, selectedTaskForLogs?.id)
    },
    enabled: Boolean(openworkClient) && logsModalOpen,
  })

  // Fetch custom providers for model picker
  const { data: customProvidersData } = useQuery({
    queryKey: ["custom-providers"],
    queryFn: async () => {
      if (!openworkClient) return { providers: [] }
      return openworkClient.listCustomProviders()
    },
    enabled: Boolean(openworkClient),
  })

  const automations = localData?.automations ?? []
  const runs = runsData?.runs ?? []

  const activeCount = automations.filter((t) => t.enabled).length
  const totalRuns = localData?.totalRuns ?? 0

  const earliestNextRun = useMemo(() => {
    const enabledWithNext = automations.filter((t) => t.enabled && t.nextRunAt && t.nextRunAt > Date.now())
    if (enabledWithNext.length === 0) return null
    enabledWithNext.sort((a, b) => (a.nextRunAt! - b.nextRunAt!))
    return enabledWithNext[0]
  }, [automations])

  const filteredAutomations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return automations
    return automations.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.instructions.toLowerCase().includes(q),
    )
  }, [automations, searchQuery])

  const openCreateModal = () => {
    setEditingTask(null)
    setFormName("新自动化工作流")
    setFormDescription("")
    setFormCategory("custom")
    setFormInstructions("执行以下自动化外贸任务：\n1. 检索最新买家信息与商机；\n2. 清洗并整理为结构化报告输出至工作区。")
    setFormScheduleKind("daily")
    setFormHour(9)
    setFormMinute(30)
    setFormDaysOfWeek([1])
    setFormIntervalMinutes(60)
    setFormProviderId("openrouter_custom")
    setFormModelId("stealth/ox-alpha")
    setEditorOpen(true)
  }

  const openEditModal = (task: LocalAutomationTask) => {
    setEditingTask(task)
    setFormName(task.name)
    setFormDescription(task.description || "")
    setFormCategory(task.category || "custom")
    setFormInstructions(task.instructions)
    setFormScheduleKind(task.schedule.kind)
    setFormHour(task.schedule.hour ?? 9)
    setFormMinute(task.schedule.minute ?? 30)
    setFormDaysOfWeek(task.schedule.daysOfWeek ?? [1])
    setFormIntervalMinutes(task.schedule.intervalMinutes ?? 60)
    setFormProviderId(task.model?.providerId || "openrouter_custom")
    setFormModelId(task.model?.modelId || "stealth/ox-alpha")
    setEditorOpen(true)
  }

  const handleSaveTask = async () => {
    if (!openworkClient) return
    if (!formName.trim()) {
      toast.error("请输入任务名称")
      return
    }
    if (!formInstructions.trim()) {
      toast.error("请输入 AI 任务指令与提示词")
      return
    }

    try {
      await openworkClient.saveLocalAutomation({
        id: editingTask?.id,
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        instructions: formInstructions.trim(),
        schedule: {
          kind: formScheduleKind,
          hour: formHour,
          minute: formMinute,
          daysOfWeek: formDaysOfWeek,
          intervalMinutes: formIntervalMinutes,
          timezone: "Asia/Shanghai",
        },
        model: {
          providerId: formFormProviderId(formProviderId),
          modelId: formModelId.trim(),
        },
        enabled: editingTask ? editingTask.enabled : true,
      })

      toast.success(`自动化任务「${formName}」已保存并就绪`)
      setEditorOpen(false)
      await refetchLocal()
      dispatchAutomationsStateChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存任务失败")
    }
  }

  const formFormProviderId = (id: string) => {
    return id.trim() || "openrouter_custom"
  }

  const handleToggleTask = async (task: LocalAutomationTask) => {
    if (!openworkClient) return
    const nextState = !task.enabled
    try {
      await openworkClient.toggleLocalAutomation(task.id, nextState)
      toast.success(`已${nextState ? "启用" : "暂停"}自动化任务「${task.name}」`)
      await refetchLocal()
      dispatchAutomationsStateChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "状态切换失败")
    }
  }

  const handleDeleteTask = async (task: LocalAutomationTask) => {
    if (!openworkClient) return
    try {
      await openworkClient.deleteLocalAutomation(task.id)
      toast.success(`已删除任务「${task.name}」`)
      await refetchLocal()
      dispatchAutomationsStateChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败")
    }
  }

  const handleRunNow = async (task: LocalAutomationTask) => {
    if (!openworkClient) return
    setRunningTaskId(task.id)
    toast.info(`正在触发执行「${task.name}」...`)
    try {
      const res = await openworkClient.runLocalAutomationNow(task.id)
      if (res.ok) {
        toast.success(`「${task.name}」执行完成！`)
      } else {
        toast.error(`执行失败: ${res.error || "未知异常"}`)
      }
      await refetchLocal()
      dispatchAutomationsStateChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "触发执行异常")
    } finally {
      setRunningTaskId(null)
    }
  }

  const handleImportPresets = async () => {
    if (!openworkClient) return
    try {
      const res = await openworkClient.importLocalAutomationPresets()
      toast.success(`成功导入 ${res.imported} 个外贸获客自动化场景！`)
      await refetchLocal()
      dispatchAutomationsStateChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入预设失败")
    }
  }

  const openLogsViewer = (task?: LocalAutomationTask) => {
    setSelectedTaskForLogs(task || null)
    setLogsModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* =================== Top Header & Engine Status =================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="size-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">RenWork 本地自动化调度中心</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                本地调度引擎运行中
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-11">
              本地全天候自动化执行外贸拓客、社媒排期运营、海关异动监控与客户唤醒工作流（支持 Ollama / OpenRouter / OpenAI API）
            </p>
          </div>

          <div className="flex items-center gap-2 pl-11 sm:pl-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportPresets}
              className="h-9 gap-1.5 text-xs font-medium text-primary border-primary/30 hover:bg-primary/10"
            >
              <Zap className="size-3.5" />
              一键导入外贸获客预设
            </Button>
            <Button size="sm" onClick={openCreateModal} className="h-9 gap-1.5 text-xs font-medium">
              <Plus className="size-3.5" />
              新建自动化任务
            </Button>
          </div>
        </div>

        {/* =================== Quick Stats Grid =================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-2xl border-border bg-card/60 shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">运行中任务</CardDescription>
              <CardTitle className="text-2xl font-bold flex items-center justify-between">
                <span>{activeCount} <span className="text-xs text-muted-foreground font-normal">/ {automations.length} 总任务</span></span>
                <Bot className="size-5 text-primary/60" />
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl border-border bg-card/60 shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">累计执行次数</CardDescription>
              <CardTitle className="text-2xl font-bold flex items-center justify-between">
                <span>{totalRuns} <span className="text-xs text-muted-foreground font-normal">次</span></span>
                <History className="size-5 text-emerald-500/60" />
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl border-border bg-card/60 shadow-none">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">最近下次执行</CardDescription>
              <CardTitle className="text-sm font-semibold flex items-center justify-between truncate">
                <span className="truncate">
                  {earliestNextRun ? (
                    <>
                      {earliestNextRun.name}
                      <span className="text-xs text-muted-foreground block font-normal mt-0.5">
                        {formatRelativeTime(earliestNextRun.nextRunAt)} ({formatScheduleText(earliestNextRun.schedule)})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs font-normal">暂无待执行计划</span>
                  )}
                </span>
                <Clock className="size-5 text-blue-500/60 shrink-0" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* =================== Action Bar / Search =================== */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索自动化任务名称、指令或分类..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openLogsViewer()} className="h-9 gap-1.5 text-xs">
              <History className="size-3.5 text-muted-foreground" />
              全局运行日志
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refetchLocal()}
              className="size-9 rounded-xl"
              title="刷新列表"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* =================== Task List / Empty Presets =================== */}
        {isLoadingLocal ? (
          <div className="flex h-60 items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" /> 加载自动化任务列表...
          </div>
        ) : automations.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-8 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-2">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-base font-semibold">快速开启外贸自动化工作流</h3>
              <p className="text-xs text-muted-foreground">
                RenWork 本地调度引擎可在后台按设定周期自主调度 AI 智能体，自动完成获客拓客、社媒营销与存量跟进。
              </p>
              <div className="pt-2">
                <Button onClick={handleImportPresets} className="gap-2 text-xs">
                  <Zap className="size-4" /> 一键导入 5 大外贸专属自动化预设
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredAutomations.map((task) => {
              const cat = CATEGORY_MAP[task.category || "custom"] || CATEGORY_MAP.custom!
              const CatIcon = cat.icon
              const isRunning = runningTaskId === task.id || task.lastRunStatus === "running"

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border p-4.5 bg-card transition-all hover:border-primary/40 hover:shadow-sm",
                    !task.enabled && "opacity-70 bg-card/60",
                  )}
                >
                  {/* Left info */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5", cat.color)}>
                      <CatIcon className="size-5" />
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{task.name}</span>
                        <Badge variant="outline" className="text-[10px] font-normal px-2 py-0">
                          {cat.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0 gap-1">
                          <Clock className="size-2.5" />
                          {formatScheduleText(task.schedule)}
                        </Badge>
                        {task.model?.modelId ? (
                          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0 text-muted-foreground gap-1">
                            <Cpu className="size-2.5" />
                            {task.model.modelId}
                          </Badge>
                        ) : null}
                      </div>

                      {task.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                      ) : null}

                      {/* Runtime metadata line */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                        <span>
                          下次执行：
                          {task.enabled ? (
                            <strong className="text-foreground font-medium ml-1">
                              {task.nextRunAt ? `${new Date(task.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${formatRelativeTime(task.nextRunAt)})` : "等待排期"}
                            </strong>
                          ) : (
                            <span className="text-muted-foreground/80 ml-1">已暂停</span>
                          )}
                        </span>

                        {task.lastRunAt ? (
                          <span>
                            上次执行：{formatRelativeTime(task.lastRunAt)}
                            {task.lastRunStatus === "succeeded" ? (
                              <span className="text-emerald-600 font-medium ml-1">成功 ({task.lastRunDurationMs ? `${(task.lastRunDurationMs / 1000).toFixed(1)}s` : "完成"})</span>
                            ) : task.lastRunStatus === "failed" ? (
                              <span className="text-destructive font-medium ml-1">失败 ({task.lastRunError?.slice(0, 30)})</span>
                            ) : (
                              <span className="text-blue-500 font-medium ml-1">执行中...</span>
                            )}
                          </span>
                        ) : (
                          <span>尚未执行过</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRunNow(task)}
                      disabled={isRunning || !task.enabled}
                      className="h-8 text-xs gap-1 font-medium border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      立即执行
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggleTask(task)}
                      className={cn("h-8 text-xs gap-1", task.enabled ? "text-amber-600 hover:text-amber-700 hover:bg-amber-500/10" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10")}
                    >
                      {task.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      {task.enabled ? "暂停" : "启用"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openLogsViewer(task)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <History className="size-3.5" />
                      日志
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(task)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      编辑
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDeleteTask(task)}
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* =================== Task Editor Dialog =================== */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex flex-col p-0 gap-0 overflow-hidden bg-background transition-all",
            editorFullscreen
              ? "!fixed !inset-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !z-50 !border-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !transform-none"
              : "!w-[92vw] lg:!w-[88vw] !max-w-5xl lg:!max-w-5xl !h-[86vh] rounded-2xl border border-border shadow-2xl",
          )}
        >
          {/* Header */}
          <DialogHeader className="shrink-0 px-6 py-4 border-b border-border bg-card/80 backdrop-blur flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {editingTask ? "编辑本地自动化任务" : "创建本地自动化工作流"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  配置周期性触发规则、执行模型与 AI 工作流指令
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setEditorFullscreen(!editorFullscreen)}
              >
                {editorFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setEditorOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-background">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Basic Info & Schedule */}
              <div className="lg:col-span-5 space-y-4 rounded-2xl border border-border bg-card p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. 任务基本信息与调度周期
                </h4>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">任务名称</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如: 每日欧美采购商自动化拓客"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">业务分类</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as LocalAutomationTask["category"])}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="leadgen">🌐 采购商拓客 (Lead Generation)</option>
                    <option value="social">📱 社媒矩阵运营 (Social Media)</option>
                    <option value="customs">🚢 海关数据监控 (Customs Signals)</option>
                    <option value="nurture">💌 客户复购唤醒 (Customer Nurture)</option>
                    <option value="market">📊 行业竞品情报 (Market Brief)</option>
                    <option value="custom">⚙️ 自定义工作流 (Custom)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">任务简要描述 (可选)</Label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="简述任务用途或产出物料..."
                    className="h-9 text-xs"
                  />
                </div>

                <div className="pt-2 space-y-3 border-t border-border">
                  <Label className="text-xs font-medium">调度周期类型</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "daily", label: "每天定时" },
                      { id: "weekly", label: "每周定时" },
                      { id: "interval", label: "固定间隔" },
                      { id: "once", label: "单次执行" },
                    ].map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setFormScheduleKind(k.id as any)}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center",
                          formScheduleKind === k.id
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background border-border hover:bg-muted text-muted-foreground",
                        )}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>

                  {formScheduleKind === "daily" || formScheduleKind === "weekly" ? (
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-medium">执行时间 (24小时制)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={formHour}
                          onChange={(e) => setFormHour(Number(e.target.value))}
                          className="h-9 text-xs text-center font-mono"
                        />
                        <span>:</span>
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          value={formMinute}
                          onChange={(e) => setFormMinute(Number(e.target.value))}
                          className="h-9 text-xs text-center font-mono"
                        />
                      </div>
                    </div>
                  ) : null}

                  {formScheduleKind === "weekly" ? (
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-medium">重复星期</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((w) => {
                          const active = formDaysOfWeek.includes(w.id)
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => {
                                if (active) {
                                  if (formDaysOfWeek.length > 1) {
                                    setFormDaysOfWeek(formDaysOfWeek.filter((d) => d !== w.id))
                                  }
                                } else {
                                  setFormDaysOfWeek([...formDaysOfWeek, w.id])
                                }
                              }}
                              className={cn(
                                "size-8 rounded-lg text-xs font-medium border transition-all",
                                active
                                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                                  : "bg-background border-border text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {w.label.slice(1)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {formScheduleKind === "interval" ? (
                    <div className="space-y-2 pt-1">
                      <Label className="text-xs font-medium">执行间隔 (分钟)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={43200}
                        value={formIntervalMinutes}
                        onChange={(e) => setFormIntervalMinutes(Number(e.target.value))}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Right Column: Model & Instructions */}
              <div className="lg:col-span-7 space-y-4 rounded-2xl border border-border bg-card p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. 执行大模型与 AI 指令 Prompt
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">AI 供应商</Label>
                    <select
                      value={formProviderId}
                      onChange={(e) => setFormProviderId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    >
                      <option value="openrouter_custom">OpenRouter (Ox Alpha/Claude/DeepSeek)</option>
                      <option value="ollama">Ollama 本地私有模型</option>
                      <option value="opencode">OpenCode 内置引擎</option>
                      {(customProvidersData?.providers || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">模型 ID / 标识</Label>
                    <Input
                      value={formModelId}
                      onChange={(e) => setFormModelId(e.target.value)}
                      placeholder="如: stealth/ox-alpha, qwen3.5:27b"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">AI 执行指令与工作流 Prompt</Label>
                    <span className="text-[11px] text-muted-foreground">支持调用已安装的技能与工具</span>
                  </div>
                  <Textarea
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    rows={12}
                    placeholder="输入详细的定时任务提示词，例如要求 AI 自动调用外贸拓客技能搜索采购商、清洗数据并生成 Markdown 报告..."
                    className="text-xs font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-border bg-card/80 backdrop-blur flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSaveTask} className="gap-1.5 px-5">
              <CheckCircle2 className="size-4" />
              保存并生效计划
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* =================== Run Logs Viewer Dialog =================== */}
      <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="!w-[90vw] !max-w-4xl !h-[80vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-background"
        >
          <DialogHeader className="shrink-0 px-6 py-4 border-b border-border bg-card/80 backdrop-blur flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <History className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {selectedTaskForLogs ? `「${selectedTaskForLogs.name}」运行日志` : "全局自动化执行历史"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  查看后台调度器历史执行记录、触发模式与 AI 响应结果
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setLogsModalOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 bg-background">
            {runs.length === 0 ? (
              <div className="text-center py-16 text-xs text-muted-foreground">暂无历史执行记录</div>
            ) : (
              <div className="space-y-3">
                {runs.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{r.automationName}</span>
                        <Badge
                          variant={r.status === "succeeded" ? "default" : r.status === "failed" ? "destructive" : "secondary"}
                          className="text-[10px] px-2 py-0"
                        >
                          {r.status === "succeeded" ? "执行成功" : r.status === "failed" ? "执行失败" : "执行中"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {r.trigger === "manual" ? "手动触发" : "定时调度"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.startedAt).toLocaleString()} · 耗时 {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                      </div>
                    </div>

                    {r.resultSummary ? (
                      <div className="rounded-lg bg-background/80 p-3 font-mono text-[11px] leading-relaxed max-h-40 overflow-y-auto border border-border/40 whitespace-pre-wrap">
                        {r.resultSummary}
                      </div>
                    ) : null}

                    {r.error ? (
                      <div className="rounded-lg bg-destructive/10 text-destructive p-3 font-mono text-[11px] border border-destructive/20">
                        {r.error}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
