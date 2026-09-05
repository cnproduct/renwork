import { beforeAll, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const route = readFileSync(join(import.meta.dir, "..", "src", "routes", "org", "model-catalog.ts"), "utf8")
const orgRoutes = readFileSync(join(import.meta.dir, "..", "src", "routes", "org", "index.ts"), "utf8")
const inferenceProvisioning = readFileSync(join(import.meta.dir, "..", "src", "inference.ts"), "utf8")
const client = readFileSync(join(import.meta.dir, "..", "..", "..", "..", "apps", "app", "src", "app", "lib", "den.ts"), "utf8")

function seedRequiredEnv() {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:password@127.0.0.1:3306/openwork_test"
  process.env.DEN_DB_ENCRYPTION_KEY = process.env.DEN_DB_ENCRYPTION_KEY ?? "x".repeat(32)
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "y".repeat(32)
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8790"
  process.env.DEN_API_PUBLIC_URL = process.env.DEN_API_PUBLIC_URL ?? "http://127.0.0.1:8790"
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://localhost:3005"
}

let app: typeof import("../src/app.js")["default"]

beforeAll(async () => {
  seedRequiredEnv()
  app = (await import("../src/app.js")).default
})

describe("RenWork member model catalog route", () => {
  test("registers the desktop contract for every organization member", () => {
    expect(orgRoutes).toContain("registerOrgModelCatalogRoutes(app)")
    expect(route).toContain('"/v1/models/catalog"')
    expect(route).toContain('orgRoleRoute(["member"])')
    expect(client).toContain('"/v1/models/catalog"')
  })

  test("rejects an unauthenticated catalog request", async () => {
    const response = await app.request("/v1/models/catalog", {
      headers: { "x-openwork-org-id": "org_01j00000000000000000000000" },
    })
    expect(response.status).toBe(401)
  })

  test("uses paid plan filters for subscriptions and offline payments, or a scoped temporary grant", () => {
    expect(route).toContain('access.source === "subscription" || access.source === "offline_payment"')
    expect(route).toContain('"offline_payment"')
    expect(route).toContain("parseOrganizationPlan(organization.metadata).tier")
    expect(route).toContain("toPublicModelCatalogForPlan(parsed.data, parseOrganizationPlan(organization.metadata).tier)")
    expect(route).toContain("toPublicModelCatalog(parsed.data)")
    expect(route).toContain("access.allowedModelSkus")
    expect(route).not.toContain("parsed.data.providers")
    expect(route).not.toContain("credentialRef")
    expect(route).not.toContain("upstreamModelId")
    expect(route).not.toContain("baseUrl")
  })

  test("fails closed when the authoritative catalog is unavailable or inactive", () => {
    expect(route).toContain("MODEL_CATALOG_UNAVAILABLE")
    expect(route).toContain("MODEL_CATALOG_INVALID_RESPONSE")
    expect(route).toContain("MODEL_CATALOG_NOT_ACTIVE")
    expect(route).toContain('"Cache-Control", "private, no-store"')
  })

  test("provisions desktop RenWork models from the same authoritative member-safe catalog", () => {
    expect(inferenceProvisioning).toContain('requestModelCatalog("/v1/admin/models/catalog")')
    expect(inferenceProvisioning).toContain("toPublicModelCatalogForPlan")
    expect(inferenceProvisioning).toContain("readOrganizationModelPolicy")
    expect(inferenceProvisioning).toContain("access.allowedModelSkus")
    expect(inferenceProvisioning).toContain("modelId: model.sku")
    expect(inferenceProvisioning).not.toContain("Object.entries(RENWORK_MODEL_CATALOG)")
  })
})
