import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const commerceViewPath = join(repositoryRoot, "apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx")
const denClientPath = join(repositoryRoot, "apps/app/src/app/lib/den.ts")
const settingsRoutePath = join(repositoryRoot, "apps/app/src/react-app/shell/settings-route.tsx")
const catalogRoutePath = join(repositoryRoot, "ee/apps/den-api/src/routes/renwork-commerce/index.ts")
const walletRoutePath = join(repositoryRoot, "ee/apps/den-api/src/routes/org/inference.ts")
const durableLedgerPath = join(repositoryRoot, "ee/apps/den-api/src/rencredit-ledger.ts")
const memoryLedgerPath = join(repositoryRoot, "ee/apps/den-api/src/renwork-growth/in-memory-rencredit-ledger.ts")

function source(path: string): string {
  return readFileSync(path, "utf8")
}

test("the account center loads plans from the authoritative Den catalog", async ({ evidence }) => {
  const commerceView = source(commerceViewPath)
  const denClient = source(denClientPath)
  const catalogRoute = source(catalogRoutePath)

  expect(source(settingsRoutePath)).toContain('case "commerce"')
  expect(commerceView).toContain("client.getRenworkPlanCatalog()")
  expect(denClient).toContain('"/v1/renwork/commerce/catalog"')
  expect(catalogRoute).toContain("getRenworkPlanCatalog()")
  expect(commerceView).not.toMatch(/hunter|apollo|snov|x-api-key|authorization:\s*bearer/i)

  evidence.fact(
    "The pricing surface has one authoritative source",
    "The RenWork desktop account center renders the Den catalog and contains no supplier brand or user-facing supplier credential path.",
    true,
  )
})

test("the account center reads RenCredit only from the durable organization wallet", async ({ evidence }) => {
  const commerceView = source(commerceViewPath)
  const denClient = source(denClientPath)
  const walletRoute = source(walletRoutePath)
  const durableLedger = source(durableLedgerPath)

  expect(commerceView).toContain("client.getRenCreditWallet(organizationId)")
  expect(denClient).toContain('"/v1/rencredit/wallet"')
  expect(walletRoute).toContain("getOrCreateRenCreditWallet")
  expect(walletRoute).not.toContain("available_microcredits: 0")
  expect(durableLedger).toContain("RenCreditWalletTable")
  expect(durableLedger).toContain("RenCreditLedgerEntryTable")
  expect(existsSync(memoryLedgerPath)).toBe(false)
  expect(commerceView).toContain("commerce.credit_pending")
  expect(commerceView).toContain("commerce.free_core_notice")
  expect(commerceView).toContain("commerce.enterprise_admin_notice")

  evidence.fact(
    "RenCredit has one production source of truth",
    "The account center and API both read the organization wallet from the persistent MySQL ledger; the PR #7 memory ledger no longer exists.",
    true,
  )
})
