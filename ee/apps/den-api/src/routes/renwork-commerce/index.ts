import { renworkPlanCatalogSchema } from "@openwork/types/renwork-commerce"
import type { Env, Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { publicRoute } from "../../middleware/route-access.js"
import { jsonResponse } from "../../openapi.js"
import { getRenworkPlanCatalog } from "../../renwork-growth/plan-catalog.js"

const renworkPlanCatalogResponseSchema = renworkPlanCatalogSchema.meta({ ref: "RenworkPlanCatalogResponse" })

export function registerRenworkCommerceRoutes<T extends Env>(app: Hono<T>) {
  app.get(
    "/v1/renwork/commerce/catalog",
    describeRoute({
      tags: ["RenWork Commerce"],
      summary: "Get the authoritative RenWork plan catalog",
      description: "Returns the server-controlled personal and enterprise plan catalog used by RenWork clients.",
      responses: {
        200: jsonResponse("RenWork plan catalog returned successfully.", renworkPlanCatalogResponseSchema),
      },
    }),
    publicRoute,
    (c) => {
      c.header("Cache-Control", "public, max-age=60, stale-if-error=300")
      return c.json(getRenworkPlanCatalog())
    },
  )
}
