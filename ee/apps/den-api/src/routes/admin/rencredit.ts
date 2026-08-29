import type { Hono } from "hono"
import { z } from "zod"
import { adminRoute, jsonValidator } from "../../middleware/index.js"
import type { AuthContextVariables } from "../../session.js"
import { denTypeIdSchema } from "../../openapi.js"
import { grantRenCredit } from "../../rencredit-ledger.js"

const grantSchema = z.object({
  organizationId: denTypeIdSchema("organization"),
  amountMicroCredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.string().trim().min(8).max(255),
  reasonCode: z.string().trim().min(1).max(128),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export function registerAdminRenCreditRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.post(
    "/v1/admin/rencredit/grants",
    adminRoute(),
    jsonValidator(grantSchema),
    async (c) => {
      const input = c.req.valid("json")
      const wallet = await grantRenCredit(input)
      return c.json({ ok: true, wallet })
    },
  )
}
