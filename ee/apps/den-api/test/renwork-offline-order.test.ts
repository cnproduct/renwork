import { beforeAll, expect, test } from "bun:test"

function seedRequiredEnv() {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "mysql://root:password@127.0.0.1:3306/openwork_test"
  process.env.DEN_DB_ENCRYPTION_KEY = process.env.DEN_DB_ENCRYPTION_KEY ?? "x".repeat(32)
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? "y".repeat(32)
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8790"
  process.env.DEN_API_PUBLIC_URL = process.env.DEN_API_PUBLIC_URL ?? "http://127.0.0.1:8790"
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? "http://localhost:3005"
}

let listOfflineOffers: typeof import("../src/renwork-offline-order.js")["listOfflineOffers"]
let resolveOfflineOffer: typeof import("../src/renwork-offline-order.js")["resolveOfflineOffer"]
let calculateOfflinePeriodEnd: typeof import("../src/renwork-offline-order.js")["calculateOfflinePeriodEnd"]

beforeAll(async () => {
  seedRequiredEnv()
  ;({ listOfflineOffers, resolveOfflineOffer, calculateOfflinePeriodEnd } = await import("../src/renwork-offline-order.js"))
})

test("monthly and annual terms clamp month-end dates", () => {
  expect(calculateOfflinePeriodEnd(new Date("2026-01-31T08:30:00.000Z"), "monthly").toISOString()).toBe("2026-02-28T08:30:00.000Z")
  expect(calculateOfflinePeriodEnd(new Date("2028-02-29T08:30:00.000Z"), "annual").toISOString()).toBe("2029-02-28T08:30:00.000Z")
})

test("offline activation exposes only fixed authoritative catalog offers", () => {
  const offers = listOfflineOffers()
  expect(offers.length).toBe(10)
  expect(offers.every((offer) => offer.currency === "CNY" && offer.priceMinor > 0 && offer.includedRenCredits > 0)).toBe(true)
  expect(offers.some((offer) => offer.planId === "enterprise-custom")).toBe(false)
})

test("offline activation derives price and RenCredit from the selected offer", () => {
  const offer = resolveOfflineOffer("personal-pro-monthly")
  expect(offer).toMatchObject({
    planId: "personal-pro",
    priceMinor: 13_900,
    includedRenCredits: 4_000,
    seatLimit: 1,
  })
  expect(() => resolveOfflineOffer("arbitrary-100-cny-topup")).toThrow("RENWORK_OFFLINE_OFFER_NOT_FOUND")
})
