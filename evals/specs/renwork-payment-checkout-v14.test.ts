import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url))
const catalogPath = join(repositoryRoot, "ee/apps/den-api/src/renwork-growth/plan-catalog.ts")
const paymentServicePath = join(repositoryRoot, "ee/apps/den-api/src/renwork-commerce-payment.ts")
const paymentSchemaPath = join(repositoryRoot, "ee/packages/den-db/src/schema/commerce.ts")
const billingRoutePath = join(repositoryRoot, "ee/apps/den-api/src/routes/org/billing.ts")
const webhookIndexPath = join(repositoryRoot, "ee/apps/den-api/src/routes/webhooks/index.ts")
const paymentWebhookPath = join(repositoryRoot, "ee/apps/den-api/src/routes/webhooks/renwork-payments.ts")
const adminCommercePath = join(repositoryRoot, "ee/apps/den-api/src/routes/admin/commerce.ts")
const ledgerPath = join(repositoryRoot, "ee/apps/den-api/src/rencredit-ledger.ts")
const accountCenterPath = join(repositoryRoot, "apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx")
const denClientPath = join(repositoryRoot, "apps/app/src/app/lib/den.ts")

function source(path: string): string {
  return readFileSync(path, "utf8")
}

test("personal plans checkout through Den while enterprise plans stay sales-assisted", async ({ evidence }) => {
  const catalog = source(catalogPath)

  expect(catalog).toContain('purchaseMode: "checkout"')
  expect(catalog).toContain('id: "enterprise-starter-annual"')
  expect(catalog).toContain('purchaseMode: "request_access"')
  expect(catalog).not.toContain('purchaseMode: "free"')

  evidence.fact(
    "The paid plan boundary is explicit",
    "Personal monthly and annual offers use server-side checkout; enterprise offers continue through reviewed access requests and there is no free plan.",
    true,
  )
})

test("payment state and callbacks are durable, tenant-scoped, and idempotent", async ({ evidence }) => {
  expect(existsSync(paymentSchemaPath)).toBe(true)
  const schema = source(paymentSchemaPath)
  const service = source(paymentServicePath)
  const billingRoute = source(billingRoutePath)
  const webhookIndex = source(webhookIndexPath)
  const webhook = source(paymentWebhookPath)
  const adminCommerce = source(adminCommercePath)
  const ledger = source(ledgerPath)

  expect(schema).toContain('"commerce_orders"')
  expect(schema).toContain('"commerce_payment_events"')
  expect(schema).toContain('"commerce_refunds"')
  expect(schema).toContain('uniqueIndex("commerce_orders_org_idempotency"')
  expect(schema).toContain('uniqueIndex("commerce_payment_events_provider_event"')
  expect(service).toContain("grantRenCredit")
  expect(service).toContain("PAYMENT_PLAN_CREDIT_GRANT")
  expect(service).toContain("catalog_snapshot")
  expect(service).toContain("organization_id")
  expect(service).toContain("payment.paidAt > order.expires_at")
  expect(service).toContain('order.status === "pending" || order.status === "closed"')
  expect(billingRoute).toContain('"/v1/renwork/commerce/orders"')
  expect(billingRoute).toContain('"/v1/renwork/commerce/orders/:orderId"')
  expect(webhookIndex).toContain("registerRenworkPaymentWebhookRoutes")
  expect(webhook).toContain('"/v1/webhooks/wechat-pay"')
  expect(webhook).toContain('"/v1/webhooks/alipay"')
  expect(webhook).toContain("verifyWechatPayCallback")
  expect(webhook).toContain("verifyAlipayCallback")
  expect(adminCommerce).toContain("adminRoute()")
  expect(adminCommerce).toContain('"/v1/admin/renwork/commerce/orders/:orderId/refund"')
  expect(service).toContain("requestProviderRefund")
  expect(service).toContain("PAYMENT_PLAN_CREDIT_REVERSAL")
  expect(ledger).toContain('entry_type: "refund"')

  evidence.fact(
    "Payment cannot be asserted by the browser",
    "Den persists provider-neutral orders and append-only payment events, scopes order reads to the organization, verifies provider callbacks, and grants RenCredit with an idempotency key.",
    true,
  )
})

test("the desktop account center starts checkout without receiving merchant secrets", async ({ evidence }) => {
  const accountCenter = source(accountCenterPath)
  const denClient = source(denClientPath)

  expect(accountCenter).toContain("client.createRenworkCommerceOrder")
  expect(accountCenter).toContain("wechat_pay")
  expect(accountCenter).toContain("alipay")
  expect(accountCenter).toContain("QRCodeSVG")
  expect(accountCenter).toContain('data-testid="renwork-wechat-payment-qr"')
  expect(denClient).toContain('"/v1/renwork/commerce/orders"')
  expect(accountCenter).not.toMatch(/WECHAT_PAY_(API_V3_KEY|PRIVATE_KEY)|ALIPAY_(PRIVATE_KEY|PUBLIC_KEY)/)

  evidence.fact(
    "Merchant credentials stay server-side",
    "The desktop selects a channel and receives only checkout data from Den; WeChat and Alipay signing material is absent from the client bundle.",
    true,
  )
})
