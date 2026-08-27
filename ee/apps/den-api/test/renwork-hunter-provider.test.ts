import { expect, test } from "bun:test"
import { HunterBuyerSearchService } from "../src/renwork-growth/hunter-buyer-search-service.js"
import { resolveHunterProviderAccess } from "../src/renwork-growth/providers/hunter-configuration.js"
import {
  HunterProviderError,
  HunterRestAdapter,
  type HunterProviderErrorCode,
} from "../src/renwork-growth/providers/hunter.js"

type RecordedRequest = {
  url: string
  authorization: string | null
  body: string | null
}

type QueuedResponse = {
  status?: number
  headers?: Record<string, string>
  body: unknown
}

function requestUrl(input: string | URL | Request): URL {
  if (input instanceof URL) return input
  if (input instanceof Request) return new URL(input.url)
  return new URL(input)
}

function queuedFetch(responses: QueuedResponse[], requests: RecordedRequest[]): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    requests.push({
      url: requestUrl(input).toString(),
      authorization: headers.get("authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    })
    const response = responses.shift()
    if (!response) throw new Error("unexpected_provider_request")
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json", ...response.headers },
    })
  }
}

function providerResponses(): QueuedResponse[] {
  return [
    {
      body: {
        data: [{
          domain: "example-import.test",
          organization: "Example Import GmbH",
          emails_count: { personal: 3, generic: 1, total: 4 },
        }],
        meta: { results: 1 },
      },
    },
    {
      body: {
        data: [{
          reveal_handle: "opaque-provider-handle",
          name: "Alex M.",
          position: "Purchasing Director",
          department: "executive",
          seniority: "executive",
          type: "personal",
          decision_maker: true,
          domain: "example-import.test",
          company_name: "Example Import GmbH",
          full_name_exists: true,
          phone_number_exists: true,
          linkedin_exists: true,
          verification: { date: "2026-08-25", status: "valid" },
        }],
        meta: { results: 1, next_search_after: null },
      },
    },
  ]
}

function searchInput() {
  return {
    product: "sanitary products",
    market: "Germany",
    customerType: "importers and distributors",
    maxCompanies: 10,
    maxContacts: 30,
  }
}

async function expectProviderError(run: Promise<unknown>, code: HunterProviderErrorCode) {
  try {
    await run
    throw new Error(`Expected ${code}`)
  } catch (error) {
    expect(error).toBeInstanceOf(HunterProviderError)
    if (error instanceof HunterProviderError) expect(error.code).toBe(code)
  }
}

test("Hunter search uses server-side bearer auth and returns only masked contact metadata", async () => {
  const requests: RecordedRequest[] = []
  const adapter = new HunterRestAdapter({
    apiKey: "server-only-key",
    fetch: queuedFetch(providerResponses(), requests),
    baseUrl: "https://hunter.test/v2/",
    now: () => new Date("2026-08-26T18:00:00.000Z"),
  })

  const result = await adapter.searchMaskedBuyers(searchInput())

  expect(requests).toHaveLength(2)
  expect(requests.every((request) => request.authorization === "Bearer server-only-key")).toBe(true)
  expect(requests.every((request) => !request.url.includes("api_key"))).toBe(true)
  expect(requests[0]?.body).toContain("sanitary products")
  expect(requests[1]?.url).toContain("multi-domain-search")
  expect(requests[1]?.url).toContain("decision_maker=true")
  expect(result.companies[0]?.contacts[0]).toMatchObject({
    maskedName: "Alex M.",
    role: "Purchasing Director",
    verifiedEmailAvailable: true,
  })
  expect(JSON.stringify(result)).not.toContain("alex@example-import.test")
})

test("RenWork search response hides the provider reference and preserves tenant-scoped lookup", async () => {
  const adapter = new HunterRestAdapter({
    apiKey: "server-only-key",
    fetch: queuedFetch(providerResponses(), []),
    baseUrl: "https://hunter.test/v2/",
    now: () => new Date("2026-08-26T18:00:00.000Z"),
  })
  const service = new HunterBuyerSearchService(adapter, "identity-secret-longer-than-thirty-two-characters")
  const response = await service.search({
    organizationId: "org-1",
    request: {
      product: "sanitary products",
      market: "Germany",
      customerType: "importers and distributors",
      workspaceId: "workspace-1",
    },
  })
  const company = response.companies[0]
  const contact = company?.contacts[0]
  if (!company || !contact) throw new Error("expected a masked contact")

  expect(response.charge).toBe("free")
  expect(company.evidence.map((item) => item.grade)).toEqual(["E1", "E2"])
  expect(company.riskFlags.join(" ")).toContain("不证明采购或交易事实")
  expect(JSON.stringify(response)).not.toContain("opaque-provider-handle")
  expect(service.resolveContact({
    organizationId: "org-1",
    workspaceId: "workspace-1",
    companyId: company.companyId,
    contactId: contact.contactId,
  })?.providerReference).toBe("opaque-provider-handle")
  expect(service.resolveContact({
    organizationId: "org-2",
    workspaceId: "workspace-1",
    companyId: company.companyId,
    contactId: contact.contactId,
  })).toBeNull()
})

test("Hunter reveal reconciles authoritative provider cost and duplicate outcomes", async () => {
  const requests: RecordedRequest[] = []
  const adapter = new HunterRestAdapter({
    apiKey: "server-only-key",
    fetch: queuedFetch([{
      body: {
        data: [{
          reveal_handle: "opaque-provider-handle",
          email: "alex@example-import.test",
          first_name: "Alex",
          last_name: "Morgan",
          position: "Purchasing Director",
          phone_number: null,
          linkedin_url: "https://www.linkedin.com/in/example",
          type: "personal",
          domain: "example-import.test",
          outcome: "already_revealed",
        }],
        meta: {
          credits_charged: 0,
          handles: [{ handle: "opaque-provider-handle", outcome: "already_revealed" }],
        },
      },
    }], requests),
    baseUrl: "https://hunter.test/v2/",
  })

  const result = await adapter.revealContacts(["opaque-provider-handle"])

  expect(requests[0]?.body).toBe(JSON.stringify({ handles: ["opaque-provider-handle"] }))
  expect(result.providerCreditsCharged).toBe(0)
  expect(result.contacts[0]?.outcome).toBe("already_revealed")
  expect(result.contacts[0]?.email).toBe("alex@example-import.test")
})

const errorCases: Array<{ status: number; code: HunterProviderErrorCode }> = [
  { status: 401, code: "authentication_failed" },
  { status: 403, code: "rate_limited" },
  { status: 429, code: "usage_limit" },
  { status: 451, code: "privacy_stop" },
  { status: 500, code: "upstream_failure" },
]

for (const errorCase of errorCases) {
  test(`Hunter HTTP ${errorCase.status} maps to ${errorCase.code}`, async () => {
    const adapter = new HunterRestAdapter({
      apiKey: "server-only-key",
      fetch: queuedFetch([{
        status: errorCase.status,
        body: { errors: [{ id: "provider_error", code: errorCase.status, details: "not exposed" }] },
      }], []),
      baseUrl: "https://hunter.test/v2/",
    })
    await expectProviderError(adapter.searchMaskedBuyers(searchInput()), errorCase.code)
  })
}

test("Hunter timeout and malformed success responses fail closed", async () => {
  const slowFetch: typeof fetch = (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
  })
  const timedAdapter = new HunterRestAdapter({
    apiKey: "server-only-key",
    fetch: slowFetch,
    baseUrl: "https://hunter.test/v2/",
    timeoutMs: 5,
  })
  await expectProviderError(timedAdapter.searchMaskedBuyers(searchInput()), "timeout")

  const malformedAdapter = new HunterRestAdapter({
    apiKey: "server-only-key",
    fetch: queuedFetch([{ body: { data: "not-an-array" } }], []),
    baseUrl: "https://hunter.test/v2/",
  })
  await expectProviderError(malformedAdapter.searchMaskedBuyers(searchInput()), "invalid_response")
})

test("provider configuration is disabled, tenant-scoped, and license-gated by default", () => {
  expect(resolveHunterProviderAccess({
    mode: "disabled",
    apiKey: "secret",
    identitySecret: "identity",
    allowedOrganizationId: undefined,
    officialPoolLicensed: false,
  }, "org-1")).toEqual({ enabled: false, reason: "disabled" })
  expect(resolveHunterProviderAccess({
    mode: "hunter_single_tenant",
    apiKey: undefined,
    identitySecret: "identity",
    allowedOrganizationId: "org-1",
    officialPoolLicensed: false,
  }, "org-1")).toEqual({ enabled: false, reason: "credentials_missing" })
  expect(resolveHunterProviderAccess({
    mode: "hunter_single_tenant",
    apiKey: "secret",
    identitySecret: "identity",
    allowedOrganizationId: "org-1",
    officialPoolLicensed: false,
  }, "org-2")).toEqual({ enabled: false, reason: "organization_not_authorized" })
  expect(resolveHunterProviderAccess({
    mode: "hunter_official_pool",
    apiKey: "secret",
    identitySecret: "identity",
    allowedOrganizationId: undefined,
    officialPoolLicensed: false,
  }, "org-1")).toEqual({ enabled: false, reason: "license_unavailable" })
})
