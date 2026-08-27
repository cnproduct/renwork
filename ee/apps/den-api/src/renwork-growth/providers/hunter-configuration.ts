export type HunterProviderMode = "disabled" | "hunter_single_tenant" | "hunter_official_pool"

export type HunterProviderConfiguration = {
  mode: HunterProviderMode
  apiKey: string | undefined
  identitySecret: string | undefined
  allowedOrganizationId: string | undefined
  officialPoolLicensed: boolean
}

export type HunterProviderAccess =
  | {
    enabled: true
    apiKey: string
    identitySecret: string
  }
  | {
    enabled: false
    reason: "disabled" | "credentials_missing" | "organization_not_authorized" | "license_unavailable"
  }

export function resolveHunterProviderAccess(
  config: HunterProviderConfiguration,
  organizationId: string,
): HunterProviderAccess {
  if (config.mode === "disabled") return { enabled: false, reason: "disabled" }
  const apiKey = config.apiKey?.trim()
  const identitySecret = config.identitySecret?.trim()
  if (!apiKey || !identitySecret) return { enabled: false, reason: "credentials_missing" }

  if (config.mode === "hunter_single_tenant") {
    if (!config.allowedOrganizationId || config.allowedOrganizationId !== organizationId) {
      return { enabled: false, reason: "organization_not_authorized" }
    }
  }

  if (config.mode === "hunter_official_pool" && !config.officialPoolLicensed) {
    return { enabled: false, reason: "license_unavailable" }
  }

  return { enabled: true, apiKey, identitySecret }
}
