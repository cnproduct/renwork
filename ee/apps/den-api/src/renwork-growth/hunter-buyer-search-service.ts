import { createHmac, randomUUID } from "node:crypto"
import {
  renworkBuyerSearchResponseSchema,
  type RenworkBuyerSearchRequest,
  type RenworkBuyerSearchResponse,
} from "@openwork/types/renwork-buyer-growth"
import { HunterRestAdapter } from "./providers/hunter.js"

type SearchScope = {
  organizationId: string
  request: RenworkBuyerSearchRequest
}

export type HunterContactBinding = {
  organizationId: string
  workspaceId: string
  companyId: string
  contactId: string
  providerReference: string
  domain: string
  maskedName: string
  role: string
}

const MAX_CACHED_CONTACT_BINDINGS = 10_000

function limited(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength)
}

function maskName(value: string): string {
  return limited(value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(part.length - 1, 6)))}`)
    .join(" "), 120)
}

function matchScore(contacts: Array<{ decisionMaker: boolean; verifiedEmailAvailable: boolean }>): number {
  const decisionMaker = contacts.some((contact) => contact.decisionMaker)
  const verifiedEmail = contacts.some((contact) => contact.verifiedEmailAvailable)
  return Math.min(88, 62 + (decisionMaker ? 12 : 0) + (verifiedEmail ? 10 : 0) + Math.min(contacts.length, 4))
}

export class HunterBuyerSearchService {
  private readonly contactBindings = new Map<string, HunterContactBinding>()

  constructor(
    private readonly adapter: HunterRestAdapter,
    private readonly identitySecret: string,
  ) {}

  async search(scope: SearchScope): Promise<RenworkBuyerSearchResponse> {
    const result = await this.adapter.searchMaskedBuyers({
      product: scope.request.product,
      market: scope.request.market,
      customerType: scope.request.customerType,
      maxCompanies: 10,
      maxContacts: 30,
    })

    const companies = result.companies.map((company) => {
      const companyId = this.opaqueId("company", [
        scope.organizationId,
        scope.request.workspaceId,
        company.domain,
      ])
      const contacts = company.contacts.map((contact) => {
        const contactId = this.opaqueId("contact", [
          scope.organizationId,
          scope.request.workspaceId,
          company.domain,
          contact.providerReference,
        ])
        this.rememberBinding({
          organizationId: scope.organizationId,
          workspaceId: scope.request.workspaceId,
          companyId,
          contactId,
          providerReference: contact.providerReference,
          domain: company.domain,
          maskedName: maskName(contact.maskedName),
          role: limited(contact.role, 160),
        })
        return {
          contactId,
          maskedName: maskName(contact.maskedName),
          role: limited(contact.role, 160),
          availability: {
            verifiedEmail: contact.verifiedEmailAvailable,
            verifiedPhone: false,
          },
        }
      })

      return {
        companyId,
        companyName: limited(company.organization, 200),
        country: limited(`目标市场：${scope.request.market}（企业所在地待复核）`, 120),
        website: `https://${company.domain}`,
        matchScore: matchScore(company.contacts),
        matchReasons: [
          limited(`企业索引匹配“${scope.request.product}”与“${scope.request.customerType}”筛选条件`, 240),
          contacts.length > 0 ? `发现 ${contacts.length} 位可进一步核验的决策岗位联系人` : "暂未发现可解锁的决策岗位联系人",
        ],
        evidence: [
          {
            id: this.opaqueId("evidence", [companyId, "identity"]),
            grade: "E1",
            assertion: "company_identity",
            summary: "企业名称与域名来自经许可的企业信息索引",
            sourceSummary: "企业及职业联系信息索引",
            observedAt: result.generatedAt,
          },
          {
            id: this.opaqueId("evidence", [companyId, "fit"]),
            grade: "E2",
            assertion: "product_fit",
            summary: "企业被本次产品、市场与客户类型筛选命中，仍需结合官网或交易证据复核",
            sourceSummary: "本次筛选条件与企业索引匹配",
            observedAt: result.generatedAt,
          },
        ],
        riskFlags: [
          "联系人数据仅证明职业身份与可联系性，不证明采购或交易事实",
          "目标市场归属、近期采购计划与真实买家等级仍需独立来源验证",
        ],
        contacts,
      }
    })

    return renworkBuyerSearchResponseSchema.parse({
      schemaVersion: 1,
      queryId: `query-${randomUUID()}`,
      generatedAt: result.generatedAt,
      charge: "free",
      companies,
      evidenceNotice: "企业与脱敏联系人预览免费；联系人仅证明职业身份与可联系性，不单独证明采购或交易。",
    })
  }

  resolveContact(input: {
    organizationId: string
    workspaceId: string
    companyId: string
    contactId: string
  }): HunterContactBinding | null {
    const binding = this.contactBindings.get(input.contactId)
    if (!binding) return null
    if (binding.organizationId !== input.organizationId) return null
    if (binding.workspaceId !== input.workspaceId) return null
    if (binding.companyId !== input.companyId) return null
    return binding
  }

  private opaqueId(kind: string, parts: string[]): string {
    const digest = createHmac("sha256", this.identitySecret)
      .update(parts.join("\u0000"))
      .digest("hex")
      .slice(0, 32)
    return `${kind}-${digest}`
  }

  private rememberBinding(binding: HunterContactBinding): void {
    this.contactBindings.set(binding.contactId, binding)
    if (this.contactBindings.size <= MAX_CACHED_CONTACT_BINDINGS) return
    const oldest = this.contactBindings.keys().next().value
    if (oldest) this.contactBindings.delete(oldest)
  }
}
