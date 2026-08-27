import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const commerceViewPath = join(repositoryRoot, "apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx")
const denClientPath = join(repositoryRoot, "apps/app/src/app/lib/den.ts")
const settingsRoutePath = join(repositoryRoot, "apps/app/src/react-app/shell/settings-route.tsx")
const catalogRoutePath = join(repositoryRoot, "ee/apps/den-api/src/routes/renwork-commerce/index.ts")

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

test("pilot UI separates subscription from RenCredit without inventing checkout or balance", async ({ evidence }) => {
  const commerceView = source(commerceViewPath)

  expect(commerceView).toContain('data-testid="rencredit-balance-unavailable"')
  expect(commerceView).toContain("commerce.credit_pending")
  expect(commerceView).toContain("commerce.free_core_notice")
  expect(commerceView).toContain("commerce.enterprise_admin_notice")
  expect(commerceView).not.toMatch(/balance:\s*[1-9]\d*|includedRenCredits:\s*[1-9]\d*/)

  evidence.fact(
    "The pilot surface is commercially honest",
    "Subscription and RenCredit are separate, the balance remains unavailable until the entitlement service is real, and the local free core is explicit.",
    true,
  )
})
