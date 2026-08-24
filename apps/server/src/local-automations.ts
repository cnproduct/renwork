import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

export interface LocalAutomationSchedule {
  kind: "daily" | "weekly" | "interval" | "once";
  hour?: number; // 0-23
  minute?: number; // 0-59
  daysOfWeek?: number[]; // [0=Sun, 1=Mon, ..., 6=Sat] or [1..7]
  intervalMinutes?: number; // e.g. 60
  at?: number; // timestamp for once
  timezone?: string;
}

export interface LocalAutomationModel {
  providerId: string;
  modelId: string;
  variant?: string | null;
}

export interface LocalAutomationTask {
  id: string;
  name: string;
  description?: string;
  category?: "leadgen" | "social" | "customs" | "nurture" | "market" | "custom";
  instructions: string;
  schedule: LocalAutomationSchedule;
  model?: LocalAutomationModel;
  workspaceId?: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunStatus?: "succeeded" | "failed" | "running";
  lastRunResult?: string;
  lastRunDurationMs?: number;
  lastRunError?: string;
  nextRunAt?: number;
}

export interface LocalAutomationRunLog {
  id: string;
  automationId: string;
  automationName: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  status: "running" | "succeeded" | "failed";
  trigger: "scheduled" | "manual";
  resultSummary?: string;
  error?: string;
  sessionId?: string;
}

export interface LocalAutomationsFile {
  version: 1;
  automations: LocalAutomationTask[];
  runs: LocalAutomationRunLog[];
}

function resolveStoragePath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config");
  return join(xdg, "opencode", "local-automations.json");
}

export function readLocalAutomationsData(): LocalAutomationsFile {
  const filePath = resolveStoragePath();
  try {
    if (!existsSync(filePath)) {
      return { version: 1, automations: [], runs: [] };
    }
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as Partial<LocalAutomationsFile>;
    return {
      version: 1,
      automations: Array.isArray(data.automations) ? data.automations : [],
      runs: Array.isArray(data.runs) ? data.runs : [],
    };
  } catch {
    return { version: 1, automations: [], runs: [] };
  }
}

export function writeLocalAutomationsData(data: LocalAutomationsFile): void {
  const filePath = resolveStoragePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Calculates the next epoch timestamp (in ms) when this schedule should trigger after `fromTimeMs`.
 */
export function computeNextRunTime(schedule: LocalAutomationSchedule, fromTimeMs = Date.now()): number | undefined {
  if (schedule.kind === "once") {
    if (typeof schedule.at === "number" && schedule.at > fromTimeMs) {
      return schedule.at;
    }
    return undefined;
  }

  if (schedule.kind === "interval") {
    const mins = Math.max(1, schedule.intervalMinutes || 60);
    return fromTimeMs + mins * 60 * 1000;
  }

  const date = new Date(fromTimeMs);
  const hour = typeof schedule.hour === "number" ? Math.min(23, Math.max(0, schedule.hour)) : 9;
  const minute = typeof schedule.minute === "number" ? Math.min(59, Math.max(0, schedule.minute)) : 0;

  if (schedule.kind === "daily") {
    const target = new Date(date);
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= fromTimeMs) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  if (schedule.kind === "weekly") {
    const rawDays = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0 ? schedule.daysOfWeek : [1];
    const targetDays = rawDays.map((d) => (d === 7 ? 0 : d)); // normalize Sunday 7 -> 0

    // Find next available day in the next 14 days
    for (let offset = 0; offset <= 14; offset++) {
      const target = new Date(date);
      target.setDate(target.getDate() + offset);
      target.setHours(hour, minute, 0, 0);

      const dayOfWeek = target.getDay();
      if (targetDays.includes(dayOfWeek) && target.getTime() > fromTimeMs) {
        return target.getTime();
      }
    }
  }

  return undefined;
}

export const RENWORK_FOREIGN_TRADE_PRESETS: Omit<LocalAutomationTask, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "🌐 全网多源采购商自动化拓客",
    description: "每日定时调用自主获客引擎，穿透海外买家名录与社交主页，抓取最新采购商邮箱与联系方式并清洗入库。",
    category: "leadgen",
    instructions:
      "执行全网多源海外买家线索挖掘任务：\n1. 基于当前工作区的产品关键词与目标市场国家，检索最新的真实采购商商机；\n2. 提取采购决策人（采购总监/供应链经理）的官方域名、公开邮箱与 LinkedIn 主页；\n3. 过滤货代与无效中介，将有效线索结构化记录至工作区 `leads/` 目录。",
    schedule: {
      kind: "daily",
      hour: 9,
      minute: 30,
    },
    model: {
      providerId: "openrouter_custom",
      modelId: "stealth/ox-alpha",
    },
    enabled: true,
  },
  {
    name: "📱 B2B 社媒矩阵自动排期运营",
    description: "每日定时生成 6 语言高质量外贸产品推文与产品图文素材，自动排期并同步至 LinkedIn 与 Facebook 公司主页。",
    category: "social",
    instructions:
      "执行 B2B 社媒矩阵自动运营任务：\n1. 读取工作区主推产品与产品事实库；\n2. 撰写针对 LinkedIn（专业商务技术型）与 Facebook（工厂实力与应用场景型）的差异化推文；\n3. 生成多语言标签矩阵与明确的 CTA 获客链接，整理为当日排期发布清单。",
    schedule: {
      kind: "daily",
      hour: 11,
      minute: 0,
    },
    model: {
      providerId: "openrouter_custom",
      modelId: "stealth/ox-alpha",
    },
    enabled: true,
  },
  {
    name: "🚢 全球海关数据采购异动监控",
    description: "每周一自动穿透近 30 天重点 HS 编码海关提单数据，标记主要竞争对手的发货异动与新出现的进口大买家。",
    category: "customs",
    instructions:
      "执行全球海关提单采购异动监控任务：\n1. 检查重点产品类别的海关 HS 编码最新提单流向；\n2. 识别近 30 天采购柜量异动或出现供货商替换信号的采购商（Why-Now Signal）；\n3. 输出前 10 家高价值潜客名单及其采购特征报告。",
    schedule: {
      kind: "weekly",
      daysOfWeek: [1], // Monday
      hour: 8,
      minute: 30,
    },
    model: {
      providerId: "openrouter_custom",
      modelId: "stealth/ox-alpha",
    },
    enabled: true,
  },
  {
    name: "💌 存量客户跟进与复购唤醒",
    description: "每周三定时扫描超过 30 天未互动的重点客户与存量资产，生成 1v1 个性化跟进邮件与沟通策略草稿。",
    category: "nurture",
    instructions:
      "执行存量客户资产盘活与复购唤醒任务：\n1. 扫描当前工作区客户资产库，筛选最后联系时间超过 30 天的客户；\n2. 根据客户历史采购 SKU 与偏好，结合最新改款或汇率/海运费优势，撰写 1v1 定制跟进邮件草稿；\n3. 输出至工作区 `nurture/drafts/` 目录供业务员一键确认发送。",
    schedule: {
      kind: "weekly",
      daysOfWeek: [3], // Wednesday
      hour: 14,
      minute: 0,
    },
    model: {
      providerId: "openrouter_custom",
      modelId: "stealth/ox-alpha",
    },
    enabled: true,
  },
  {
    name: "📊 竞品与行业情报周报",
    description: "每周五自动抓取行业新产品动态、海外准入合规标准变化与竞品公开定价，生成结构化 Markdown 调研周报。",
    category: "market",
    instructions:
      "执行行业与竞品情报自动化周报任务：\n1. 检索主要海外目标市场（欧美、中东、东南亚）本周行业最新资讯与关税/法规动态；\n2. 总结主要竞争对手的产品推广动态与价格带区间；\n3. 生成出版级 Markdown 周报并保存到工作区 `reports/weekly/`。",
    schedule: {
      kind: "weekly",
      daysOfWeek: [5], // Friday
      hour: 16,
      minute: 30,
    },
    model: {
      providerId: "openrouter_custom",
      modelId: "stealth/ox-alpha",
    },
    enabled: true,
  },
];
