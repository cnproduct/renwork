import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  webcrypto,
} from "node:crypto"
import type { RenworkPaymentChannel } from "@openwork/types/renwork-commerce"
import { env } from "./env.js"

export type CreateProviderCheckoutInput = {
  providerOrderId: string
  description: string
  amountMinor: number
  currency: "CNY"
  expiresAt: Date
}

export type ProviderCheckout = {
  checkoutUrl: string | null
  qrCodeUrl: string | null
}

export type VerifiedPayment = {
  channel: RenworkPaymentChannel
  providerEventId: string
  providerOrderId: string
  providerTransactionId: string
  amountMinor: number
  currency: string
  paidAt: Date
  eventType: string
}

export type ProviderRefundResult = {
  providerRefundId: string
  status: "pending" | "succeeded" | "failed"
}

export type ProviderRefundInput = {
  providerOrderId: string
  providerTransactionId: string
  providerRefundId: string
  amountMinor: number
  totalAmountMinor: number
  currency: "CNY"
  reason: string
}

function required(value: string | undefined, code: string) {
  if (!value) throw new Error(code)
  return value.replaceAll("\\n", "\n")
}

function randomNonce() {
  return randomBytes(16).toString("hex")
}

function sha256RsaSign(message: string, privateKey: string) {
  return sign("RSA-SHA256", new TextEncoder().encode(message), createPrivateKey(privateKey)).toString("base64")
}

function wechatAuthorization(method: "GET" | "POST", path: string, body: string) {
  const config = env.renworkPayments.wechatPay
  const merchantId = required(config.merchantId, "wechat_pay_merchant_id_missing")
  const serialNo = required(config.merchantSerialNo, "wechat_pay_serial_no_missing")
  const privateKey = required(config.privateKey, "wechat_pay_private_key_missing")
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = randomNonce()
  const signature = sha256RsaSign(`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`, privateKey)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${merchantId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`
}

export async function createWechatPayNativeCheckout(input: CreateProviderCheckoutInput): Promise<ProviderCheckout> {
  const config = env.renworkPayments.wechatPay
  const merchantId = required(config.merchantId, "wechat_pay_merchant_id_missing")
  const appId = required(config.appId, "wechat_pay_app_id_missing")
  const notifyUrl = required(config.notifyUrl, "wechat_pay_notify_url_missing")
  const path = "/v3/pay/transactions/native"
  const body = JSON.stringify({
    appid: appId,
    mchid: merchantId,
    description: input.description.slice(0, 127),
    out_trade_no: input.providerOrderId,
    notify_url: notifyUrl,
    time_expire: input.expiresAt.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    amount: { total: input.amountMinor, currency: input.currency },
  })
  const authorization = wechatAuthorization("POST", path, body)
  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: authorization, "Content-Type": "application/json", "User-Agent": "RenWork-Den/1.0" },
    body,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== "object" || !("code_url" in payload) || typeof payload.code_url !== "string") {
    throw new Error(`wechat_pay_create_failed:${response.status}`)
  }
  return { checkoutUrl: null, qrCodeUrl: payload.code_url }
}

function alipaySignable(params: URLSearchParams) {
  return [...params.entries()]
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
}

export async function createAlipayPageCheckout(input: CreateProviderCheckoutInput): Promise<ProviderCheckout> {
  const config = env.renworkPayments.alipay
  const params = new URLSearchParams({
    app_id: required(config.appId, "alipay_app_id_missing"),
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium", hour12: false }).format(new Date()),
    version: "1.0",
    notify_url: required(config.notifyUrl, "alipay_notify_url_missing"),
    biz_content: JSON.stringify({
      out_trade_no: input.providerOrderId,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: (input.amountMinor / 100).toFixed(2),
      subject: input.description.slice(0, 255),
      time_expire: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium", hour12: false }).format(input.expiresAt),
    }),
  })
  if (config.returnUrl) params.set("return_url", config.returnUrl)
  params.set("sign", sha256RsaSign(alipaySignable(params), required(config.privateKey, "alipay_private_key_missing")))
  return { checkoutUrl: `https://openapi.alipay.com/gateway.do?${params.toString()}`, qrCodeUrl: null }
}

export async function createProviderCheckout(channel: RenworkPaymentChannel, input: CreateProviderCheckoutInput) {
  return channel === "wechat_pay" ? createWechatPayNativeCheckout(input) : createAlipayPageCheckout(input)
}

async function requestWechatPayRefund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
  const path = "/v3/refund/domestic/refunds"
  const body = JSON.stringify({
    transaction_id: input.providerTransactionId,
    out_refund_no: input.providerRefundId,
    reason: input.reason.slice(0, 80),
    amount: { refund: input.amountMinor, total: input.totalAmountMinor, currency: input.currency },
  })
  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: wechatAuthorization("POST", path, body),
      "Content-Type": "application/json",
      "User-Agent": "RenWork-Den/1.0",
    },
    body,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !payload || typeof payload !== "object") throw new Error(`wechat_pay_refund_failed:${response.status}`)
  const upstreamId = "refund_id" in payload && typeof payload.refund_id === "string" ? payload.refund_id : input.providerRefundId
  const upstreamStatus = "status" in payload && typeof payload.status === "string" ? payload.status : "PROCESSING"
  return {
    providerRefundId: upstreamId,
    status: upstreamStatus === "SUCCESS" ? "succeeded" : upstreamStatus === "ABNORMAL" || upstreamStatus === "CLOSED" ? "failed" : "pending",
  }
}

async function requestAlipayRefund(input: ProviderRefundInput): Promise<ProviderRefundResult> {
  const params = new URLSearchParams({
    app_id: required(env.renworkPayments.alipay.appId, "alipay_app_id_missing"),
    method: "alipay.trade.refund",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium", hour12: false }).format(new Date()),
    version: "1.0",
    biz_content: JSON.stringify({
      trade_no: input.providerTransactionId,
      out_trade_no: input.providerOrderId,
      refund_amount: (input.amountMinor / 100).toFixed(2),
      refund_reason: input.reason.slice(0, 256),
      out_request_no: input.providerRefundId,
    }),
  })
  params.set("sign", sha256RsaSign(alipaySignable(params), required(env.renworkPayments.alipay.privateKey, "alipay_private_key_missing")))
  const response = await fetch("https://openapi.alipay.com/gateway.do", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=utf-8", "User-Agent": "RenWork-Den/1.0" },
    body: params.toString(),
  })
  const payload: unknown = await response.json().catch(() => null)
  const result = payload && typeof payload === "object" && "alipay_trade_refund_response" in payload
    ? payload.alipay_trade_refund_response
    : null
  if (!response.ok || !result || typeof result !== "object" || !("code" in result) || result.code !== "10000") {
    throw new Error(`alipay_refund_failed:${response.status}`)
  }
  return { providerRefundId: input.providerRefundId, status: "succeeded" }
}

export async function requestProviderRefund(channel: RenworkPaymentChannel, input: ProviderRefundInput) {
  return channel === "wechat_pay" ? requestWechatPayRefund(input) : requestAlipayRefund(input)
}

function header(headers: Headers, name: string) {
  return required(headers.get(name) ?? undefined, `wechat_pay_${name.toLowerCase()}_missing`)
}

export async function verifyWechatPayCallback(headers: Headers, rawBody: string): Promise<VerifiedPayment> {
  const config = env.renworkPayments.wechatPay
  const timestamp = header(headers, "Wechatpay-Timestamp")
  const nonce = header(headers, "Wechatpay-Nonce")
  const signature = header(headers, "Wechatpay-Signature")
  const verified = verify(
    "RSA-SHA256",
    new TextEncoder().encode(`${timestamp}\n${nonce}\n${rawBody}\n`),
    createPublicKey(required(config.platformPublicKey, "wechat_pay_platform_public_key_missing")),
    Uint8Array.from(Buffer.from(signature, "base64")),
  )
  if (!verified) throw new Error("wechat_pay_signature_invalid")
  const envelope: unknown = JSON.parse(rawBody)
  if (!envelope || typeof envelope !== "object" || !("resource" in envelope) || !("id" in envelope) || typeof envelope.id !== "string") {
    throw new Error("wechat_pay_callback_invalid")
  }
  const resource = envelope.resource
  if (!resource || typeof resource !== "object" || !("ciphertext" in resource) || !("nonce" in resource) || typeof resource.ciphertext !== "string" || typeof resource.nonce !== "string") {
    throw new Error("wechat_pay_callback_resource_invalid")
  }
  const encrypted = Uint8Array.from(Buffer.from(resource.ciphertext, "base64"))
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(required(config.apiV3Key, "wechat_pay_api_v3_key_missing")),
    "AES-GCM",
    false,
    ["decrypt"],
  )
  const additionalData = "associated_data" in resource && typeof resource.associated_data === "string"
    ? new TextEncoder().encode(resource.associated_data)
    : undefined
  const decryptedBuffer = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: new TextEncoder().encode(resource.nonce), additionalData, tagLength: 128 },
    key,
    encrypted,
  )
  const decrypted = new TextDecoder().decode(decryptedBuffer)
  const payment: unknown = JSON.parse(decrypted)
  if (!payment || typeof payment !== "object" || !("out_trade_no" in payment) || !("transaction_id" in payment) || !("amount" in payment) || !("success_time" in payment)) {
    throw new Error("wechat_pay_transaction_invalid")
  }
  if (!("mchid" in payment) || payment.mchid !== required(config.merchantId, "wechat_pay_merchant_id_missing")) throw new Error("wechat_pay_merchant_mismatch")
  if (!("appid" in payment) || payment.appid !== required(config.appId, "wechat_pay_app_id_missing")) throw new Error("wechat_pay_app_mismatch")
  const amount = payment.amount
  if (!amount || typeof amount !== "object" || !("total" in amount) || !("currency" in amount) || typeof amount.total !== "number" || typeof amount.currency !== "string") {
    throw new Error("wechat_pay_amount_invalid")
  }
  if (typeof payment.out_trade_no !== "string" || typeof payment.transaction_id !== "string" || typeof payment.success_time !== "string") throw new Error("wechat_pay_transaction_invalid")
  const paidAt = new Date(payment.success_time)
  if (Number.isNaN(paidAt.getTime())) throw new Error("wechat_pay_payment_time_invalid")
  return { channel: "wechat_pay", providerEventId: envelope.id, providerOrderId: payment.out_trade_no, providerTransactionId: payment.transaction_id, amountMinor: amount.total, currency: amount.currency, paidAt, eventType: "TRANSACTION.SUCCESS" }
}

export function verifyAlipayCallback(rawBody: string): VerifiedPayment {
  const params = new URLSearchParams(rawBody)
  const signature = required(params.get("sign") ?? undefined, "alipay_signature_missing")
  const verified = verify(
    "RSA-SHA256",
    new TextEncoder().encode(alipaySignable(params)),
    createPublicKey(required(env.renworkPayments.alipay.publicKey, "alipay_public_key_missing")),
    Uint8Array.from(Buffer.from(signature, "base64")),
  )
  if (!verified) throw new Error("alipay_signature_invalid")
  if (params.get("app_id") !== required(env.renworkPayments.alipay.appId, "alipay_app_id_missing")) throw new Error("alipay_app_mismatch")
  const status = params.get("trade_status")
  if (status !== "TRADE_SUCCESS" && status !== "TRADE_FINISHED") throw new Error("alipay_trade_not_paid")
  const providerOrderId = required(params.get("out_trade_no") ?? undefined, "alipay_order_id_missing")
  const providerTransactionId = required(params.get("trade_no") ?? undefined, "alipay_transaction_id_missing")
  const amount = Number(params.get("total_amount"))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("alipay_amount_invalid")
  const paidAt = new Date((params.get("gmt_payment") ?? "").replace(" ", "T") + "+08:00")
  if (Number.isNaN(paidAt.getTime())) throw new Error("alipay_payment_time_invalid")
  return {
    channel: "alipay",
    providerEventId: `${providerTransactionId}:${status}`,
    providerOrderId,
    providerTransactionId,
    amountMinor: Math.round(amount * 100),
    currency: "CNY",
    paidAt,
    eventType: status,
  }
}
