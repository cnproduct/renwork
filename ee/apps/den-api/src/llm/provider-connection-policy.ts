const RENWORK_MEMBER_GATEWAY_PROVIDER_ID = "renwork"
const RENWORK_MEMBER_GATEWAY_SOURCE = "openwork"

export function isMemberConnectableProvider(provider: { providerId: string; source: string }) {
  return provider.providerId === RENWORK_MEMBER_GATEWAY_PROVIDER_ID
    && provider.source === RENWORK_MEMBER_GATEWAY_SOURCE
}
