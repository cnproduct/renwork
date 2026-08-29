import { expect } from "vitest"
import { test } from "@openwork/testkit"
import {
  renworkCreditPolicySchema,
  renworkPlanCatalogSchema,
} from "../../packages/types/src/renwork-commerce.js"
import { getRenworkPlanCatalog } from "../../ee/apps/den-api/src/renwork-growth/plan-catalog.js"

// Approved before implementation. The later app-driving spec will prove these
// frames visibly; this app-less spec proves the shared commercial contract that
// the client, cloud service, and public site must consume.
const approvedVoiceover = [
  "用户登录 RenWork 后看到已经验证的账号、所属工作区和当前运行方式；登录只确认身份与权益，不自动上传本地文件。",
  "用户打开“套餐与 RenCredit”，清楚看到当前订阅、有效周期、续费状态和 RenCredit 余额；订阅权益与用量流水分开显示。",
  "用户可以切换个人版或企业版、月付或年付。所有套餐内容来自 RenWork 权威目录，本地 Agent、Ollama、BYOK 和本地知识始终标记为免费核心。",
  "企业管理员可以看到席位、共享 Workspace、共享 RenCredit 池、成员额度和审计能力；普通成员不能修改企业账单，也看不到供应商密钥和内部成本。",
  "用户进入“AI 找客户”，只需填写产品、目标市场和理想客户类型，不需要理解供应商、API 或 MCP。",
  "RenWork 免费返回优先企业、匹配理由、证据等级、风险提示及脱敏决策人；联系人数据不会被直接描述成已经确认采购或交易的买家。",
  "用户选择解锁联系方式时，RenWork 先显示本次 RenCredit 报价、“无有效结果不扣费”和“已解锁不重复收费”，等待用户明确确认。",
  "解锁成功后，RenWork 展示已验证联系方式、验证时间和可理解的来源摘要，只结算一次，并把联系人保存到当前 Workspace。",
  "如果供应商超时、无有效结果、隐私停止或用户取消，RenWork 释放预留额度，用户余额保持不变，并显示清楚的失败原因和重试建议。",
  "已解锁联系人再次查看、导出或由团队成员打开时不重复收费；管理员仍可审计来源供应商、许可范围、操作者、计费回执和内部成本。",
  "联系人解锁后，RenWork继续生成个性化触达方案、保留人工发送审批，并把回复、询盘、报价和跟进结果沉淀到客户资产中。",
  "最终验收证明个人与企业权益隔离、Tenant A/B 数据隔离、Agent 无法绕过扣费确认、普通界面没有供应商品牌或密钥。",
]

test("approved RenWork growth billing voiceover is the implementation target", async ({ evidence }) => {
  expect(approvedVoiceover).toHaveLength(12)
  expect(approvedVoiceover.join(" ")).toContain("权威目录")
  expect(approvedVoiceover.join(" ")).toContain("无有效结果不扣费")
  evidence.fact(
    "The approved journey is recorded in the executable spec",
    "All 12 approved frames are present; later app-driving assertions must prove them without a separate narration artifact.",
    true,
  )
})

test("one authoritative catalog separates subscription rights from outcome charging", async ({ evidence }) => {
  const catalog = renworkPlanCatalogSchema.parse(getRenworkPlanCatalog())
  expect(new Set(catalog.plans.map((plan) => plan.audience))).toEqual(new Set(["personal", "enterprise"]))
  expect(catalog.plans.every((plan) => plan.features.localFreeCore)).toBe(true)
  expect(catalog.plans.flatMap((plan) => plan.offers).every((offer) => offer.purchaseMode !== "checkout")).toBe(true)

  const preview = renworkCreditPolicySchema.parse(
    catalog.creditPolicies.find((policy) => policy.event === "buyer_company_preview"),
  )
  const unlock = renworkCreditPolicySchema.parse(
    catalog.creditPolicies.find((policy) => policy.event === "buyer_email_unlock"),
  )
  expect(preview.chargeTrigger).toBe("free")
  expect(unlock.chargeTrigger).toBe("successful_delivery")

  evidence.fact(
    "Subscription and RenCredit are separate contracts",
    "Personal and enterprise plans preserve the local free core; the pilot catalog exposes no checkout, previews are free, and contact unlock charges only after successful delivery.",
    true,
  )
})

test("the ordinary catalog contains no supplier implementation details", async ({ evidence }) => {
  const serialized = JSON.stringify(getRenworkPlanCatalog())
  expect(serialized).not.toMatch(/hunter|apollo|snov|api[_ -]?key|upstream[_ -]?credit|supplier[_ -]?cost/i)
  evidence.fact(
    "The public business contract is provider-agnostic",
    "The serialized plan and RenCredit catalog contains no supplier brand, key, upstream credit, or supplier-cost field.",
    true,
  )
})
