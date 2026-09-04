import { beforeAll, expect, test } from "bun:test"

function seedRequiredEnv() {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:password@127.0.0.1:3306/openwork_test"
  process.env.DEN_DB_ENCRYPTION_KEY = process.env.DEN_DB_ENCRYPTION_KEY ?? "x".repeat(32)
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "y".repeat(32)
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8790"
  process.env.DEN_API_PUBLIC_URL = process.env.DEN_API_PUBLIC_URL ?? "http://127.0.0.1:8790"
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://localhost:3005"
}

let readRenworkAccessGrant: typeof import("../src/renwork-access.js")["readRenworkAccessGrant"]
let resolveRenworkModelAccessFromSources: typeof import("../src/renwork-access.js")["resolveRenworkModelAccessFromSources"]

beforeAll(async () => {
  seedRequiredEnv()
  ;({ readRenworkAccessGrant, resolveRenworkModelAccessFromSources } = await import("../src/renwork-access.js"))
})

test("temporary RenWork access grants are time-bound and model-scoped", () => {
  const now = new Date("2026-08-29T12:00:00.000Z")
  const grant = readRenworkAccessGrant({
    renworkAccessGrant: {
      status: "active",
      source: "super_admin",
      startsAt: "2026-08-29T00:00:00.000Z",
      expiresAt: "2026-08-30T00:00:00.000Z",
      modelSkus: ["renwork-standard", "renwork-standard"],
      reason: "Customer acceptance test",
      grantedBy: "user_admin",
    },
  }, now)
  expect(grant?.modelSkus).toEqual(["renwork-standard"])
  expect(grant?.source).toBe("super_admin")
})

test("expired, future, and malformed grants fail closed", () => {
  const now = new Date("2026-08-29T12:00:00.000Z")
  const base = {
    status: "active",
    source: "campaign",
    startsAt: "2026-08-29T00:00:00.000Z",
    expiresAt: "2026-08-30T00:00:00.000Z",
    modelSkus: null,
    reason: "Launch campaign",
    grantedBy: "user_admin",
  }
  expect(readRenworkAccessGrant({ renworkAccessGrant: { ...base, expiresAt: "2026-08-29T11:59:59.000Z" } }, now)).toBeNull()
  expect(readRenworkAccessGrant({ renworkAccessGrant: { ...base, startsAt: "2026-08-29T13:00:00.000Z" } }, now)).toBeNull()
  expect(readRenworkAccessGrant({ renworkAccessGrant: { ...base, modelSkus: [] } }, now)).toBeNull()
})

test("an approved temporary grant unlocks the same organization access gate as a subscription", () => {
  const access = resolveRenworkModelAccessFromSources({
    hasActiveSubscription: false,
    now: new Date("2026-08-29T12:00:00.000Z"),
    metadata: {
      renworkAccessGrant: {
        status: "active",
        source: "super_admin",
        startsAt: "2026-08-29T00:00:00.000Z",
        expiresAt: "2026-08-30T00:00:00.000Z",
        modelSkus: ["renwork-standard"],
        reason: "Approved plan request",
        grantedBy: "user_admin",
      },
    },
  })

  expect(access).toEqual({
    allowed: true,
    source: "super_admin",
    expiresAt: "2026-08-30T00:00:00.000Z",
    allowedModelSkus: ["renwork-standard"],
  })
})

test("an unexpired offline payment grant enables access and expires closed", () => {
  const metadata = {
    renworkAccessGrant: {
      status: "active",
      source: "offline_payment",
      startsAt: "2026-09-03T00:00:00.000Z",
      expiresAt: "2026-10-03T00:00:00.000Z",
      modelSkus: null,
      reason: "Offline payment receipt RW-1001",
      grantedBy: "usr_admin",
      orderId: "rwoo_order",
    },
  }
  expect(resolveRenworkModelAccessFromSources({ hasActiveSubscription: false, metadata, now: new Date("2026-09-04T00:00:00.000Z") }).source).toBe("offline_payment")
  expect(resolveRenworkModelAccessFromSources({ hasActiveSubscription: false, metadata, now: new Date("2026-10-03T00:00:00.000Z") }).allowed).toBe(false)
})
