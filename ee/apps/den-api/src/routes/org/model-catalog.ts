import {
  RENWORK_BILLING_MODES,
  RENWORK_MODEL_TIERS,
  toPublicModelCatalogForPlan,
  validateAdminModelCatalog,
} from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { z } from "zod"
import { parseOrganizationPlan } from "../../entitlements.js"
import { orgRoleRoute } from "../../middleware/index.js"
import { modelCatalogSchema, requestModelCatalog } from "../../model-catalog-service.js"
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
})

const publicModelCatalogSchema = z.object({
  version: z.string(),
  currency: z.literal("REN_CREDIT"),
  models: z.array(publicModelSchema),
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
      const organization = c.get("organizationContext").organization
      try {
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

        const plan = parseOrganizationPlan(organization.metadata).tier
        c.header("Cache-Control", "private, no-store")
        return c.json(toPublicModelCatalogForPlan(parsed.data, plan))
      } catch {
        return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
      }
    },
  )
}
