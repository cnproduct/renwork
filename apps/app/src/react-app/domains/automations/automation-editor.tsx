/** @jsxImportSource react */
import { useEffect, useMemo, useRef, useState } from "react"
import { AUTOMATION_FREE_MODEL, type AutomationSchedule, type CreateAutomation } from "@openwork/types/automations"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Clock,
  Globe,
  Plus,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Wrench,
  X,
} from "lucide-react"

import { ModelPickerModal } from "@/react-app/domains/session/modals/model-picker-modal"
import type { AutomationModelOption, AutomationProviderCatalog } from "./automation-model-options"
import { automationPickerOptions, describeAutomationModel } from "./automation-model-options"

const WEEKDAYS_ZH = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 0, label: "日" },
] as const

const MONTH_DAYS = [
  { value: 1, label: "每月 1 日" },
  { value: 2, label: "每月 2 日" },
  { value: 5, label: "每月 5 日" },
  { value: 10, label: "每月 10 日" },
  { value: 15, label: "每月 15 日" },
  { value: 20, label: "每月 20 日" },
  { value: 25, label: "每月 25 日" },
  { value: 28, label: "每月 28 日" },
  { value: -1, label: "每月最后一日" },
]

function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date.getTime()
}

function toLocalDateTime(value: number) {
  const date = new Date(value)
  const component = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${component(date.getMonth() + 1)}-${component(date.getDate())}T${component(date.getHours())}:${component(date.getMinutes())}`
}

function defaultInput(modelOptions: readonly AutomationModelOption[]): CreateAutomation {
  const first = modelOptions[0] ?? AUTOMATION_FREE_MODEL
  return {
    name: "",
    instructions: "",
    schedule: { kind: "daily", timezone: localTimezone(), hour: 9, minute: 0 },
    model: { providerId: first.providerId, modelId: first.modelId, variant: null },
    workspaceId: null,
    connectors: [],
    effectiveStartAt: null,
    effectiveEndAt: null,
    notifyMiniProgram: true,
  }
}

function modelKey(model: { providerId: string; modelId: string }) {
  return `${encodeURIComponent(model.providerId)}:${encodeURIComponent(model.modelId)}`
}

function timeForSchedule(schedule: AutomationSchedule) {
  if (schedule.kind === "once" || schedule.kind === "interval") return { hour: 9, minute: 0 }
  return { hour: schedule.hour, minute: schedule.minute }
}

export type AutomationEditorProps = {
  initial?: CreateAutomation | null
  initialKey?: string
  modelOptions: readonly AutomationModelOption[]
  providerCatalog?: AutomationProviderCatalog
  busy: boolean
  openModelPickerOnMount?: boolean
  submitLabel: string
  onCancel: () => void
  onSave: (input: CreateAutomation) => Promise<void> | void
}

export function AutomationEditor(props: AutomationEditorProps) {
  const [input, setInput] = useState<CreateAutomation>(() => props.initial ?? defaultInput(props.modelOptions))
  const [pickerOpen, setPickerOpen] = useState(props.openModelPickerOnMount === true)
  const [frequencyTab, setFrequencyTab] = useState<"period" | "interval" | "once">(() => {
    if (props.initial?.schedule.kind === "interval") return "interval"
    if (props.initial?.schedule.kind === "once") return "once"
    return "period"
  })
  const [periodSubKind, setPeriodSubKind] = useState<"daily" | "weekly" | "monthly">(() => {
    if (props.initial?.schedule.kind === "weekly") return "weekly"
    if (props.initial?.schedule.kind === "monthly") return "monthly"
    return "daily"
  })
  const [intervalAmount, setIntervalAmount] = useState(2)
  const [intervalUnit, setIntervalUnit] = useState<"hours" | "minutes">("hours")
  const [showNotice, setShowNotice] = useState(true)

  const appliedInitialKey = useRef(props.initialKey)

  useEffect(() => {
    if (props.initial) {
      if (appliedInitialKey.current === props.initialKey) return
      appliedInitialKey.current = props.initialKey
      setInput(props.initial)
      if (props.initial.schedule.kind === "interval") {
        setFrequencyTab("interval")
        const mins = props.initial.schedule.intervalMinutes
        if (mins >= 60 && mins % 60 === 0) {
          setIntervalAmount(mins / 60)
          setIntervalUnit("hours")
        } else {
          setIntervalAmount(mins)
          setIntervalUnit("minutes")
        }
      } else if (props.initial.schedule.kind === "once") {
        setFrequencyTab("once")
      } else {
        setFrequencyTab("period")
        setPeriodSubKind(props.initial.schedule.kind)
      }
      return
    }
    setInput(defaultInput(props.modelOptions))
  }, [props.initial, props.initialKey, props.modelOptions])

  useEffect(() => {
    if (props.openModelPickerOnMount) setPickerOpen(true)
  }, [props.openModelPickerOnMount])

  const [modelQuery, setModelQuery] = useState("")
  const selectedModel = modelKey(input.model)
  const currentModelAvailable = props.modelOptions.some((option) => modelKey(option) === selectedModel)
  const modelLabel = describeAutomationModel(input.model, props.modelOptions)
  const pickerOptions = useMemo(
    () => automationPickerOptions({
      options: props.modelOptions,
      catalog: props.providerCatalog ?? {},
      selected: input.model,
    }),
    [input.model, props.modelOptions, props.providerCatalog],
  )
  const canSave = useMemo(
    () => input.name.trim().length > 0 && input.instructions.trim().length > 0 && currentModelAvailable,
    [currentModelAvailable, input.instructions, input.name],
  )
  const time = timeForSchedule(input.schedule)

  const handleFrequencyTabChange = (tab: "period" | "interval" | "once") => {
    setFrequencyTab(tab)
    const timezone = "timezone" in input.schedule && input.schedule.timezone ? input.schedule.timezone : localTimezone()

    if (tab === "once") {
      setInput((current) => ({ ...current, schedule: { kind: "once", timezone, at: tomorrowAtNine() } }))
    } else if (tab === "interval") {
      const minutes = intervalUnit === "hours" ? intervalAmount * 60 : intervalAmount
      setInput((current) => ({ ...current, schedule: { kind: "interval", timezone, intervalMinutes: minutes } }))
    } else {
      if (periodSubKind === "daily") {
        setInput((current) => ({ ...current, schedule: { kind: "daily", timezone, hour: time.hour, minute: time.minute } }))
      } else if (periodSubKind === "weekly") {
        setInput((current) => ({ ...current, schedule: { kind: "weekly", timezone, daysOfWeek: [1, 2, 3, 4, 5], hour: time.hour, minute: time.minute } }))
      } else {
        setInput((current) => ({ ...current, schedule: { kind: "monthly", timezone, dayOfMonth: 1, hour: time.hour, minute: time.minute } }))
      }
    }
  }

  const handlePeriodSubKindChange = (subKind: "daily" | "weekly" | "monthly") => {
    setPeriodSubKind(subKind)
    const timezone = "timezone" in input.schedule && input.schedule.timezone ? input.schedule.timezone : localTimezone()
    if (subKind === "daily") {
      setInput((current) => ({ ...current, schedule: { kind: "daily", timezone, hour: time.hour, minute: time.minute } }))
    } else if (subKind === "weekly") {
      setInput((current) => ({ ...current, schedule: { kind: "weekly", timezone, daysOfWeek: [1, 2, 3, 4, 5], hour: time.hour, minute: time.minute } }))
    } else {
      setInput((current) => ({ ...current, schedule: { kind: "monthly", timezone, dayOfMonth: 1, hour: time.hour, minute: time.minute } }))
    }
  }

  const changeTime = (value: string) => {
    const [hour, minute] = value.split(":").map(Number)
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return
    setInput((current) => {
      if (current.schedule.kind === "daily" || current.schedule.kind === "weekly" || current.schedule.kind === "monthly") {
        return {
          ...current,
          schedule: { ...current.schedule, hour, minute },
        }
      }
      return current
    })
  }

  const toggleWeekday = (day: number) => {
    setInput((current) => {
      if (current.schedule.kind !== "weekly") return current
      const selected = current.schedule.daysOfWeek.includes(day)
      const daysOfWeek = selected
        ? current.schedule.daysOfWeek.filter((value) => value !== day)
        : [...current.schedule.daysOfWeek, day].sort((left, right) => left - right)
      if (daysOfWeek.length === 0) return current
      return { ...current, schedule: { ...current.schedule, daysOfWeek } }
    })
  }

  const changeMonthlyDay = (dayOfMonth: number) => {
    setInput((current) => {
      if (current.schedule.kind !== "monthly") return current
      return { ...current, schedule: { ...current.schedule, dayOfMonth } }
    })
  }

  const updateInterval = (amount: number, unit: "hours" | "minutes") => {
    setIntervalAmount(amount)
    setIntervalUnit(unit)
    const minutes = unit === "hours" ? amount * 60 : amount
    setInput((current) => ({
      ...current,
      schedule: { kind: "interval", intervalMinutes: minutes },
    }))
  }

  return (
    <form
      className="space-y-6"
      data-automation-editor
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave && !props.busy) void props.onSave(input)
      }}
    >
      {/* Notice Banner */}
      {showNotice && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-white">提示</span>
            <span>自动化任务执行时，请勿关闭电脑或退出客户端，否则任务将无法正常执行</span>
          </div>
          <button
            type="button"
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400"
            onClick={() => setShowNotice(false)}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="automation-name" className="text-sm font-medium">名称</Label>
        <Input
          id="automation-name"
          value={input.name}
          maxLength={120}
          required
          placeholder="请输入任务名称，例如：耐科 B2B 选品每日扫描"
          className="h-10 rounded-xl"
          onChange={(event) => {
            const name = event.currentTarget.value
            setInput((current) => ({ ...current, name }))
          }}
        />
      </div>

      {/* Workspace */}
      <div className="space-y-2">
        <Label htmlFor="automation-workspace" className="text-sm font-medium">
          工作空间 <span className="text-xs font-normal text-muted-foreground">(可选)</span>
        </Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-xl">
            <Plus className="size-4" />
          </Button>
          <Input
            id="automation-workspace"
            readOnly
            value="默认关联当前工作空间 (人人易 AI 增长大脑)"
            className="h-10 cursor-default rounded-xl bg-muted/40 text-muted-foreground"
          />
        </div>
      </div>

      {/* Prompt / Instructions */}
      <div className="space-y-2">
        <Label htmlFor="automation-instructions" className="text-sm font-medium">提示词</Label>
        <div className="rounded-xl border border-border bg-card shadow-xs focus-within:ring-2 focus-within:ring-primary/20">
          <Textarea
            id="automation-instructions"
            className="min-h-32 resize-y border-none p-3 shadow-none focus-visible:ring-0"
            value={input.instructions}
            required
            placeholder="描述任务需要执行的具体指令、数据源、分析目标以及产出物料要求..."
            onChange={(event) => {
              const instructions = event.currentTarget.value
              setInput((current) => ({ ...current, instructions }))
            }}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-xs font-normal"
              onClick={() => setPickerOpen(true)}
            >
              <Sparkles className="size-3 text-primary" />
              <span>{currentModelAvailable ? modelLabel.split("·")[0]?.trim() || "Auto" : "Auto"}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-xs font-normal"
            >
              <Wrench className="size-3 text-emerald-600" />
              <span>技能</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-xs font-normal"
            >
              <UserCheck className="size-3 text-blue-600" />
              <span>召唤专家</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg border-amber-200 bg-amber-50 px-2 text-xs font-normal text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
            >
              <ShieldAlert className="size-3" />
              <span>完全访问权限</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </div>
        </div>
      </div>

      {/* Connectors */}
      <div className="space-y-2">
        <Label htmlFor="automation-connectors" className="text-sm font-medium">
          连接器 <span className="text-xs font-normal text-muted-foreground">(勾选即授权该连接器在任务中免确认使用)</span>
        </Label>
        <select
          id="automation-connectors"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20"
        >
          <option value="">选择连接器 (如：OKKI CRM 获客雷达、阿里国际站 RFQ、企业邮箱 SMTP)</option>
          <option value="crm" selected>已授权: OKKI CRM 客户雷达 / 邮件触达连接器</option>
          <option value="social">已授权: LinkedIn / Facebook 自动化矩阵发布连接器</option>
        </select>
      </div>

      {/* Execution Frequency */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">执行频率</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">建议避开上午高峰时段，高峰期容易排队等待；选择非高峰期执行更稳定</p>
        </div>

        {/* Segmented Control */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
          <button
            type="button"
            className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
              frequencyTab === "period"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleFrequencyTabChange("period")}
          >
            周期
          </button>
          <button
            type="button"
            className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
              frequencyTab === "interval"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleFrequencyTabChange("interval")}
          >
            按间隔
          </button>
          <button
            type="button"
            className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
              frequencyTab === "once"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleFrequencyTabChange("once")}
          >
            单次
          </button>
        </div>

        {/* Period Sub-Settings */}
        {frequencyTab === "period" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <select
                className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20"
                value={periodSubKind}
                onChange={(e) => handlePeriodSubKindChange(e.target.value as "daily" | "weekly" | "monthly")}
              >
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>

              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <Input
                  type="time"
                  className="h-10 w-32 rounded-xl text-center"
                  value={`${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`}
                  onChange={(event) => changeTime(event.currentTarget.value)}
                />
              </div>
            </div>

            {/* Weekly Days Selector */}
            {periodSubKind === "weekly" && (
              <div className="flex items-center gap-2 pt-1">
                {WEEKDAYS_ZH.map((day) => {
                  const active = input.schedule.kind === "weekly" && input.schedule.daysOfWeek.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`flex size-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => toggleWeekday(day.value)}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Monthly Day Selector */}
            {periodSubKind === "monthly" && (
              <div className="pt-1">
                <select
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20"
                  value={input.schedule.kind === "monthly" ? input.schedule.dayOfMonth : 1}
                  onChange={(e) => changeMonthlyDay(Number(e.target.value))}
                >
                  {MONTH_DAYS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Interval Sub-Settings */}
        {frequencyTab === "interval" && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-sm text-muted-foreground">每隔</span>
            <Input
              type="number"
              min={1}
              max={720}
              className="h-10 w-24 rounded-xl text-center"
              value={intervalAmount}
              onChange={(e) => updateInterval(Math.max(1, Number(e.target.value)), intervalUnit)}
            />
            <select
              className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-sm"
              value={intervalUnit}
              onChange={(e) => updateInterval(intervalAmount, e.target.value as "hours" | "minutes")}
            >
              <option value="hours">小时</option>
              <option value="minutes">分钟</option>
            </select>
            <span className="text-sm text-muted-foreground">自动执行一次</span>
          </div>
        )}

        {/* Once Sub-Settings */}
        {frequencyTab === "once" && input.schedule.kind === "once" && (
          <div className="pt-1">
            <Input
              type="datetime-local"
              className="h-10 rounded-xl"
              value={toLocalDateTime(input.schedule.at)}
              onChange={(event) => {
                const at = new Date(event.currentTarget.value).getTime()
                if (Number.isFinite(at)) {
                  setInput((current) => ({
                    ...current,
                    schedule: { kind: "once", timezone: localTimezone(), at },
                  }))
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Effective Date Range */}
      <div className="space-y-2">
        <Label htmlFor="automation-date-range" className="text-sm font-medium">
          生效日期区间 <span className="text-xs font-normal text-muted-foreground">(可选，留空表示始终生效)</span>
        </Label>
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            id="automation-date-range"
            className="h-10 rounded-xl pl-9"
            placeholder="选择生效起止日期 (例如：2026-08-16 至 2026-12-31)"
          />
        </div>
      </div>

      {/* Push Notification Toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">推送通知至 WorkBuddy / RenWork 微信小程序</div>
          <div className="text-xs text-muted-foreground">任务执行完成或异常时，第一时间在移动端接收状态报告</div>
        </div>
        <input
          type="checkbox"
          id="notifyMiniProgram"
          className="size-5 rounded accent-emerald-600"
          checked={input.notifyMiniProgram ?? true}
          onChange={(e) => setInput((current) => ({ ...current, notifyMiniProgram: e.target.checked }))}
        />
      </div>

      {/* Model Picker Modal */}
      <ModelPickerModal
        open={pickerOpen}
        options={pickerOptions}
        query={modelQuery}
        setQuery={setModelQuery}
        subtitle="Runs use this model and reasoning level in your desktop runtime."
        target="default"
        current={{ providerID: input.model.providerId, modelID: input.model.modelId }}
        onSelect={(model) => {
          setInput((current) => ({
            ...current,
            model: { providerId: model.providerID, modelId: model.modelID, variant: null },
          }))
          setPickerOpen(false)
        }}
        onBehaviorChange={(model, variant) => setInput((current) => ({
          ...current,
          model: { providerId: model.providerID, modelId: model.modelID, variant },
        }))}
        allowProviderManagement={false}
        onOpenSettings={() => setPickerOpen(false)}
        onClose={() => setPickerOpen(false)}
      />

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" className="h-10 rounded-xl px-5" disabled={props.busy} onClick={props.onCancel}>
          取消
        </Button>
        <Button type="submit" className="h-10 rounded-xl bg-primary px-6 text-white hover:bg-primary/90" disabled={!canSave || props.busy}>
          {props.busy ? "保存中…" : props.submitLabel}
        </Button>
      </div>
    </form>
  )
}
