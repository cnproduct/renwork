import { RENWORK_MODEL_CATALOG } from "@openwork/types/den/inference"

export const RENWORK_MANAGED_PROVIDER_ID = "renwork"
export const RENWORK_LEGACY_MANAGED_PROVIDER_IDS = ["openwork"] as const
export const RENWORK_DEFAULT_GATEWAY_PROVIDER_ID = "openrouter"

export type ModelCatalogEntry = {
  alias: string
  upstreamModel: string
  displayName: string
  enabled: boolean
  usageFactor: number
  gatewayProviderId: string
}

const models: ModelCatalogEntry[] = Object.entries(RENWORK_MODEL_CATALOG).map(([alias, model]) => ({
  alias,
  upstreamModel: model.upstreamModel,
  displayName: model.displayName,
  enabled: model.enabled,
  usageFactor: model.usageFactor,
  gatewayProviderId: RENWORK_DEFAULT_GATEWAY_PROVIDER_ID,
}))

const enabledModels = models.filter((model) => model.enabled)

export function resolveModelAlias(alias: string) {
  const providerIds = [RENWORK_MANAGED_PROVIDER_ID, ...RENWORK_LEGACY_MANAGED_PROVIDER_IDS]
  const prefix = providerIds.find((providerId) => alias.startsWith(`${providerId}/`))
  const normalizedAlias = prefix ? alias.slice(prefix.length + 1) : alias
  return enabledModels.find((model) => model.alias === normalizedAlias) ?? null
}

export function resolveModelByUpstreamModel(upstreamModel: string) {
  return enabledModels.find((model) => model.upstreamModel === upstreamModel) ?? null
}

export function listModelCatalog() {
  return enabledModels
}
