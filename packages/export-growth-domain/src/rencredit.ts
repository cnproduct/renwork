import { z } from "zod";

export const bvuOperationCodeSchema = z.enum([
  "TWIN_BUILD", // 每次企业知识库全量构建/深度刷新 (50 RenCredit / 次)
  "CUSTOMER_CLEAN_1K", // 每 1,000 条导入客户记录治理 (10 RenCredit / 千条)
  "ACCOUNT_ENRICH", // 单个目标客户深度数据富集 (3 RenCredit / 账户)
  "ACCOUNT_MONITOR_MONTH", // 单个客户海关/采购动态持续监测 (5 RenCredit / 户·月)
  "DEAL_DIAGNOSE", // 单次商机卡点诊断与策略输出 (8 RenCredit / 商机)
  "COMPLIANCE_AUDIT", // 单个产品×目标国家准入核验 (15 RenCredit / 次)
  "PRODUCT_OPPORTUNITY_REPORT", // 单个垂直品类延伸与机会报告 (30 RenCredit / 报告)
  "BENCHMARK_REPORT", // 单个行业同群组深度对标报告 (20 RenCredit / 报告)
]);
export type BvuOperationCode = z.infer<typeof bvuOperationCodeSchema>;

export const BVU_PRICING_TABLE: Record<
  BvuOperationCode,
  { name: string; unit: string; price: number; deliverableStandard: string }
> = {
  TWIN_BUILD: { name: "企业知识孪生全量构建", unit: "次", price: 50, deliverableStandard: "完整生成 00–20 模块报告及证据索引" },
  CUSTOMER_CLEAN_1K: { name: "存量客户数据治理", unit: "千条", price: 10, deliverableStandard: "输出数据质量审计报告、主记录合并及谱系图" },
  ACCOUNT_ENRICH: { name: "目标客户深度富集", unit: "账户", price: 3, deliverableStandard: "成功补齐公司规模、买家类型及公开海关字段" },
  ACCOUNT_MONITOR_MONTH: { name: "客户海关采购动态监测", unit: "户·月", price: 5, deliverableStandard: "监测期内按月推送真实的供应链异动事件" },
  DEAL_DIAGNOSE: { name: "深度商机卡点诊断", unit: "商机", price: 8, deliverableStandard: "输出包含多维度博弈分析与合规底线的策略报告" },
  COMPLIANCE_AUDIT: { name: "目标国准入核验", unit: "次", price: 15, deliverableStandard: "输出权威合规规则版本、准入要求与缺口清单" },
  PRODUCT_OPPORTUNITY_REPORT: { name: "品类延伸机会报告", unit: "报告", price: 30, deliverableStandard: "输出市场规模、竞品差异与试错验证 SOP" },
  BENCHMARK_REPORT: { name: "行业同群组基准对标", unit: "报告", price: 20, deliverableStandard: "返回满足 k-匿名门槛的分位数统计分布图表" },
};

export const rencreditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  walletId: z.string().min(1),
  lotId: z.string().min(1),
  reservationId: z.string().nullable(),
  type: z.enum(["grant", "reserve", "capture", "release", "refund"]),
  amount: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  reasonCode: z.string().min(1),
  actorType: z.enum(["user", "system", "admin"]),
  actorId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type RenCreditLedgerEntry = z.infer<typeof rencreditLedgerEntrySchema>;

export const rencreditUsageReceiptSchema = z.object({
  id: z.string().min(1),
  reservationId: z.string().min(1),
  operationCode: bvuOperationCodeSchema,
  quantity: z.number().int().positive(),
  priceVersionId: z.string().min(1),
  deliveredResultHash: z.string().min(1),
  capturedAmount: z.number().int().positive(),
  signature: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type RenCreditUsageReceipt = z.infer<typeof rencreditUsageReceiptSchema>;
