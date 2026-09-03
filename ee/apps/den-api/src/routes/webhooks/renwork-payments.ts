import type { Env, Hono } from "hono"
import { recordVerifiedPayment } from "../../renwork-commerce-payment.js"
import { verifyAlipayCallback, verifyWechatPayCallback } from "../../renwork-payment-providers.js"

function callbackStatus(error: unknown) {
  return error instanceof Error && error.message.includes("signature") ? 401 : 400
}

export function registerRenworkPaymentWebhookRoutes<T extends Env>(app: Hono<T>) {
  app.post("/v1/webhooks/wechat-pay", async (c) => {
    const rawBody = await c.req.text()
    try {
      const payment = await verifyWechatPayCallback(c.req.raw.headers, rawBody)
      await recordVerifiedPayment({ payment, rawBody })
      return c.json({ code: "SUCCESS", message: "成功" })
    } catch (error) {
      return c.json({ code: "FAIL", message: "Payment notification rejected." }, callbackStatus(error))
    }
  })

  app.post("/v1/webhooks/alipay", async (c) => {
    const rawBody = await c.req.text()
    try {
      const payment = verifyAlipayCallback(rawBody)
      await recordVerifiedPayment({ payment, rawBody })
      return c.text("success")
    } catch (error) {
      return c.text("failure", callbackStatus(error))
    }
  })
}
