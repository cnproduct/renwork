export type ProviderGatewayCredential = {
  encrypted_api_key: string
}

export type ProviderGatewayRoute = {
  providerId: string
  upstreamUrl: URL
  apiKey: string
}

export type ProviderGatewayRouteResult =
  | { ok: true; route: ProviderGatewayRoute }
  | { ok: false; code: "provider_not_registered" | "provider_credential_missing"; providerId: string }

export type ProviderGatewayAdapter = {
  id: string
  route(input: { organizationId: string; upstreamPath: string }): Promise<ProviderGatewayRoute | null>
}

export type RenWorkProviderGateway = {
  route(input: {
    organizationId: string
    providerId: string
    upstreamPath: string
  }): Promise<ProviderGatewayRouteResult>
  listProviderIds(): string[]
}

export function createRenWorkProviderGateway(adapters: readonly ProviderGatewayAdapter[]): RenWorkProviderGateway {
  const adapterById = new Map(adapters.map((adapter) => [adapter.id, adapter]))

  return {
    async route(input) {
      const adapter = adapterById.get(input.providerId)
      if (!adapter) {
        return { ok: false, code: "provider_not_registered", providerId: input.providerId }
      }

      const route = await adapter.route({
        organizationId: input.organizationId,
        upstreamPath: input.upstreamPath,
      })
      if (!route) {
        return { ok: false, code: "provider_credential_missing", providerId: input.providerId }
      }
      return { ok: true, route }
    },

    listProviderIds() {
      return [...adapterById.keys()].sort()
    },
  }
}

export function createOpenRouterProviderAdapter(input: {
  baseUrl: string
  resolveCredential(organizationId: string): Promise<ProviderGatewayCredential | null>
}): ProviderGatewayAdapter {
  const baseUrl = input.baseUrl.replace(/\/+$/, "")

  return {
    id: "openrouter",
    async route(routeInput) {
      const credential = await input.resolveCredential(routeInput.organizationId)
      if (!credential) return null

      return {
        providerId: "openrouter",
        upstreamUrl: new URL(`${baseUrl}${routeInput.upstreamPath}`),
        apiKey: credential.encrypted_api_key,
      }
    },
  }
}
