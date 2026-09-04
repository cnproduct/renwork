import {
  RENWORK_BILLING_MODES,
  RENWORK_MODEL_TIERS,
  toPublicModelCatalog,
  toPublicModelCatalogForPlan,
  validateAdminModelCatalog,
} from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { parseOrganizationPlan } from "../../entitlements.js"
import { orgRoleRoute } from "../../middleware/index.js"
import { modelCatalogSchema, requestModelCatalog } from "../../model-catalog-service.js"
import {
  applyOrganizationPricingToPublicCatalog,
  readOrganizationModelPolicy,
  readOrganizationModelPricingPolicy,
  resolveMemberMonthlyBudget,
} from "../../organization-model-policy.js"
import { resolveRenworkModelAccess } from "../../renwork-access.js"
import { forbiddenSchema, jsonResponse, unauthorizedSchema } from "../../openapi.js"
import type { OrgRouteVariables } from "./shared.js"

const publicModelSchema = z.object({
  sku: z.string(),
  providerID: z.literal("renwork"),
  modelID: z.string(),
  displayName: z.string(),
  description: z.string(),
  tier: z.enum(RENWORK_MODEL_TIERS),
  autoEligible: z.boolean(),
  contextWindow: z.number().int().positive().nullable(),
  tags: z.array(z.string()),
  displayMultiplierBps: z.number().int().nonnegative(),
  effectiveDisplayMultiplierBps: z.number().int().nonnegative(),
  promotionLabel: z.string().nullable(),
  promotionEndsAt: z.string().datetime().nullable(),
  billingMode: z.enum(RENWORK_BILLING_MODES),
  executionLocation: z.enum(["cloud", "local"]),
})

const publicModelCatalogSchema = z.object({
  version: z.string(),
  currency: z.literal("REN_CREDIT"),
  models: z.array(publicModelSchema),
  policy: z.object({
    defaultModelSku: z.string().nullable(),
    dailyBudgetMicroCredits: z.number().int().nonnegative().nullable(),
    monthlyBudgetMicroCredits: z.number().int().nonnegative().nullable(),
    memberMonthlyBudgetMicroCredits: z.number().int().nonnegative().nullable(),
  }),
  access: z.object({
    source: z.enum(["subscription", "campaign", "super_admin"]),
    expiresAt: z.string().datetime().nullable(),
  }),
})

const unavailableSchema = z.object({
  error: z.string(),
  message: z.string(),
})

export function registerOrgModelCatalogRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.get(
    "/v1/models/catalog",
    describeRoute({
      tags: ["Models"],
      summary: "Get the member-safe RenWork model catalog",
      description: "Returns models available to the active organization without provider, route, credential, or upstream model details.",
      responses: {
        200: jsonResponse("The plan-filtered member model catalog was returned.", publicModelCatalogSchema),
        401: jsonResponse("The caller must be authenticated.", unauthorizedSchema),
        403: jsonResponse("The caller is not a member of the selected organization.", forbiddenSchema),
        503: jsonResponse("The model catalog service is unavailable.", unavailableSchema),
      },
    }),
    orgRoleRoute(["member"]),
    async (c) => {
      const organizationContext = c.get("organizationContext")
      const organization = organizationContext.organization
      try {
        const access = await resolveRenworkModelAccess({
          organizationId: organization.id,
          metadata: organization.metadata,
        })
        if (!access.allowed) {
          return c.json({ error: "SUBSCRIPTION_REQUIRED", message: "An active RenWork subscription or temporary access grant is required." }, 402)
        }
        const upstream = await requestModelCatalog("/v1/admin/models/catalog")
        if (!upstream.configured || !upstream.response.ok) {
          return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
        }
        const parsed = modelCatalogSchema.safeParse(upstream.payload)
        if (!parsed.success) {
          return c.json({ error: "MODEL_CATALOG_INVALID_RESPONSE", message: "RenWork model catalog is temporarily unavailable." }, 503)
        }
        validateAdminModelCatalog(parsed.data)
        if (parsed.data.status !== "active") {
          return c.json({ error: "MODEL_CATALOG_NOT_ACTIVE", message: "RenWork model catalog is temporarily unavailable." }, 503)
        }

        const platformCatalog = access.source === "subscription"
          ? toPublicModelCatalogForPlan(parsed.data, parseOrganizationPlan(organization.metadata).tier)
          : toPublicModelCatalog(parsed.data)
        const publicCatalog = applyOrganizationPricingToPublicCatalog(
          platformCatalog,
          readOrganizationModelPricingPolicy(organization.metadata),
        )
        const policy = readOrganizationModelPolicy(organization.metadata)
        const allowed = policy.allowedModelSkus ? new Set(policy.allowedModelSkus) : null
        const policyModels = allowed
          ? publicCatalog.models.filter((model) => allowed.has(model.sku))
          : publicCatalog.models
        const grantModels = access.allowedModelSkus ? new Set(access.allowedModelSkus) : null
        const models = grantModels
          ? policyModels.filter((model) => grantModels.has(model.sku))
          : policyModels
        const defaultModelSku = policy.defaultModelSku && models.some((model) => model.sku === policy.defaultModelSku)
          ? policy.defaultModelSku
          : models[0]?.sku ?? null
        c.header("Cache-Control", "private, no-store")
        return c.json({
          ...publicCatalog,
          models,
          policy: {
            defaultModelSku,
            dailyBudgetMicroCredits: policy.dailyBudgetMicroCredits,
            monthlyBudgetMicroCredits: policy.monthlyBudgetMicroCredits,
            memberMonthlyBudgetMicroCredits: resolveMemberMonthlyBudget(policy, organizationContext.currentMember.id),
          },
          access: {
            source: access.source,
            expiresAt: access.expiresAt,
          },
        })
      } catch {
        return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
      }
    },
  )
}
