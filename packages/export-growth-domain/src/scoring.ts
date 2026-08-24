import type { AccountTier, HardStop, SignalCode } from "./entities.js";

export interface ScoreInputs {
  valueScore: number; // [0, 100] 企业价值分
  intentScore: number; // [0, 100] 意图强度分
  timingScore: number; // [0, 100] 时机成熟度分
  stageScore: number; // [0, 100] 阶段推进分
  reachabilityScore: number; // [0, 100] 可触达性分
  historyScore: number; // [0, 100] 历史成交体量分
  riskScore: number; // [0, 100] 风险惩罚分
  evidenceConfidence: number; // [0, 1] 证据置信度系数
  riskMultiplier?: number; // 默认 1.2
}

export interface ScoreCalculationResult {
  baseScore: number; // S_base
  interactionBonus: number; // B_interaction [0, 10]
  riskPenalty: number; // P_risk
  rawPriority: number; // P_raw [0, 100]
  dynamicPriority: number; // P_dynamic [0, 100]
}

export const SIGNAL_CONFIGS: Record<
  SignalCode,
  { baseWeight: number; halfLifeDays: number; maxScorePerDay?: number; maxScorePeriodDays?: number; periodCap?: number }
> = {
  INQUIRY_EXPLICIT_REPLY: { baseWeight: 10.0, halfLifeDays: 14, maxScorePerDay: 10.0, maxScorePeriodDays: 7, periodCap: 15.0 },
  RFQ_SPEC_PRICE_REQUEST: { baseWeight: 8.0, halfLifeDays: 21, maxScorePerDay: 8.0, maxScorePeriodDays: 14, periodCap: 12.0 },
  STAGE_SAMPLE_SENT: { baseWeight: 8.0, halfLifeDays: 30 },
  CUSTOMS_CATEGORY_GROWTH: { baseWeight: 8.0, halfLifeDays: 90, maxScorePeriodDays: 30, periodCap: 8.0 },
  REPURCHASE_CYCLE_DUE: { baseWeight: 6.0, halfLifeDays: 30 },
  EMAIL_CLICK_ATTACHMENT: { baseWeight: 4.0, halfLifeDays: 7, maxScorePerDay: 4.0 },
  KEY_DECISION_MAKER_FOUND: { baseWeight: 5.0, halfLifeDays: 180 },
  PLATFORM_LOGIN_WEAK: { baseWeight: 1.5, halfLifeDays: 3, maxScorePeriodDays: 3, periodCap: 2.0 },
};

/**
 * 1. 指数半衰期时间衰减算法
 * W_effective(t) = W_base * exp( - ln(2) * (t - t_event) / tau_half_life )
 */
export function computeExponentialDecay(
  baseWeight: number,
  eventTimestampMs: number,
  currentTimestampMs: number,
  halfLifeDays: number,
): number {
  if (currentTimestampMs <= eventTimestampMs) {
    return baseWeight;
  }
  const deltaDays = (currentTimestampMs - eventTimestampMs) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.exp(-Math.LN2 * (deltaDays / halfLifeDays));
  return baseWeight * decayFactor;
}

/**
 * 2. 限制函数 clamp(val, min, max)
 */
export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 3. 多维动态优先级计算模型 (严密实现规范 5.1 数学公式)
 */
export function computePriorityScore(inputs: ScoreInputs): ScoreCalculationResult {
  const v = clamp(inputs.valueScore);
  const i = clamp(inputs.intentScore);
  const t = clamp(inputs.timingScore);
  const s = clamp(inputs.stageScore);
  const r = clamp(inputs.reachabilityScore);
  const h = clamp(inputs.historyScore);
  const risk = clamp(inputs.riskScore);
  const kRisk = typeof inputs.riskMultiplier === "number" ? Math.max(0, inputs.riskMultiplier) : 1.2;
  const cEvidence = Math.min(Math.max(inputs.evidenceConfidence, 0), 1);

  // S_base = 0.20 * S_value + 0.25 * S_intent + 0.15 * S_timing + 0.15 * S_stage + 0.10 * S_reachability + 0.15 * S_history
  const baseScore = 0.20 * v + 0.25 * i + 0.15 * t + 0.15 * s + 0.10 * r + 0.15 * h;

  // B_interaction = min(10, 10 * (S_value / 100) * (S_timing / 100))
  const interactionBonus = Math.min(10, 10 * (v / 100) * (t / 100));

  // P_risk = min(100, S_risk * K_risk)
  const riskPenalty = Math.min(100, risk * kRisk);

  // P_raw = clamp(S_base + B_interaction - P_risk, 0, 100)
  const rawPriority = clamp(baseScore + interactionBonus - riskPenalty, 0, 100);

  // P_dynamic = P_raw * (0.70 + 0.30 * C_evidence)
  const dynamicPriority = clamp(rawPriority * (0.70 + 0.30 * cEvidence), 0, 100);

  return {
    baseScore: Number(baseScore.toFixed(4)),
    interactionBonus: Number(interactionBonus.toFixed(4)),
    riskPenalty: Number(riskPenalty.toFixed(4)),
    rawPriority: Number(rawPriority.toFixed(4)),
    dynamicPriority: Number(dynamicPriority.toFixed(4)),
  };
}

/**
 * 4. Hard Stop 熔断判定器
 * 当存在 active Hard Stop 时，所有营销推荐 100% 阻断
 */
export function evaluateHardStops(hardStops: HardStop[]): {
  isBlocked: boolean;
  activeStops: HardStop[];
  reasons: string[];
} {
  const active = hardStops.filter((h) => h.active);
  return {
    isBlocked: active.length > 0,
    activeStops: active,
    reasons: active.map((h) => `${h.riskType}: ${h.reason}`),
  };
}

/**
 * 5. 客户分层器与持仓上限
 */
export function classifyAccountTier(
  dynamicPriority: number,
  options: {
    hasStrongIntentOrTiming?: boolean;
    isInNegotiationOrSampleStage?: boolean;
    isHighValueRepurchaseAlert?: boolean;
    hasActiveHardStop?: boolean;
    isDormantOrBroad?: boolean;
    isInvalidOrChurned?: boolean;
  } = {},
): {
  tier: AccountTier;
  capacityLimit: number; // 业务员单人持仓上限
  slaHours: number; // 跟进 SLA 响应时限 (小时)
  description: string;
} {
  if (options.hasActiveHardStop || options.isInvalidOrChurned || dynamicPriority < 20) {
    return {
      tier: "D",
      capacityLimit: 0,
      slaHours: 0,
      description: "无效/归档池：停止营销资源投入，归档存档",
    };
  }

  // S 级准入：P_dynamic >= 80 且 包含强意图/时机信号或处于谈判寄样阶段，且无 Hard Stop
  if (
    dynamicPriority >= 80 &&
    (options.hasStrongIntentOrTiming || options.isInNegotiationOrSampleStage)
  ) {
    return {
      tier: "S",
      capacityLimit: 20,
      slaHours: 8,
      description: "战略客户：当天(8小时内)必须完成人工深度跟进，主管每日复盘",
    };
  }

  // A 级准入：65 <= P_dynamic < 80，或高价值成交老客户处于复购预警窗口
  if (dynamicPriority >= 65 || options.isHighValueRepurchaseAlert) {
    return {
      tier: "A",
      capacityLimit: 100,
      slaHours: 24,
      description: "高优客户：1个工作日内完成个性化触达，优先配置打样支持",
    };
  }

  // B 级准入：45 <= P_dynamic < 65，具备明确 ICP 画像特征
  if (dynamicPriority >= 45) {
    return {
      tier: "B",
      capacityLimit: 300,
      slaHours: 72,
      description: "培育客户：进入自动化内容滴灌培育，出现强信号时自动晋升",
    };
  }

  // C 级准入：20 <= P_dynamic < 45，历史线索或沉睡广域
  return {
    tier: "C",
    capacityLimit: 9999,
    slaHours: 168,
    description: "沉睡/广域：公海池统一运营，按国家、展会或旺季节点批量唤醒",
  };
}
