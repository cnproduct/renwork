import { beforeAll, describe, expect, test } from "bun:test"

let getRenworkPlanCatalog: typeof import("../src/renwork-growth/plan-catalog.js")["getRenworkPlanCatalog"]
let findRequestableRenworkOffer: typeof import("../src/renwork-subscription-request.js")["findRequestableRenworkOffer"]
let readRenworkSubscriptionRequest: typeof import("../src/renwork-subscription-request.js")["readRenworkSubscriptionRequest"]

beforeAll(async () => {
  process.env.DATABASE_URL ??= "mysql://root:password@127.0.0.1:3306/openwork_test"
  process.env.DEN_DB_ENCRYPTION_KEY ??= "x".repeat(32)
  process.env.BETTER_AUTH_SECRET ??= "y".repeat(32)
  process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:8790"
  process.env.DEN_API_PUBLIC_URL ??= "http://127.0.0.1:8790"
  process.env.CORS_ORIGINS ??= "http://localhost:3005"
  ;({ getRenworkPlanCatalog } = await import("../src/renwork-growth/plan-catalog.js"))
  ;({ findRequestableRenworkOffer, readRenworkSubscriptionRequest } = await import("../src/renwork-subscription-request.js"))
})

describe("RenWork subscription requests", () => {
  test("accepts only offers from the authoritative request catalog", () => {
    const catalog = getRenworkPlanCatalog()
    const selected = findRequestableRenworkOffer(catalog, "personal-pro-annual")
    expect(selected?.plan.id).toBe("personal-pro")
    expect(selected?.offer.purchaseMode).toBe("request_access")
    expect(findRequestableRenworkOffer(catalog, "missing-offer")).toBeNull()
  })

  test("reads a durable pending request and rejects malformed metadata", () => {
    const request = readRenworkSubscriptionRequest({
      renworkSubscriptionRequest: {
        id: "rwreq_test",
        status: "pending",
        catalogVersion: "catalog-v1",
        planId: "personal-pro",
        offerId: "personal-pro-annual",
        requestedBy: "usr_test",
        requestedAt: "2026-08-29T12:00:00.000Z",
      },
    })
    expect(request?.offerId).toBe("personal-pro-annual")
    expect(readRenworkSubscriptionRequest({ renworkSubscriptionRequest: { status: "pending" } })).toBeNull()
  })
})
