import { and, eq, isNull } from "@openwork-ee/den-db/drizzle"
import { AuthUserTable, MemberTable, OrganizationTable } from "@openwork-ee/den-db/schema"
import { isDenTypeId } from "@openwork-ee/utils/typeid"
import { toPublicModelCatalogForPlan, validateDenServerCatalog } from "@openwork/rencredit-metering"
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
import { readSubscriptionCliPolicy, subscriptionCliPolicySchema, writeSubscriptionCliPolicy } from "../../subscription-cli-policy.js"

async function loadOrganization(organizationId: string) {
  if (!isDenTypeId("organization", organizationId)) return null
  return (await db.select({
    id: OrganizationTable.id,
    name: OrganizationTable.name,
    slug: OrganizationTable.slug,
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

async function loadAvailableCatalog(metadata: Record<string, unknown> | null) {
  const upstream = await requestModelCatalog("/v1/admin/models/catalog").catch(() => null)
  if (!upstream?.configured || !upstream.response.ok) return null
  const parsed = modelCatalogSchema.safeParse(upstream.payload)
  if (!parsed.success || parsed.data.status !== "active") return null
  try {
    validateDenServerCatalog(parsed.data)
  } catch {
    return null
  }
  const publicModels = toPublicModelCatalogForPlan(parsed.data, parseOrganizationPlan(metadata).tier).models
  const availableModelSkus = new Set(publicModels.map((model) => model.sku))
  return {
    models: publicModels.map((model) => ({
      ...model,
      providerIds: parsed.data.models
        .find((candidate) => candidate.sku === model.sku)
        ?.routes.filter((route) => route.enabled).map((route) => route.providerId) ?? [],
    })),
    providers: parsed.data.providers
      .filter((provider) => provider.enabled)
      .map((provider) => ({
        id: provider.id,
        displayName: provider.displayName,
        health: provider.health,
        modelSkus: parsed.data.models
          .filter((model) => availableModelSkus.has(model.sku))
          .filter((model) => model.routes.some((route) => route.enabled && route.providerId === provider.id))
          .map((model) => model.sku),
      })),
  }
}

export function registerAdminOrganizationModelPolicyRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get("/v1/admin/organizations/:organizationId/subscription-cli-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization || organization.slug !== "weijian") return c.json({ error: "not_found" }, 404)
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name, slug: organization.slug }, policy: readSubscriptionCliPolicy(organization.metadata) })
  })

  app.put("/v1/admin/organizations/:organizationId/subscription-cli-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization || organization.slug !== "weijian") return c.json({ error: "not_found" }, 404)
    const parsed = subscriptionCliPolicySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return c.json({ error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid policy." }, 400)
    if (parsed.data.enabled && Date.parse(parsed.data.expiresAt) <= Date.now()) {
      return c.json({ error: "invalid_request", message: "An enabled policy must expire in the future." }, 400)
    }
    const activeMemberIds = new Set<string>((await loadActiveMembers(organization.id)).map((member) => member.id))
    if (parsed.data.allowedMemberIds.some((memberId) => !activeMemberIds.has(memberId))) {
      return c.json({ error: "invalid_request", message: "The policy references an inactive or unknown member." }, 400)
    }
    await db.update(OrganizationTable)
      .set({ metadata: writeSubscriptionCliPolicy(organization.metadata, parsed.data) })
      .where(eq(OrganizationTable.id, organization.id))
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name, slug: organization.slug }, policy: parsed.data })
  })

  app.get("/v1/admin/organizations/:organizationId/model-policy", adminRoute(), async (c) => {
    const organization = await loadOrganization(c.req.param("organizationId"))
    if (!organization) return c.json({ error: "not_found", message: "Organization not found." }, 404)
    const [members, availableCatalog] = await Promise.all([
      loadActiveMembers(organization.id),
      loadAvailableCatalog(organization.metadata),
    ])
    c.header("Cache-Control", "private, no-store")
    return c.json({
      organization: { id: organization.id, name: organization.name },
      policy: readOrganizationModelPolicy(organization.metadata),
      availableModels: availableCatalog?.models ?? [],
      availableProviders: availableCatalog?.providers ?? [],
      catalogAvailable: availableCatalog !== null,
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
    const [members, availableCatalog] = await Promise.all([
      loadActiveMembers(organization.id),
      loadAvailableCatalog(organization.metadata),
    ])
    const activeMemberIds = new Set(members.map((member) => member.id))
    const referencedMemberIds = new Set([
      ...Object.keys(body.data.memberMonthlyBudgetMicroCredits),
      ...Object.keys(body.data.memberAllowedModelSkus),
      ...body.data.providerAssignments.flatMap((assignment) => assignment.allowedMemberIds ?? []),
    ])
    const unknownMember = [...referencedMemberIds]
      .find((memberId) => !isDenTypeId("member", memberId) || !activeMemberIds.has(memberId))
    if (unknownMember) {
      return c.json({ error: "invalid_request", message: "A member policy references an unknown organization member." }, 400)
    }
    if (availableCatalog) {
      const availableModelSkus = new Set(availableCatalog.models.map((model) => model.sku))
      const availableProviderIds = new Set(availableCatalog.providers.map((provider) => provider.id))
      const referencedModelSkus = new Set([
        ...(body.data.allowedModelSkus ?? []),
        ...(body.data.defaultModelSku ? [body.data.defaultModelSku] : []),
        ...Object.values(body.data.memberAllowedModelSkus).flatMap((modelSkus) => modelSkus ?? []),
        ...body.data.providerAssignments.flatMap((assignment) => assignment.allowedModelSkus ?? []),
      ])
      if ([...referencedModelSkus].some((modelSku) => !availableModelSkus.has(modelSku))) {
        return c.json({ error: "invalid_request", message: "A model policy references a model outside the current paid catalog." }, 400)
      }
      if (body.data.providerAssignments.some((assignment) => !availableProviderIds.has(assignment.providerId))) {
        return c.json({ error: "invalid_request", message: "A provider authorization references an unavailable server provider." }, 400)
      }
      const providerModelSkus = new Map(
        availableCatalog.providers.map((provider) => [provider.id, new Set(provider.modelSkus)]),
      )
      const assignmentWithInvalidModel = body.data.providerAssignments.find((assignment) => (
        assignment.allowedModelSkus !== null &&
        assignment.allowedModelSkus.some((modelSku) => !providerModelSkus.get(assignment.providerId)?.has(modelSku))
      ))
      if (assignmentWithInvalidModel) {
        return c.json({
          error: "invalid_request",
          message: "A provider authorization references a model that is not routed through that provider.",
        }, 400)
      }
    }
    await db.update(OrganizationTable)
      .set({ metadata: writeOrganizationModelPolicy(organization.metadata, body.data) })
      .where(eq(OrganizationTable.id, organization.id))
    c.header("Cache-Control", "private, no-store")
    return c.json({ organization: { id: organization.id, name: organization.name }, policy: body.data })
  })
}
