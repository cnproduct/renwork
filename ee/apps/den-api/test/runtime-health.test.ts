import { describe, expect, test } from "bun:test"
import { classifyClientVersion, compareClientVersions, runtimeHealthStatus } from "../src/routes/admin/runtime-health.js"

describe("RenCredit runtime fleet health", () => {
  test("classifies semantic desktop versions without trusting malformed input", () => {
    expect(compareClientVersions("0.18.62", "0.18.62")).toBe(0)
    expect(classifyClientVersion("0.18.61", "0.18.62")).toBe("outdated")
    expect(classifyClientVersion("0.18.63", "0.18.62")).toBe("ahead")
    expect(classifyClientVersion(null, "0.18.62")).toBe("unknown")
    expect(classifyClientVersion("not-a-version", "0.18.62")).toBe("unknown")
  })

  test("makes expired reservations and suspended wallets critical", () => {
    const base = { hasWallet: true, walletStatus: "active", activeDevices: 1, reservations24h: 1, expiredReservations: 0, failureRate24h: 0, outdatedDevices: 0, unknownVersionDevices: 0 }
    expect(runtimeHealthStatus(base)).toBe("healthy")
    expect(runtimeHealthStatus({ ...base, expiredReservations: 1 })).toBe("critical")
    expect(runtimeHealthStatus({ ...base, walletStatus: "suspended" })).toBe("critical")
  })

  test("warns on failure rate and version drift while leaving unused organizations idle", () => {
    const base = { hasWallet: true, walletStatus: "active", activeDevices: 1, reservations24h: 5, expiredReservations: 0, failureRate24h: 0, outdatedDevices: 0, unknownVersionDevices: 0 }
    expect(runtimeHealthStatus({ ...base, failureRate24h: 0.2 })).toBe("warning")
    expect(runtimeHealthStatus({ ...base, outdatedDevices: 1 })).toBe("warning")
    expect(runtimeHealthStatus({ ...base, unknownVersionDevices: 1 })).toBe("warning")
    expect(runtimeHealthStatus({ ...base, hasWallet: false, activeDevices: 0, reservations24h: 0 })).toBe("idle")
  })
})
