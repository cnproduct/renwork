import { normalizeDenTypeId } from "@openwork-ee/utils/typeid"
import type { Hono } from "hono"
import { z } from "zod"
import { adminRoute, jsonValidator } from "../../middleware/index.js"
import { refundRenworkCommerceOrder } from "../../renwork-commerce-payment.js"
import type { AuthContextVariables } from "../../session.js"

const refundSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(255),
  reason: z.string().trim().min(1).max(255),
})

/** Full-plan refunds are intentionally platform-admin only. The provider
 * refund must succeed before the subscription is revoked and an immutable
 * RenCredit compensation entry is appended. */
export function registerAdminCommerceRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.post(
    "/v1/admin/renwork/commerce/orders/:orderId/refund",
    adminRoute(),
    jsonValidator(refundSchema),
    async (c) => {
      let orderId
      try {
        orderId = normalizeDenTypeId("commerceOrder", c.req.param("orderId"))
      } catch {
        return c.json({ error: "invalid_order_id" }, 400)
      }
      try {
        const result = await refundRenworkCommerceOrder({ orderId, ...c.req.valid("json") })
        return c.json({ ok: true as const, ...result })
      } catch (error) {
        const code = error instanceof Error ? error.message : "commerce_refund_failed"
        if (code === "commerce_order_not_found") return c.json({ error: code }, 404)
        if (code.startsWith("commerce_order_not_refundable") || code.startsWith("commerce_refund_idempotency")) {
          return c.json({ error: code }, 409)
        }
        if (code.includes("_missing") || code.includes("_refund_failed")) {
          return c.json({ error: "payment_refund_unavailable", message: "The payment provider did not accept the refund. No RenCredit was revoked." }, 503)
        }
        throw error
      }
    },
  )
}
