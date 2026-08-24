import { z } from "zod";
import type { Account360Aggregate } from "./account-360.js";

export const workQueueCodeSchema = z.enum([
  "TODAY_MUST_FOLLOW", // 今日必跟名单 (SLA: 8h 当日)
  "QUOTE_STALLED", // 报价停滞激活 (SLA: 1工作日)
  "SAMPLE_FEEDBACK_DUE", // 样品反馈催办 (SLA: 1工作日)
  "REPURCHASE_WINDOW", // 老客复购预警 (SLA: 3工作日)
  "HIGH_ENGAGEMENT_NO_INQUIRY", // 高意向未询盘 (SLA: 2工作日)
  "SUPPLY_SHIFT", // 供应链异动商机 (SLA: 2工作日)
  "REACTIVATED_DORMANT", // 沉睡老客复活 (SLA: 2工作日)
  "HIGH_SCORE_LEAK", // 高分漏跟进拦截 (SLA: 1工作日)
]);
export type WorkQueueCode = z.infer<typeof workQueueCodeSchema>;

export interface WorkQueueEvaluationItem {
  queueCode: WorkQueueCode;
  queueName: string;
  matched: boolean;
  priority: number;
  slaHours: number;
  reason: string;
  suggestedAction: string;
}

export const WORK_QUEUE_DEFINITIONS: Record<
  WorkQueueCode,
  { name: string; slaHours: number; description: string; defaultAction: string }
> = {
  TODAY_MUST_FOLLOW: {
    name: "今日必跟名单",
    slaHours: 8,
    description: "7天内出现新询盘、明确回复或索样，且超过24小时未产生有效人工跟进记录",
    defaultAction: "8小时内完成深度人工跟进并录入跟进纪要",
  },
  QUOTE_STALLED: {
    name: "报价停滞激活",
    slaHours: 24,
    description: "报价单发出后3至14天内未推进至寄样或签约阶段，且未录入失单原因",
    defaultAction: "调用17模块价格异动谈判让步话术重新激活询价",
  },
  SAMPLE_FEEDBACK_DUE: {
    name: "样品反馈催办",
    slaHours: 24,
    description: "样品物流状态显示已签收，且超过预期测试周期(默认7天)未录入测试结果",
    defaultAction: "针对买家委员会技术评估人发送测试进展跟进函",
  },
  REPURCHASE_WINDOW: {
    name: "老客复购预警",
    slaHours: 72,
    description: "历史成交订单数不低于2次，当前时间到达平均采购周期均值窗口(85%~115%)",
    defaultAction: "提前锁定生产排期，发起老客专享复购阶梯报价",
  },
  HIGH_ENGAGEMENT_NO_INQUIRY: {
    name: "高意向未询盘",
    slaHours: 48,
    description: "14天内产生3次以上独立内容交互，ICP匹配度高但尚未发起正式询盘",
    defaultAction: "基于买家浏览品类生成定制选型白皮书主动破冰",
  },
  SUPPLY_SHIFT: {
    name: "供应链异动商机",
    slaHours: 48,
    description: "授权海关数据显示客户原主要供应商出口量骤降40%以上、断供或总采购量快速上升",
    defaultAction: "发起针对性产能保障与无缝替代方案专项沟通",
  },
  REACTIVATED_DORMANT: {
    name: "沉睡老客复活",
    slaHours: 48,
    description: "处于沉睡状态(超过180天无互动)的客户，近期重新产生公开行为打点或主动访问",
    defaultAction: "调取最新产品升级目录与历史交易快照发起第一轮唤醒",
  },
  HIGH_SCORE_LEAK: {
    name: "高分漏跟进拦截",
    slaHours: 24,
    description: "动态优先级不低于65，处于开放商机阶段，但超过7天无活动记录且无待办动作",
    defaultAction: "指派业务员紧急创建下一步跟进动作或调整商机阶段",
  },
};

/**
 * 八大工作队列准入判定纯函数
 */
export function evaluateAccountWorkQueues(
  account360: Account360Aggregate,
  nowTimestampMs: number = Date.now(),
): WorkQueueEvaluationItem[] {
  const results: WorkQueueEvaluationItem[] = [];
  const { account, decisionState, historicalMetrics, signalsSummary } = account360;
  const pDynamic = decisionState.latestScoreSnapshot.dynamicPriority;

  // 1. TODAY_MUST_FOLLOW: 7天内出现新询盘/回复/索样，且 >24h 无人工跟进
  const hasRecentHighSignal = signalsSummary.latestActiveSignals.some(
    (s) =>
      (s.signalType === "INQUIRY_EXPLICIT_REPLY" || s.signalType === "RFQ_SPEC_PRICE_REQUEST") &&
      nowTimestampMs - new Date(s.occurredAt).getTime() <= 7 * 24 * 3600 * 1000,
  );
  const lastActivityAgeHours = signalsSummary.lastActivity
    ? (nowTimestampMs - new Date(signalsSummary.lastActivity.occurredAt).getTime()) / (3600 * 1000)
    : 9999;
  if (hasRecentHighSignal && lastActivityAgeHours >= 24) {
    results.push({
      queueCode: "TODAY_MUST_FOLLOW",
      queueName: WORK_QUEUE_DEFINITIONS.TODAY_MUST_FOLLOW.name,
      matched: true,
      priority: 95,
      slaHours: WORK_QUEUE_DEFINITIONS.TODAY_MUST_FOLLOW.slaHours,
      reason: `7天内产生关键意向信号，已超过 ${Math.round(lastActivityAgeHours)} 小时未跟进`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.TODAY_MUST_FOLLOW.defaultAction,
    });
  }

  // 2. QUOTE_STALLED: 处于 negotiating 阶段且最后活动在 3~14 天前
  if (account.lifecycleStatus === "negotiating" && lastActivityAgeHours >= 72 && lastActivityAgeHours <= 336) {
    results.push({
      queueCode: "QUOTE_STALLED",
      queueName: WORK_QUEUE_DEFINITIONS.QUOTE_STALLED.name,
      matched: true,
      priority: 85,
      slaHours: WORK_QUEUE_DEFINITIONS.QUOTE_STALLED.slaHours,
      reason: `报价推进停滞 ${Math.round(lastActivityAgeHours / 24)} 天未推进`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.QUOTE_STALLED.defaultAction,
    });
  }

  // 3. SAMPLE_FEEDBACK_DUE: 处于寄样信号阶段且持续超过 7 天
  const sampleSignal = signalsSummary.latestActiveSignals.find((s) => s.signalType === "STAGE_SAMPLE_SENT");
  if (sampleSignal) {
    const sampleAgeDays = (nowTimestampMs - new Date(sampleSignal.occurredAt).getTime()) / (24 * 3600 * 1000);
    if (sampleAgeDays >= 7) {
      results.push({
        queueCode: "SAMPLE_FEEDBACK_DUE",
        queueName: WORK_QUEUE_DEFINITIONS.SAMPLE_FEEDBACK_DUE.name,
        matched: true,
        priority: 80,
        slaHours: WORK_QUEUE_DEFINITIONS.SAMPLE_FEEDBACK_DUE.slaHours,
        reason: `样品已送达 ${Math.round(sampleAgeDays)} 天未收到反馈`,
        suggestedAction: WORK_QUEUE_DEFINITIONS.SAMPLE_FEEDBACK_DUE.defaultAction,
      });
    }
  }

  // 4. REPURCHASE_WINDOW: 历史订单 >= 2 次且进入复购窗口
  if (historicalMetrics.totalOrdersCount >= 2 && historicalMetrics.nextExpectedOrderWindow) {
    const startMs = new Date(historicalMetrics.nextExpectedOrderWindow.start).getTime();
    const endMs = new Date(historicalMetrics.nextExpectedOrderWindow.end).getTime();
    if (nowTimestampMs >= startMs && nowTimestampMs <= endMs) {
      results.push({
        queueCode: "REPURCHASE_WINDOW",
        queueName: WORK_QUEUE_DEFINITIONS.REPURCHASE_WINDOW.name,
        matched: true,
        priority: 75,
        slaHours: WORK_QUEUE_DEFINITIONS.REPURCHASE_WINDOW.slaHours,
        reason: `到达平均采购周期预测复购窗口 (${new Date(startMs).toLocaleDateString()} ~ ${new Date(endMs).toLocaleDateString()})`,
        suggestedAction: WORK_QUEUE_DEFINITIONS.REPURCHASE_WINDOW.defaultAction,
      });
    }
  }

  // 5. HIGH_ENGAGEMENT_NO_INQUIRY: 14天内 >=3次交互且尚未建商机
  const recentSignalsCount = signalsSummary.latestActiveSignals.filter(
    (s) => nowTimestampMs - new Date(s.occurredAt).getTime() <= 14 * 24 * 3600 * 1000,
  ).length;
  if (account.lifecycleStatus === "prospect" && recentSignalsCount >= 3) {
    results.push({
      queueCode: "HIGH_ENGAGEMENT_NO_INQUIRY",
      queueName: WORK_QUEUE_DEFINITIONS.HIGH_ENGAGEMENT_NO_INQUIRY.name,
      matched: true,
      priority: 70,
      slaHours: WORK_QUEUE_DEFINITIONS.HIGH_ENGAGEMENT_NO_INQUIRY.slaHours,
      reason: `14天内高频交互 ${recentSignalsCount} 次，尚未建立正式商机`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.HIGH_ENGAGEMENT_NO_INQUIRY.defaultAction,
    });
  }

  // 6. SUPPLY_SHIFT: 近期海关出现新增提单或采购异动
  if (signalsSummary.recentCustomsShipments.length > 0) {
    results.push({
      queueCode: "SUPPLY_SHIFT",
      queueName: WORK_QUEUE_DEFINITIONS.SUPPLY_SHIFT.name,
      matched: true,
      priority: 70,
      slaHours: WORK_QUEUE_DEFINITIONS.SUPPLY_SHIFT.slaHours,
      reason: `海关提单数据监测到最新进口异动事件`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.SUPPLY_SHIFT.defaultAction,
    });
  }

  // 7. REACTIVATED_DORMANT: 处于 dormant 状态但产生新活跃信号
  if (account.lifecycleStatus === "dormant" && signalsSummary.latestActiveSignals.length > 0) {
    results.push({
      queueCode: "REACTIVATED_DORMANT",
      queueName: WORK_QUEUE_DEFINITIONS.REACTIVATED_DORMANT.name,
      matched: true,
      priority: 65,
      slaHours: WORK_QUEUE_DEFINITIONS.REACTIVATED_DORMANT.slaHours,
      reason: `沉睡老客重新产生公开意向活跃信号`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.REACTIVATED_DORMANT.defaultAction,
    });
  }

  // 8. HIGH_SCORE_LEAK: P_dynamic >= 65, negotiating/active, >7天无活动
  if (pDynamic >= 65 && account.lifecycleStatus === "negotiating" && lastActivityAgeHours >= 168) {
    results.push({
      queueCode: "HIGH_SCORE_LEAK",
      queueName: WORK_QUEUE_DEFINITIONS.HIGH_SCORE_LEAK.name,
      matched: true,
      priority: 85,
      slaHours: WORK_QUEUE_DEFINITIONS.HIGH_SCORE_LEAK.slaHours,
      reason: `高分客户 (优先级 ${pDynamic}) 超过 7 天无跟进记录，存在漏单风险`,
      suggestedAction: WORK_QUEUE_DEFINITIONS.HIGH_SCORE_LEAK.defaultAction,
    });
  }

  return results;
}
