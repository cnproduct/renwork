import { z } from "zod";

export const knowledgeStatusSchema = z.enum([
  "verified", // 企业已正式确认或具备权威法律效力证明
  "public", // 采集自公开渠道但未经内部内控核验的事实
  "inference", // 基于规则、外部信号或模型推断生成的衍生数据
  "advice", // 策略建议与推荐动作，禁止作为既定事实对外声明
  "missing", // 结构化模型中声明缺失的关键信息字段
  "expired", // 超出有效期的证书、报价或时效性信号
]);
export type KnowledgeStatus = z.infer<typeof knowledgeStatusSchema>;

export const sensitivitySchema = z.enum([
  "public", // 允许公开对外展示与引用的材料
  "internal", // 仅供企业内部业务员与管理人员查看的数据
  "restricted", // 极高敏感数据（如底牌成本、底线毛利、客户私有联系方式）
]);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

export const provenanceSourceTypeSchema = z.enum([
  "website",
  "uploaded_file",
  "manual",
  "csv_import",
  "crm_connector",
  "email",
  "marketplace",
  "customs_provider",
  "cloud_enrichment",
  "derived",
]);
export type ProvenanceSourceType = z.infer<typeof provenanceSourceTypeSchema>;

export const provenanceSchema = z.object({
  sourceType: provenanceSourceTypeSchema,
  sourceRef: z.string().min(1),
  observedAt: z.string().datetime(),
  extractedAt: z.string().datetime(),
  extractorVersion: z.string().min(1),
  evidenceExcerpt: z.string().max(1000).optional(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const baseEntitySchema = z.object({
  id: z.string().min(1), // UUIDv7 or UUID
  tenantId: z.string().min(1),
  workspaceId: z.string().min(1),
  ownerId: z.string().nullable(),
  knowledgeStatus: knowledgeStatusSchema,
  sensitivity: sensitivitySchema,
  confidence: z.number().min(0).max(1),
  provenance: z.array(provenanceSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
  deletedAt: z.string().datetime().nullable(),
});
export type BaseEntity = z.infer<typeof baseEntitySchema>;

export const dataEgressLevelSchema = z.enum([
  "D0", // 本地受限原始数据：客户主记录、联系人 PII、邮件正文、报价单底牌成本（绝对禁止出域）
  "D1", // 明示任务最小载荷：待富集域名、待核验海关 HS 编码、目标市场代码（单次显式授权出域）
  "D2", // 去标识学习特征：泛化行业分类、国家群组、商机推进耗时区间（Opt-in 异步特征上传）
  "D3", // 同群组聚合基准：细分行业转化率分位数、产品生命周期区间（云端聚合单向下发）
]);
export type DataEgressLevel = z.infer<typeof dataEgressLevelSchema>;
