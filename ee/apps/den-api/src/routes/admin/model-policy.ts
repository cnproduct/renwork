import { and, eq, isNull } from "@openwork-ee/den-db/drizzle"
import { AuthUserTable, MemberTable, OrganizationTable } from "@openwork-ee/den-db/schema"
import { isDenTypeId } from "@openwork-ee/utils/typeid"
import { toPublicModelCatalogForPlan, validateAdminModelCatalog } from "@openwork/rencredit-metering"
import type { Hono } from "hono"
import { db } from "../../db.js"
import { parseOrganizationPlan } from "../../entitlements.js"
import { adminRoute } from "../../middleware/index.js"
import { modelCatalogSchema, requestModelCatalog } from "../../model-catalog-service.js"
import {
  organizationModelPolicyInputSchema,
  readOrganizationModelPolicy,
  writeOrganizationModelPolicy,
} from "../../organization-model-policy.js"
import type { AuthContextVariables } from "../../session.js"

async function loadOrganization(organizationId: string) {
  if (!isDenTypeId("organization", organizationId)) return null
  return (await db.select({
    id: OrganizationTable.id,
    name: OrganizationTable.name,
    metadata: OrganizationTable.metadata,
  }).from(OrganizationTable).where(eq(OrganizationTable.id, organizationId)).limit(1))[0] ?? null
}

async function loadActiveMembers(organizationId: typeof OrganizationTable.$inferSelect.id) {
  return db
    .select({
      id: MemberTable.id,
      role: MemberTable.role,
      userId: MemberTable.userId,
      name: AuthUserTable.name,
      email: AuthUserTable.email,
    })
    .from(MemberTable)
    .leftJoin(AuthUserTable, eq(MemberTable.userId, AuthUserTable.id))
    .where(and(eq(MemberTable.organizationId, organizationId), isNull(MemberTable.removedAt)))
}

async function loadAvailableModels(metadata: Record<string, unknown> | null) {
  const upstream = await requestModelCatalog("/v1/admin/models/catalog").catch(() => null)
  if (!upstream?.configured || !upstream.response.ok) return null
  const parsed = modelCatalogSchema.safeParse(upstream.payload)
  if (!parsed.success || parsed.data.status !== "active") return null
  try {
    validateAdminModelCatalog(parsed.data)
  } catch {
    return null
  }
  return toPublicModelCatalogForPlan(parsed.data, parseOrganizationPlan(metadata).tier).models
}

export function registerAdminOrganizationModelPolicyRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get("/v1/admin/organizations/:organizationId/model-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization) return c.json({ error: "not_found", message: "Organization not found." }, 404)
    const [members, availableModels] = await Promise.all([
      loadActiveMembers(organization.id),
      loadAvailableModels(organization.metadata),
    ])
    c.header("Cache-Control", "private, no-store")
    return c.json({
      organization: { id: organization.id, name: organization.name },
      policy: readOrganizationModelPolicy(organization.metadata),
      availableModels: availableModels ?? [],
      catalogAvailable: availableModels !== null,
      members,
    })
  })

  app.put("/v1/admin/organizations/:organizationId/model-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization) return c.json({ error: "not_found", message: "Organization not found." }, 404)
    const body = organizationModelPolicyInputSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: "invalid_request", message: body.error.issues[0]?.message ?? "Invalid organization model policy." }, 400)
    }
    const activeMemberIds = new Set((await loadActiveMembers(organization.id)).map((member) => member.id))
    const unknownMember = Object.keys(body.data.memberMonthlyBudgetMicroCredits)
      .find((memberId) => !isDenTypeId("member", memberId) || !activeMemberIds.has(memberId))
    if (unknownMember) {
      return c.json({ error: "invalid_request", message: "A member quota references an unknown organization member." }, 400)
    }
    await db.update(OrganizationTable)
      .set({ metadata: writeOrganizationModelPolicy(organization.metadata, body.data) })
      .where(eq(OrganizationTable.id, organization.id))
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name }, policy: body.data })
  })
}
