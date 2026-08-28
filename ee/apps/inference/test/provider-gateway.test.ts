import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createOpenRouterProviderAdapter,
  createRenWorkProviderGateway,
  type ProviderGatewayAdapter,
} from "../src/provider-gateway.js"

test("routes a model request through the registered provider adapter", async () => {
  const gateway = createRenWorkProviderGateway([
    createOpenRouterProviderAdapter({
      baseUrl: "https://provider.example/v1/",
      async resolveCredential(organizationId) {
        assert.equal(organizationId, "org_123")
        return { encrypted_api_key: "server-only-secret" }
      },
    }),
  ])

  assert.deepEqual(gateway.listProviderIds(), ["openrouter"])
  const result = await gateway.route({
    organizationId: "org_123",
    providerId: "openrouter",
    upstreamPath: "/chat/completions",
  })

  assert.equal(result.ok, true)
  if (!result.ok) throw new Error("Expected a provider route")
  assert.equal(result.route.providerId, "openrouter")
  assert.equal(result.route.upstreamUrl.toString(), "https://provider.example/v1/chat/completions")
  assert.equal(result.route.apiKey, "server-only-secret")
})

test("returns a typed failure when the organization has no provider credential", async () => {
  const gateway = createRenWorkProviderGateway([
    createOpenRouterProviderAdapter({
      baseUrl: "https://provider.example/v1",
      async resolveCredential() {
        return null
      },
    }),
  ])

  assert.deepEqual(await gateway.route({
    organizationId: "org_123",
    providerId: "openrouter",
    upstreamPath: "/chat/completions",
  }), {
    ok: false,
    code: "provider_credential_missing",
    providerId: "openrouter",
  })
})

test("rejects unregistered providers before any adapter can run", async () => {
  let called = false
  const adapter: ProviderGatewayAdapter = {
    id: "registered",
    async route() {
      called = true
      return null
    },
  }
  const gateway = createRenWorkProviderGateway([adapter])

  assert.deepEqual(await gateway.route({
    organizationId: "org_123",
    providerId: "unknown",
    upstreamPath: "/chat/completions",
  }), {
    ok: false,
    code: "provider_not_registered",
    providerId: "unknown",
  })
  assert.equal(called, false)
})
