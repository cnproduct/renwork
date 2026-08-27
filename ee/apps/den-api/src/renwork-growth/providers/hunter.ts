import { z } from "zod"

const hunterSearchInputSchema = z.object({
  product: z.string().trim().min(2).max(240),
  market: z.string().trim().min(2).max(160),
  customerType: z.string().trim().min(2).max(240),
  maxCompanies: z.number().int().min(1).max(20).default(10),
  maxContacts: z.number().int().min(1).max(100).default(30),
})

const hunterDomainSchema = z.string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i)

const hunterDiscoverResponseSchema = z.object({
  data: z.array(z.object({
    domain: hunterDomainSchema,
    organization: z.string().trim().min(1),
    emails_count: z.object({
      personal: z.number().int().nonnegative(),
      generic: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }).optional(),
  })),
})

const hunterMaskedContactSchema = z.object({
  reveal_handle: z.string().trim().min(1),
  name: z.string().trim().min(1).nullable().optional(),
  position: z.string().trim().min(1).nullable().optional(),
  department: z.string().trim().min(1).nullable().optional(),
  seniority: z.string().trim().min(1).nullable().optional(),
  type: z.enum(["personal", "generic"]),
  decision_maker: z.boolean(),
  domain: hunterDomainSchema,
  company_name: z.string().trim().min(1).nullable().optional(),
  full_name_exists: z.boolean(),
  phone_number_exists: z.boolean(),
  linkedin_exists: z.boolean(),
  verification: z.object({
    date: z.string().trim().min(1).nullable(),
    status: z.string().trim().min(1),
  }),
})

const hunterMultiDomainResponseSchema = z.object({
  data: z.array(hunterMaskedContactSchema),
  meta: z.object({
    results: z.number().int().nonnegative(),
    next_search_after: z.string().trim().min(1).nullable().optional(),
  }),
})

const hunterRevealOutcomeSchema = z.enum([
  "revealed",
  "already_revealed",
  "not_found",
  "insufficient_credits",
])

const hunterRevealResponseSchema = z.object({
  data: z.array(z.object({
    reveal_handle: z.string().trim().min(1),
    email: z.string().email().nullable(),
    first_name: z.string().trim().min(1).nullable().optional(),
    last_name: z.string().trim().min(1).nullable().optional(),
    position: z.string().trim().min(1).nullable().optional(),
    phone_number: z.string().trim().min(1).nullable().optional(),
    linkedin_url: z.string().url().nullable().optional(),
    type: z.enum(["personal", "generic"]),
    domain: hunterDomainSchema,
    outcome: hunterRevealOutcomeSchema,
  })).default([]),
  meta: z.object({
    credits_charged: z.number().nonnegative(),
    handles: z.array(z.object({
      handle: z.string().trim().min(1),
      outcome: hunterRevealOutcomeSchema,
    })),
  }),
})

const revealInputSchema = z.array(z.string().trim().min(1)).min(1).max(100)

export type HunterProviderErrorCode =
  | "authentication_failed"
  | "rate_limited"
  | "usage_limit"
  | "privacy_stop"
  | "invalid_request"
  | "not_found"
  | "upstream_failure"
  | "timeout"
  | "invalid_response"

export class HunterProviderError extends Error {
  constructor(
    readonly code: HunterProviderErrorCode,
    readonly statusCode: number | null,
    readonly retryAfterSeconds: number | null,
  ) {
    super(code)
    this.name = "HunterProviderError"
  }
}

export type HunterMaskedContact = {
  providerReference: string
  maskedName: string
  role: string
  department: string | null
  seniority: string | null
  decisionMaker: boolean
  verifiedEmailAvailable: boolean
  phoneExists: boolean
  linkedInExists: boolean
  verificationStatus: string
  verificationDate: string | null
}

export type HunterBuyerCompany = {
  domain: string
  organization: string
  indexedEmailCount: number | null
  contacts: HunterMaskedContact[]
}

export type HunterMaskedBuyerSearchResult = {
  generatedAt: string
  companies: HunterBuyerCompany[]
}

export type HunterRevealedContact = {
  providerReference: string
  email: string | null
  firstName: string | null
  lastName: string | null
  role: string | null
  phone: string | null
  linkedInUrl: string | null
  domain: string
  outcome: z.infer<typeof hunterRevealOutcomeSchema>
}

export type HunterRevealResult = {
  contacts: HunterRevealedContact[]
  providerCreditsCharged: number
  outcomes: Array<{
    providerReference: string
    outcome: z.infer<typeof hunterRevealOutcomeSchema>
  }>
}

type HunterRestAdapterOptions = {
  apiKey: string
  fetch?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  now?: () => Date
}

function mappedErrorCode(status: number): HunterProviderErrorCode {
  if (status === 400 || status === 422) return "invalid_request"
  if (status === 401) return "authentication_failed"
  if (status === 403) return "rate_limited"
  if (status === 404) return "not_found"
  if (status === 429) return "usage_limit"
  if (status === 451) return "privacy_stop"
  return "upstream_failure"
}

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("retry-after")?.trim()
  if (!raw) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

function normalizedCompanyName(name: string): string {
  return name.replaceAll(",", " ").replaceAll(/\s+/g, " ").trim()
}

function contactRole(contact: z.infer<typeof hunterMaskedContactSchema>): string {
  return contact.position ?? contact.department ?? contact.seniority ?? "决策岗位待进一步确认"
}

export class HunterRestAdapter {
  private readonly fetchImplementation: typeof fetch
  private readonly baseUrl: URL
  private readonly timeoutMs: number
  private readonly now: () => Date
  private readonly apiKey: string

  constructor(options: HunterRestAdapterOptions) {
    const apiKey = options.apiKey.trim()
    if (!apiKey) throw new Error("hunter_api_key_required")
    const baseUrl = new URL(options.baseUrl ?? "https://api.hunter.io/v2/")
    if (baseUrl.protocol !== "https:") throw new Error("hunter_api_base_must_use_https")

    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.fetchImplementation = options.fetch ?? fetch
    this.timeoutMs = options.timeoutMs ?? 15_000
    this.now = options.now ?? (() => new Date())
  }

  async searchMaskedBuyers(input: z.input<typeof hunterSearchInputSchema>): Promise<HunterMaskedBuyerSearchResult> {
    const query = hunterSearchInputSchema.parse(input)
    const discoverPayload = await this.request("discover", {
      method: "POST",
      body: JSON.stringify({
        query: `Companies in ${query.market} that buy, import, distribute, or sell ${query.product}; ideal customer type: ${query.customerType}`,
      }),
    })
    const discovered = this.parseResponse(hunterDiscoverResponseSchema, discoverPayload)
      .data
      .slice(0, query.maxCompanies)

    if (discovered.length === 0) {
      return { generatedAt: this.now().toISOString(), companies: [] }
    }

    const searchUrl = new URL("multi-domain-search", this.baseUrl)
    searchUrl.searchParams.set("company_name", discovered.map((company) => normalizedCompanyName(company.organization)).join(","))
    searchUrl.searchParams.set("decision_maker", "true")
    searchUrl.searchParams.set("type", "personal")
    searchUrl.searchParams.set("verification_status", "valid")
    searchUrl.searchParams.set("required_field", "email")
    searchUrl.searchParams.set("limit", String(query.maxContacts))

    const maskedPayload = await this.request(searchUrl, { method: "POST" })
    const masked = this.parseResponse(hunterMultiDomainResponseSchema, maskedPayload)
    const contactsByDomain = new Map<string, HunterMaskedContact[]>()
    for (const contact of masked.data) {
      const domain = contact.domain.toLowerCase()
      const existing = contactsByDomain.get(domain) ?? []
      existing.push({
        providerReference: contact.reveal_handle,
        maskedName: contact.name ?? "姓名已脱敏",
        role: contactRole(contact),
        department: contact.department ?? null,
        seniority: contact.seniority ?? null,
        decisionMaker: contact.decision_maker,
        verifiedEmailAvailable: contact.verification.status === "valid",
        phoneExists: contact.phone_number_exists,
        linkedInExists: contact.linkedin_exists,
        verificationStatus: contact.verification.status,
        verificationDate: contact.verification.date,
      })
      contactsByDomain.set(domain, existing)
    }

    return {
      generatedAt: this.now().toISOString(),
      companies: discovered.map((company) => ({
        domain: company.domain.toLowerCase(),
        organization: company.organization,
        indexedEmailCount: company.emails_count?.total ?? null,
        contacts: contactsByDomain.get(company.domain.toLowerCase()) ?? [],
      })),
    }
  }

  async revealContacts(providerReferences: string[]): Promise<HunterRevealResult> {
    const handles = revealInputSchema.parse(providerReferences)
    const payload = await this.request("multi-domain-search/reveal", {
      method: "POST",
      body: JSON.stringify({ handles }),
    })
    const response = this.parseResponse(hunterRevealResponseSchema, payload)
    return {
      contacts: response.data.map((contact) => ({
        providerReference: contact.reveal_handle,
        email: contact.email,
        firstName: contact.first_name ?? null,
        lastName: contact.last_name ?? null,
        role: contact.position ?? null,
        phone: contact.phone_number ?? null,
        linkedInUrl: contact.linkedin_url ?? null,
        domain: contact.domain.toLowerCase(),
        outcome: contact.outcome,
      })),
      providerCreditsCharged: response.meta.credits_charged,
      outcomes: response.meta.handles.map((item) => ({
        providerReference: item.handle,
        outcome: item.outcome,
      })),
    }
  }

  private parseResponse<T>(schema: z.ZodType<T>, payload: unknown): T {
    const parsed = schema.safeParse(payload)
    if (!parsed.success) throw new HunterProviderError("invalid_response", 502, null)
    return parsed.data
  }

  private async request(path: string | URL, init: { method: "POST"; body?: string }): Promise<unknown> {
    const url = typeof path === "string" ? new URL(path, this.baseUrl) : path
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImplementation(url, {
        method: init.method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body,
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new HunterProviderError(mappedErrorCode(response.status), response.status, retryAfterSeconds(response))
      }
      return payload
    } catch (error) {
      if (error instanceof HunterProviderError) throw error
      if (controller.signal.aborted) throw new HunterProviderError("timeout", null, null)
      throw new HunterProviderError("upstream_failure", null, null)
    } finally {
      clearTimeout(timer)
    }
  }
}
