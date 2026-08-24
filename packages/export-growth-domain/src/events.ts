import { z } from "zod";

export const domainEventEnvelopeSchema = z.object({
  eventId: z.string().min(1), // UUIDv7 单调递增事件标识
  eventType: z.string().min(1), // 点号分隔命名空间类型
  schemaVersion: z.number().int().positive(), // Payload 契约版本
  workspaceId: z.string().min(1), // 工作区隔离标识
  aggregateId: z.string().min(1), // 聚合根实体标识
  causationId: z.string().min(1), // 触发当前事件的父动作标识
  correlationId: z.string().min(1), // 全链路追踪调用链标识
  occurredAt: z.string().datetime(), // ISO 8601 UTC
  payload: z.unknown(), // 领域数据载荷
});
export type DomainEventEnvelope<T = unknown> = Omit<z.infer<typeof domainEventEnvelopeSchema>, "payload"> & {
  payload: T;
};

export const CORE_DOMAIN_EVENT_TYPES = [
  "enterprise_twin.conflict_detected", // 发现企业知识冲突
  "customer_import.committed", // 客户数据导入完成
  "signal.recorded", // 外部意图行为打点
  "score.snapshot_created", // 评分计算完成
  "next_action.approved", // 业务员确认执行动作
  "outcome.recorded", // 业务交易结果闭环
  "rencredit.reserved", // 增值服务额度预占
  "rencredit.captured", // 增值服务正式扣费
  "rencredit.released", // 增值服务预占释放
] as const;
export type CoreDomainEventType = (typeof CORE_DOMAIN_EVENT_TYPES)[number];
