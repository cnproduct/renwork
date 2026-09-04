import { beforeAll, expect, test } from "bun:test"
import { renworkPlanCatalogSchema } from "@openwork/types/renwork-commerce"

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

test("the public RenWork commerce route returns the authoritative catalog", async () => {
  const response = await app.request("/v1/renwork/commerce/catalog")

  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("public, max-age=60, stale-if-error=300")
  const catalog = renworkPlanCatalogSchema.parse(await response.json())
  expect(catalog.catalogVersion).toBe("renwork-subscription-v15-2026-09-04.1")
  expect(catalog.plans.length).toBeGreaterThan(0)
})
