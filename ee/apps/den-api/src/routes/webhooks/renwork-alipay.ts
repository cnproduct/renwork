import type { Env, Hono } from "hono"
import { settleAlipayNotification } from "../../renwork-alipay-order.js"
import { syncInferenceForOrganizationMembers } from "../../inference.js"

/** Alipay's acknowledgement must be plain text and only follow a committed transaction. */
export function registerRenworkAlipayWebhookRoutes<T extends Env>(app: Hono<T>) {
  app.post("/v1/webhooks/renwork/alipay", async (c) => {
    const contentType = c.req.header("content-type") ?? ""
    if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) return c.text("fail", 415)
    const body = await c.req.text()
    if (body.length > 16_384) return c.text("fail", 413)
    try {
      const result = await settleAlipayNotification(body)
      await syncInferenceForOrganizationMembers({ organizationId: result.organizationId })
      return c.text("success")
    } catch {
      // Never disclose the merchant, order or signature details on the public callback.
      return c.text("fail", 400)
    }
  })
}
