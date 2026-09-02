type MetadataInput = Record<string, unknown> | string | null | undefined

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : null
}

function metadataRecord(input: MetadataInput) {
  if (typeof input !== "string") return record(input) ?? {}
  try {
    return record(JSON.parse(input)) ?? {}
  } catch {
    return {}
  }
}

/**
 * A public, multi-tenant supplier route is never enabled from an API key
 * alone. Operations must separately confirm written commercial authorization,
 * and the organization must be explicitly included in the gray rollout.
 */
export function organizationMinimaxH3VideoEnabled(
  metadata: MetadataInput,
  environment: NodeJS.ProcessEnv = process.env,
) {
  if (environment.RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED !== "true") {
    return false
  }
  if (!environment.RENWORK_METASO_H3_API_KEY?.trim()) {
    return false
  }
  const price = Number(environment.RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND)
  const priceVersion = environment.RENWORK_H3_PRICE_VERSION?.trim()
  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    price > Math.floor(Number.MAX_SAFE_INTEGER / 8) ||
    !priceVersion ||
    priceVersion.length > 128
  ) {
    return false
  }
  if (!(environment.RENWORK_METASO_H3_RESULT_HOSTS ?? "").split(",").some((host) => host.trim())) {
    return false
  }
  const capabilities = record(metadataRecord(metadata).capabilities)
  return capabilities?.minimaxH3Video === true
}
