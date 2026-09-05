import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function source(...parts: string[]) {
  return readFileSync(join(import.meta.dir, ...parts), "utf8")
}

describe("Voiceover V13 release governance", () => {
  test("keeps provider, device and RenCredit settlement operations behind the platform-admin allowlist", () => {
    const catalog = source("..", "src", "routes", "admin", "model-catalog.ts")
    const runtime = source("..", "src", "routes", "metered-runtime.ts")
    const rencredit = source("..", "src", "routes", "admin", "rencredit.ts")

    expect(catalog.match(/adminRoute\(\)/g)?.length).toBe(3)
    expect(runtime.match(/adminRoute\(\)/g)?.length).toBe(2)
    expect(rencredit.match(/adminRoute\(\)/g)?.length).toBe(2)
    expect(rencredit).toContain('"/v1/admin/rencredit/settlements"')
    expect(rencredit).toContain("RenCreditReservationTable.provider_id")
    expect(rencredit).toContain("RenCreditLedgerEntryTable.entry_type")
  })

  test("gives members a redacted catalog and limits organization policy to owners", () => {
    const memberCatalog = source("..", "src", "routes", "org", "model-catalog.ts")
    const ownerPolicy = source("..", "src", "routes", "org", "model-policy.ts")

    expect(memberCatalog).toContain('orgRoleRoute(["member"])')
    expect(memberCatalog).toContain("without provider, route, credential, or upstream model details")
    expect(ownerPolicy.match(/orgRoleRoute\(\["owner"\]\)/g)?.length).toBe(2)
  })

  test("keeps offline-paid local runtimes inside their purchased plan", () => {
    const runtime = source("..", "src", "routes", "metered-runtime.ts")
    expect(runtime).toContain('access.source === "subscription" || access.source === "offline_payment"')
  })

  test("does not let a desktop member or organization owner bypass cloud provider governance", () => {
    const desktopPolicy = source(
      "..", "..", "..", "..", "apps", "app", "src", "react-app", "domains", "connections", "provider-auth", "desktop-provider-management.ts",
    )
    const settings = source(
      "..", "..", "..", "..", "apps", "app", "src", "react-app", "shell", "settings-route.tsx",
    )

    expect(desktopPolicy).toContain("return false")
    expect(settings).toContain("canAddProviders={localProviderManagementAllowed")
    expect(settings).toContain("allowProviderManagement={localProviderManagementAllowed}")
  })
})
