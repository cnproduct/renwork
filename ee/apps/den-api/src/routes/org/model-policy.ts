import { eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable } from "@openwork-ee/den-db/schema"
import { toPublicModelCatalogForPlan, validateAdminModelCatalog } from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { db } from "../../db.js"
import { parseOrganizationPlan } from "../../entitlements.js"
import { orgRoleRoute } from "../../middleware/index.js"
import { modelCatalogSchema, requestModelCatalog } from "../../model-catalog-service.js"
import {
  applyOrganizationPricingToPublicCatalog,
  organizationModelPolicyInputSchema,
  readOrganizationModelPolicy,
  readOrganizationModelPricingPolicy,
  writeOrganizationModelPolicy,
} from "../../organization-model-policy.js"
import type { OrgRouteVariables } from "./shared.js"

export function registerOrgModelPolicyRoutes<T extends { Variables: OrgRouteVariables }>(app: Hono<T>) {
  app.get("/v1/model-policy", orgRoleRoute(["owner"]), async (c) => {
    const organization = c.get("organizationContext").organization
    const upstream = await requestModelCatalog("/v1/admin/models/catalog").catch(() => null)
    if (!upstream?.configured || !upstream.response.ok) {
      return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
    }
    const parsed = modelCatalogSchema.safeParse(upstream.payload)
    if (!parsed.success || parsed.data.status !== "active") {
      return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
    }
    try {
      validateAdminModelCatalog(parsed.data)
    } catch {
      return c.json({ error: "MODEL_CATALOG_UNAVAILABLE", message: "RenWork model catalog is temporarily unavailable." }, 503)
    }
    const availableModels = applyOrganizationPricingToPublicCatalog(
      toPublicModelCatalogForPlan(parsed.data, parseOrganizationPlan(organization.metadata).tier),
      readOrganizationModelPricingPolicy(organization.metadata),
    ).models
    c.header("Cache-Control", "private, no-store")
    return c.json({ policy: readOrganizationModelPolicy(organization.metadata), availableModels })
  })

  app.put("/v1/model-policy", orgRoleRoute(["owner"]), async (c) => {
    const body = organizationModelPolicyInputSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({
        error: "invalid_request",
        message: body.error.issues[0]?.message ?? "Invalid organization model policy.",
      }, 400)
    }

    const organization = c.get("organizationContext").organization
    const activeMemberIds = new Set(c.get("organizationContext").members.map((member: { id: string }) => member.id))
    const unknownMember = Object.keys(body.data.memberMonthlyBudgetMicroCredits)
      .find((memberId) => !activeMemberIds.has(memberId))
    if (unknownMember) {
      return c.json({ error: "invalid_request", message: "A member quota references an unknown organization member." }, 400)
    }

    const metadata = writeOrganizationModelPolicy(organization.metadata, body.data)
    await db.update(OrganizationTable).set({ metadata }).where(eq(OrganizationTable.id, organization.id))
    c.header("Cache-Control", "private, no-store")
    return c.json({ policy: body.data })
  })
}
