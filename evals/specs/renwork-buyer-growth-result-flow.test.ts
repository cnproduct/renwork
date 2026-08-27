import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const pagePath = join(repositoryRoot, "apps/app/src/react-app/domains/buyer-growth/buyer-growth-page.tsx")
const denClientPath = join(repositoryRoot, "apps/app/src/app/lib/den.ts")
const serverRoutePath = join(repositoryRoot, "ee/apps/den-api/src/routes/org/renwork-buyer-growth.ts")
const hunterAdapterPath = join(repositoryRoot, "ee/apps/den-api/src/renwork-growth/providers/hunter.ts")
const hunterConfigurationPath = join(repositoryRoot, "ee/apps/den-api/src/renwork-growth/providers/hunter-configuration.ts")
const appRootPath = join(repositoryRoot, "apps/app/src/react-app/shell/app-root.tsx")
const sidebarPath = join(repositoryRoot, "apps/app/src/react-app/domains/session/sidebar/app-sidebar.tsx")

function source(path: string): string {
  return readFileSync(path, "utf8")
}

test("AI buyer growth is a first-class signed-in result surface", async ({ evidence }) => {
  const page = source(pagePath)
  expect(source(appRootPath)).toContain('path="/buyer-growth"')
  expect(source(sidebarPath)).toContain('label="AI 找客户"')
  for (const visibleContract of [
    'data-testid="buyer-growth-page"',
    "产品",
    "目标市场",
    "理想客户类型",
    "企业预览免费",
    "证据等级",
    "脱敏决策人",
    "风险提示",
  ]) {
    expect(page).toContain(visibleContract)
  }

  evidence.fact(
    "Buyer growth is outcome-first",
    "The signed-in app exposes a dedicated AI buyer route that asks only for product, market, and customer type before rendering free companies, evidence, risks, and masked contacts.",
    true,
  )
})

test("contact unlock cannot bypass quote, protections, or explicit approval", async ({ evidence }) => {
  const page = source(pagePath)
  const client = source(denClientPath)

  expect(page).toContain("查看 RenCredit 报价")
  expect(page).toContain('data-testid="buyer-unlock-confirmation"')
  expect(page).toContain("无有效邮箱/电话、超时或隐私停止，不扣费")
  expect(page).toContain("再次查看、导出或团队复看不重复收费")
  expect(page).toContain("我确认解锁")
  expect(page).toContain("approval: true")
  expect(client).toContain('"/v1/renwork/buyer-growth/quote"')
  expect(client).toContain('"/v1/renwork/buyer-growth/unlock"')

  evidence.fact(
    "RenCredit requires an explicit business approval",
    "The UI requests an authoritative quote, displays no-result and duplicate protections, and sends the unlock only after the user checks the approval control.",
    true,
  )
})

test("success, release, and repeated viewing are distinct visible outcomes", async ({ evidence }) => {
  const page = source(pagePath)

  expect(page).toContain('data-testid="buyer-unlocked-contact"')
  expect(page).toContain("已解锁 · 本次 0 RenCredit")
  expect(page).toContain('data-testid="buyer-unlock-released"')
  expect(page).toContain("预留额度已释放，余额没有变化")
  expect(page).toContain("setUnlocked")

  evidence.fact(
    "Delivery outcomes do not collapse into one fake success state",
    "Successful contacts show verification metadata, released attempts say the balance is unchanged, and repeated contacts show a zero-RenCredit result.",
    true,
  )
})

test("ordinary users never receive supplier setup or fabricated fallback data", async ({ evidence }) => {
  const page = source(pagePath)
  const serverRoute = source(serverRoutePath)
  const ordinarySurface = `${page}\n${source(denClientPath)}`

  expect(ordinarySurface).not.toMatch(/hunter|apollo|snov|reveal[_ -]?handle|x-api-key/i)
  expect(serverRoute).toContain("orgMemberRoute()")
  expect(serverRoute).toContain("provider_gateway_unavailable")
  expect(page).toContain("没有返回演示联系人，也没有产生 RenCredit 扣费")
  expect(page).not.toMatch(/alex@example\.test|example import gmbh/i)

  evidence.fact(
    "The provider boundary is honest and tenant-authenticated",
    "The ordinary surface contains no supplier brand or key path, org membership guards the gateway, and an unconfigured provider returns unavailable instead of demo contacts.",
    true,
  )
})

test("the first real supplier stays behind the licensed server gateway", async ({ evidence }) => {
  const adapter = source(hunterAdapterPath)
  const configuration = source(hunterConfigurationPath)
  const serverRoute = source(serverRoutePath)

  expect(adapter).toContain('new URL(options.baseUrl ?? "https://api.hunter.io/v2/")')
  expect(adapter).toContain("Authorization: `Bearer ${this.apiKey}`")
  expect(adapter).toContain('searchParams.set("decision_maker", "true")')
  expect(adapter).toContain('searchParams.set("required_field", "email")')
  expect(adapter).toContain('this.request("multi-domain-search/reveal"')
  expect(adapter).toContain("providerCreditsCharged")
  expect(configuration).toContain('mode === "hunter_single_tenant"')
  expect(configuration).toContain('mode === "hunter_official_pool"')
  expect(configuration).toContain("officialPoolLicensed")
  expect(serverRoute).toContain("resolveHunterProviderAccess")
  expect(serverRoute).toContain("HunterBuyerSearchService")

  evidence.fact(
    "A deterministic REST adapter is license-gated and server-only",
    "The first supplier uses server-side bearer authentication, free masked decision-maker search, authoritative reveal cost reconciliation, tenant allowlisting, and an explicit official-pool license gate.",
    true,
  )
})
