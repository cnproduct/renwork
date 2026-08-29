import { eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable } from "@openwork-ee/den-db/schema"
import { isDenTypeId } from "@openwork-ee/utils/typeid"
import type { Hono } from "hono"
import { db } from "../../db.js"
import { adminRoute } from "../../middleware/index.js"
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

export function registerAdminOrganizationModelPolicyRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get("/v1/admin/organizations/:organizationId/model-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization) return c.json({ error: "not_found", message: "Organization not found." }, 404)
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name }, policy: readOrganizationModelPolicy(organization.metadata) })
  })

  app.put("/v1/admin/organizations/:organizationId/model-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization) return c.json({ error: "not_found", message: "Organization not found." }, 404)
    const body = organizationModelPolicyInputSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ error: "invalid_request", message: body.error.issues[0]?.message ?? "Invalid organization model policy." }, 400)
    }
    await db.update(OrganizationTable)
      .set({ metadata: writeOrganizationModelPolicy(organization.metadata, body.data) })
      .where(eq(OrganizationTable.id, organization.id))
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name }, policy: body.data })
  })
}
