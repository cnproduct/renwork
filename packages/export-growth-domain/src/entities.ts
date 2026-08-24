import { z } from "zod";
import { baseEntitySchema } from "./metadata.js";

export const buyerTypeSchema = z.enum([
  "brand_owner", // 品牌商
  "importer_distributor", // 进口商 / 分销商
  "retail_chain", // 零售连锁 / 超市
  "cross_border_ecommerce", // 跨境电商大卖家
  "factory_raw_material", // 制造工厂 / 原材料采购商
]);
export type BuyerType = z.infer<typeof buyerTypeSchema>;

export const accountTierSchema = z.enum(["S", "A", "B", "C", "D"]);
export type AccountTier = z.infer<typeof accountTierSchema>;

export const accountLifecycleStatusSchema = z.enum([
  "prospect", // 潜客线索
  "negotiating", // 商务谈判中
  "active_customer", // 成交活跃客户
  "dormant", // 沉睡客户 (超过 180 天无互动)
  "churned", // 流失客户
]);
export type AccountLifecycleStatus = z.infer<typeof accountLifecycleStatusSchema>;

export const subsidiaryRelationshipSchema = z.object({
  relatedAccountId: z.string().min(1),
  type: z.enum(["parent", "subsidiary", "sister"]),
});
export type SubsidiaryRelationship = z.infer<typeof subsidiaryRelationshipSchema>;

export const accountSchema = baseEntitySchema.extend({
  canonicalName: z.string().min(1),
  normalizedDomain: z.string().nullable(),
  country: z.string().min(2).max(3), // ISO 2/3 code
  buyerType: buyerTypeSchema,
  tier: accountTierSchema,
  lifecycleStatus: accountLifecycleStatusSchema,
  aliases: z.array(z.string()).default([]),
  subsidiaryRelationships: z.array(subsidiaryRelationshipSchema).default([]),
});
export type Account = z.infer<typeof accountSchema>;

export const buyingCommitteeRoleSchema = z.enum([
  "economic_buyer", // 经济决策人 / 老板
  "technical_evaluator", // 技术评估人 / 工程师
  "user_influencer", // 使用者 / 影响者
  "gatekeeper", // 采购把关人 / 助理
  "procurement_specifier", // 采购专员 / 供应链经理
]);
export type BuyingCommitteeRole = z.infer<typeof buyingCommitteeRoleSchema>;

export const contactSchema = baseEntitySchema.extend({
  accountId: z.string().min(1),
  fullName: z.string().min(1),
  jobTitle: z.string().min(1),
  role: buyingCommitteeRoleSchema,
  influenceLevel: z.enum(["high", "medium", "low"]),
  email: z.string().email(),
  emailDeliverable: z.boolean().default(true),
  phone: z.string().nullable().optional(),
  whatsApp: z.string().nullable().optional(),
  linkedInUrl: z.string().url().nullable().optional(),
  consentStatus: z.object({
    optInMarketing: z.boolean().default(true),
    consentTimestamp: z.string().datetime().optional(),
  }),
});
export type Contact = z.infer<typeof contactSchema>;

export const signalCodeSchema = z.enum([
  "INQUIRY_EXPLICIT_REPLY", // 7天内针对外发邮件进行实质性业务回复 (+10, 半衰期 14天)
  "RFQ_SPEC_PRICE_REQUEST", // 明确索要特定型号规格书、报价单、交期或打样 (+8, 半衰期 21天)
  "STAGE_SAMPLE_SENT", // 处于已寄样、样品运输中或正由买方测试阶段 (+8, 恒定直到反馈)
  "CUSTOMS_CATEGORY_GROWTH", // 90天内匹配品类出现新增海关提单采购证据 (+8, 半衰期 90天)
  "REPURCHASE_CYCLE_DUE", // 当前时间进入历史复购周期均值窗口 (+6, 30天后清零)
  "EMAIL_CLICK_ATTACHMENT", // 邮件中产品详情链接点击或下载附件资料 (+4, 半衰期 7天)
  "KEY_DECISION_MAKER_FOUND", // 成功定位并补齐经济决策人 (+5, 静态加分)
  "PLATFORM_LOGIN_WEAK", // 客户近期登录独立站或 B2B 平台账号 (+1.5, 3天封顶 2分)
]);
export type SignalCode = z.infer<typeof signalCodeSchema>;

export const intentSignalSchema = baseEntitySchema.extend({
  accountId: z.string().min(1),
  signalType: signalCodeSchema,
  baseWeight: z.number().positive(),
  halfLifeDays: z.number().positive(),
  occurredAt: z.string().datetime(),
  dedupeKey: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type IntentSignal = z.infer<typeof intentSignalSchema>;

export const hardStopRiskTypeSchema = z.enum([
  "opt_out_compliance", // 客户提出退订或撤回同意
  "export_control_sanctions", // 命中实体清单或出口管制黑名单
  "credit_overdue_litigation", // 存在超过90天严重欠款或法律纠纷
  "email_hard_bounce", // 主联系人邮箱持续硬退信
]);
export type HardStopRiskType = z.infer<typeof hardStopRiskTypeSchema>;

export const hardStopSchema = z.object({
  riskType: hardStopRiskTypeSchema,
  severity: z.enum(["critical", "high"]),
  reason: z.string().min(1),
  active: z.boolean().default(true),
  detectedAt: z.string().datetime(),
});
export type HardStop = z.infer<typeof hardStopSchema>;

export const scoreSnapshotSchema = z.object({
  accountId: z.string().min(1),
  modelVersion: z.string().min(1),
  dynamicPriority: z.number().min(0).max(100),
  valueScore: z.number().min(0).max(100),
  intentScore: z.number().min(0).max(100),
  timingScore: z.number().min(0).max(100),
  stageScore: z.number().min(0).max(100),
  reachabilityScore: z.number().min(0).max(100),
  historyScore: z.number().min(0).max(100),
  riskScore: z.number().min(0).max(100),
  interactionBonus: z.number().min(0).max(10),
  evidenceConfidence: z.number().min(0).max(1),
  calculatedAt: z.string().datetime(),
});
export type ScoreSnapshot = z.infer<typeof scoreSnapshotSchema>;
