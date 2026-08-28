import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const route = readFileSync(join(import.meta.dir, "..", "src", "routes", "admin", "model-catalog.ts"), "utf8")
const env = readFileSync(join(import.meta.dir, "..", "src", "env.ts"), "utf8")

describe("RenWork model catalog admin proxy", () => {
  test("requires the platform-admin middleware on every browser-facing operation", () => {
    expect(route.match(/adminRoute\(\)/g)?.length).toBe(3)
    expect(route).toContain('"/v1/admin/model-catalog"')
    expect(route).toContain('"/v1/admin/model-catalog/providers/:providerId/test"')
  })

  test("keeps the upstream token in Den API environment configuration", () => {
    expect(env).toContain("RENWORK_MODEL_CATALOG_ADMIN_TOKEN")
    expect(route).toContain("Authorization: `Bearer ${config.token}`")
    expect(route).not.toContain("NEXT_PUBLIC_RENWORK_MODEL_CATALOG")
  })

  test("validates catalogs and returns only a projected member preview", () => {
    expect(route).toContain("validateAdminModelCatalog(parsedBody.data.catalog)")
    expect(route).toContain("toPublicModelCatalog(parsedCatalog.data)")
  })
})
