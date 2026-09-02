import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))

const approvedPhaseOneVoiceover = [
  "已登录的试点组织进入 AI 生视频；只有获得灰度授权的组织看得到 H3。",
  "用户选择文生视频或首帧生视频；第一阶段只开放 768P、4 到 8 秒和单任务，不展示 MetaSO、API Key 或供应商配置。",
  "H3 Director 生成提示词、素材角色与验收条件；不支持的模式、素材或提示词在计费前被拦截。",
  "RenWork 展示 RenCredit 报价并等待确认；确认后才冻结额度，重复点击或网络重试不会重复冻结。",
  "任务以已提交、生成中等状态运行；刷新或重新打开后恢复同一个任务，不创建重复付费任务。",
  "成功成片复制到当前租户资产库并完成技术检查；交付凭证包含任务哈希和结果哈希。",
  "供应商拒绝、失败或没有有效交付时释放 RenCredit；管理员审计可见供应商任务、价格版本和结算，但任何界面或日志都不暴露密钥。",
] as const

async function source(relativePath: string) {
  return readFile(new URL(relativePath, `file://${repositoryRoot}/`), "utf8")
}

test("approved Phase 1 voiceover is enforced across the H3 video route", async ({ evidence }) => {
  const [
    capability,
    contracts,
    provider,
    route,
    ledger,
    schema,
    page,
    client,
    appRoot,
  ] = await Promise.all([
    source("ee/apps/den-api/src/capability-sources/minimax-h3-video-rollout.ts"),
    source("packages/minimax-h3-video/src/contracts.ts"),
    source("ee/apps/den-api/src/minimax-h3-provider.ts"),
    source("ee/apps/den-api/src/routes/org/video-generation.ts"),
    source("ee/apps/den-api/src/rencredit-ledger.ts"),
    source("ee/packages/den-db/src/schema/video-generation.ts"),
    source("apps/app/src/react-app/domains/video/video-generation-page.tsx"),
    source("apps/app/src/app/lib/den.ts"),
    source("apps/app/src/react-app/shell/app-root.tsx"),
  ])

  expect(approvedPhaseOneVoiceover).toHaveLength(7)

  expect(capability).toContain("minimaxH3Video")
  expect(capability).toContain("RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED")
  expect(capability).toContain("return false")

  expect(contracts).toContain('z.enum(["text_to_video", "first_frame_to_video"])')
  expect(contracts).toContain('z.literal("768P")')
  expect(contracts).toContain("min(4)")
  expect(contracts).toContain("max(8)")
  expect(contracts).toContain("PROMPT_REQUIRED")
  expect(contracts).toContain("FIRST_FRAME_REQUIRED")

  expect(route).toContain('"/v1/video-generation/capabilities"')
  expect(route).toContain('"/v1/video-generation/quotes"')
  expect(route).toContain('"/v1/video-generation/jobs"')
  expect(route).toContain("Idempotency-Key")
  expect(route).toContain("reserveProductCredits")
  expect(route).toContain("releaseProductCredits")
  expect(route).toContain("captureProductCredits")
  expect(route).toContain("result_hash")
  expect(route).toContain("task_hash")

  expect(ledger).toContain("PRODUCT_OUTCOME_RESERVE")
  expect(ledger).toContain("PRODUCT_OUTCOME_CAPTURE")
  expect(ledger).toContain("PRODUCT_NO_RESULT_RELEASE")

  expect(schema).toContain("organization_id")
  expect(schema).toContain("org_membership_id")
  expect(schema).toContain("idempotency_key")
  expect(schema).toContain("provider_task_id")
  expect(schema).toContain("price_version")
  expect(schema).toContain("result_bytes")
  expect(schema).toContain("result_hash")
  expect(schema).toContain("task_hash")
  expect(schema).toContain("uniqueIndex")

  expect(provider).toContain('"/v2/video_generation"')
  expect(provider).toContain('"/v2/query/video_generation/"')
  expect(provider).toContain("Bearer")
  expect(provider).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:api.?key|authorization|bearer)/i)

  expect(appRoot).toContain('path="/workspace/:workspaceId/video"')
  expect(page).toContain('data-testid="video-generation-page"')
  expect(page).toContain('data-testid="video-rencredit-quote"')
  expect(page).toContain('data-testid="video-generate-confirm"')
  expect(page).toContain('data-testid="video-job-receipt"')
  expect(page).toContain("submitted")
  expect(page).toContain("running")
  expect(page).not.toMatch(/metaso|mk-[a-z0-9]|api.?key|provider.?config/i)
  expect(client).toContain('"/v1/video-generation/capabilities"')
  expect(client).toContain('"/v1/video-generation/quotes"')
  expect(client).toContain('"/v1/video-generation/jobs"')

  evidence.fact(
    "Phase 1 is a tenant-scoped, fail-closed gray route",
    "The organization capability and commercial-license gate must both pass before the member sees or invokes the H3 route.",
    true,
  )
  evidence.fact(
    "RenCredit settlement follows valid delivery",
    "A confirmed idempotent request reserves once, captures only after a persisted and hashed result, and releases on rejection, failure, or empty delivery.",
    true,
  )
  evidence.fact(
    "Supplier details stay behind the RenWork boundary",
    "The member UI exposes modes, quote, job state, asset and receipt; provider task and price-version evidence remain server/admin data and secrets never cross the boundary.",
    true,
  )
})
