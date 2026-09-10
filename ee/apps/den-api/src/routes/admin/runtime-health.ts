export type RuntimeHealthStatus = "healthy" | "warning" | "critical" | "idle"

function numericVersion(version: string | null) {
  if (!version) return null
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim().replace(/^v/, ""))
  if (!match) return null
  return match.slice(1).map((part) => Number(part)) as [number, number, number]
}

export function compareClientVersions(left: string | null, right: string) {
  const leftParts = numericVersion(left)
  const rightParts = numericVersion(right)
  if (!leftParts || !rightParts) return null
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index]! - rightParts[index]!
  }
  return 0
}

export function classifyClientVersion(version: string | null, currentVersion: string) {
  const comparison = compareClientVersions(version, currentVersion)
  if (comparison === null) return "unknown" as const
  if (comparison < 0) return "outdated" as const
  if (comparison > 0) return "ahead" as const
  return "current" as const
}

export function runtimeHealthStatus(input: {
  hasWallet: boolean
  walletStatus: string | null
  activeDevices: number
  reservations24h: number
  expiredReservations: number
  failureRate24h: number
  outdatedDevices: number
  unknownVersionDevices: number
}): RuntimeHealthStatus {
  if (input.expiredReservations > 0 || input.walletStatus === "suspended") return "critical"
  if (!input.hasWallet && input.activeDevices === 0 && input.reservations24h === 0) return "idle"
  if (input.failureRate24h >= 0.2 || input.outdatedDevices > 0 || input.unknownVersionDevices > 0) return "warning"
  return "healthy"
}
