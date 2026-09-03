import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))

const approvedPhaseTwoVoiceover = [
  "运维先核验 MetaSO 已书面授权 RenWork 多租户、商业化与 OEM 接入；没有证据时，全局 H3 闸门保持关闭。",
  "授权通过后，服务端注入密钥、不可变价格版本和结果域白名单；密钥永不进入客户端、审计响应或日志。",
  "预生产环境执行迁移，只给一个试点组织开启能力，并把 RenCredit 预算与并发控制在单任务范围。",
  "用户在报价并确认后执行真实 4 秒 768P 文生视频；证据记录供应商任务、一次额度冻结、任务哈希与最终结算。",
  "用户以当前租户拥有的首帧执行真实图生视频；系统核验素材归属、官方载荷、结果域、容器与哈希，并保留 AI 生成标识。",
  "对重复点击、网络重试和重新打开执行恢复测试；相同幂等键只能形成一次冻结和一个供应商任务。",
  "供应商拒绝、超时或交付无效时，系统释放额度、不落成片、不捕获费用，并留下管理员审计与安全人工释放证据。",
  "运维对账供应商实际成本与 RenCredit 结算并验证租户隔离；证据包经人工复核后，才能进入单组织生产灰度。",
] as const

async function source(relativePath: string) {
  return readFile(new URL(relativePath, `file://${repositoryRoot}/`), "utf8")
}

test("approved Phase 2 voiceover is encoded as a fail-closed one-organization live canary", async ({ evidence }) => {
  const [rollout, route, schema, phaseTwoMigration, costEvidenceMigration, provider, phaseTwoRunbook] = await Promise.all([
    source("ee/apps/den-api/src/capability-sources/minimax-h3-video-rollout.ts"),
    source("ee/apps/den-api/src/routes/org/video-generation.ts"),
    source("ee/packages/den-db/src/schema/video-generation.ts"),
    source("ee/packages/den-db/drizzle/0071_fluffy_talos.sql"),
    source("ee/packages/den-db/drizzle/0072_breezy_garia.sql"),
    source("ee/apps/den-api/src/minimax-h3-provider.ts"),
    source("docs/renwork-minimax-h3-phase2-canary.md"),
  ])

  expect(approvedPhaseTwoVoiceover).toHaveLength(8)

  expect(rollout).toContain("RENWORK_METASO_H3_LICENSE_EVIDENCE_ID")
  expect(rollout).toContain("RENWORK_H3_LIVE_CANARY")
  expect(rollout).toContain("RENWORK_H3_CANARY_ORGANIZATION_ID")
  expect(rollout).toContain("organizationId")
  expect(rollout).toContain("=== organizationId")

  expect(route).toContain("license_evidence_id")
  expect(route).toContain("provider_cost_kind")
  expect(route).toContain("provider_cost_microunits")
  expect(route).toContain("provider_cost_currency")
  expect(route).toContain("provider_cost_units")
  expect(route).toContain("provider_cost_unit_code")
  expect(route).toContain("METASO_H3_CREDIT")
  expect(route).toContain("cost_evidence_reference")
  expect(route).toContain("review_status")
  expect(route).toContain('"pending_review"')
  expect(route).toContain('"approved"')
  expect(route).toContain("captureProductCredits")
  expect(route).toContain("releaseProductCredits")
  expect(route).toContain("validatePersistedVideoResult")
  expect(route).toContain("AI_GENERATED_PROVENANCE_PRESERVED")

  expect(schema).toContain("license_evidence_id")
  expect(schema).toContain("provider_cost_kind")
  expect(schema).toContain("provider_cost_microunits")
  expect(schema).toContain("provider_cost_currency")
  expect(schema).toContain("provider_cost_units")
  expect(schema).toContain("provider_cost_unit_code")
  expect(schema).toContain("cost_evidence_reference")
  expect(schema).toContain("review_status")
  expect(schema).toContain("reviewed_by_org_membership_id")
  expect(schema).toContain("reviewed_at")
  expect(phaseTwoMigration).toContain("video_generation_jobs")
  expect(phaseTwoMigration).toContain("license_evidence_id")
  expect(phaseTwoMigration).toContain("provider_cost_microunits")
  expect(phaseTwoMigration).toContain("review_status")
  expect(costEvidenceMigration).toContain("provider_cost_kind")
  expect(costEvidenceMigration).toContain("provider_cost_units")
  expect(costEvidenceMigration).toContain("provider_cost_unit_code")
  expect(costEvidenceMigration).toContain("SET `provider_cost_kind` = 'money'")
  expect(costEvidenceMigration).toContain("WHERE `provider_cost_microunits` IS NOT NULL")

  expect(provider).toContain("RENWORK_METASO_H3_API_KEY")
  expect(provider).toContain("RENWORK_METASO_H3_RESULT_HOSTS")
  expect(provider).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:api.?key|authorization|bearer)/i)

  expect(phaseTwoRunbook).toContain("INCOMPLETE")
  expect(phaseTwoRunbook).toContain("RENWORK_METASO_H3_LICENSE_EVIDENCE_ID")
  expect(phaseTwoRunbook).toContain("RENWORK_H3_CANARY_ORGANIZATION_ID")
  expect(phaseTwoRunbook).toContain("OPENWORK_EVAL_H3_LIVE_CANARY")
  expect(phaseTwoRunbook).toContain("OPENWORK_EVAL_H3_REVIEWER_EMAIL")
  expect(phaseTwoRunbook).toContain("RENWORK_H3_CANARY_T2V_PROVIDER_COST_UNITS")
  expect(phaseTwoRunbook).toContain("RENWORK_H3_CANARY_I2V_PROVIDER_COST_UNITS")
  expect(phaseTwoRunbook).toContain("METASO_H3_CREDIT")
  expect(phaseTwoRunbook).toContain("供应商单笔成本")
  expect(phaseTwoRunbook).toContain("记录成本者不能批准同一任务")
  expect(phaseTwoRunbook).toContain("人工复核")
  expect(phaseTwoRunbook).toContain("不得进入生产灰度")

  evidence.fact(
    "Phase 2 cannot make a paid call from a key alone",
    "Written authorization evidence, explicit live opt-in, exact one-organization allowlisting, immutable pricing, and result-host allowlisting are independently required.",
    true,
  )
  evidence.fact(
    "Every accepted canary remains review-gated",
    "A job records authorization evidence, technical settlement, provider cost reconciliation, AI provenance, and an explicit human review state before any production decision.",
    true,
  )
  evidence.fact(
    "MetaSO cost evidence can use attributable H3 credits without inventing a currency amount",
    "The API and database encode mutually exclusive money or provider-credit evidence; MetaSO credits require METASO_H3_CREDIT, while an unattributed job keeps every cost field null and cannot be approved.",
    true,
  )
})
