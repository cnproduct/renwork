import { createSign, createVerify } from "node:crypto"

const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do"

export type AlipayConfiguration = {
  appId: string
  sellerId: string
  privateKey: string
  publicKey: string
}

function pem(value: string, kind: "PRIVATE" | "PUBLIC") {
  const normalized = value.replace(/\\n/g, "\n").trim()
  if (normalized.includes("-----BEGIN")) return normalized
  return `-----BEGIN ${kind} KEY-----\n${normalized.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END ${kind} KEY-----`
}

function canonical(params: URLSearchParams, excluded: ReadonlySet<string>) {
  return [...params.entries()]
    .filter(([key, value]) => !excluded.has(key) && value !== "")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
}

export function signAlipayRequest(params: URLSearchParams, privateKey: string) {
  const signer = createSign("RSA-SHA256")
  signer.update(canonical(params, new Set(["sign"])), "utf8")
  signer.end()
  return signer.sign(pem(privateKey, "PRIVATE"), "base64")
}

export function createAlipayCheckoutUrl(input: {
  config: AlipayConfiguration
  outTradeNo: string
  amountMinor: number
  title: string
  notifyUrl: string
  returnUrl: string
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("RENWORK_ALIPAY_AMOUNT_INVALID")
  const params = new URLSearchParams({
    app_id: input.config.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    biz_content: JSON.stringify({
      out_trade_no: input.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: (input.amountMinor / 100).toFixed(2),
      subject: input.title.slice(0, 120),
      seller_id: input.config.sellerId,
    }),
  })
  params.set("sign", signAlipayRequest(params, input.config.privateKey))
  return `${ALIPAY_GATEWAY}?${params.toString()}`
}

export function verifyAlipayNotification(body: string, config: AlipayConfiguration) {
  const params = new URLSearchParams(body)
  const signature = params.get("sign")
  if (!signature || params.get("sign_type") !== "RSA2") throw new Error("RENWORK_ALIPAY_SIGNATURE_INVALID")
  const verifier = createVerify("RSA-SHA256")
  verifier.update(canonical(params, new Set(["sign", "sign_type"])), "utf8")
  verifier.end()
  if (!verifier.verify(pem(config.publicKey, "PUBLIC"), signature, "base64")) {
    throw new Error("RENWORK_ALIPAY_SIGNATURE_INVALID")
  }
  if (params.get("app_id") !== config.appId || params.get("seller_id") !== config.sellerId) {
    throw new Error("RENWORK_ALIPAY_MERCHANT_MISMATCH")
  }
  const amount = params.get("total_amount")
  if (!amount || !/^\d+\.\d{2}$/.test(amount)) throw new Error("RENWORK_ALIPAY_AMOUNT_INVALID")
  const [yuan, cents] = amount.split(".")
  const amountMinor = Number(yuan) * 100 + Number(cents)
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("RENWORK_ALIPAY_AMOUNT_INVALID")
  const outTradeNo = params.get("out_trade_no")
  const providerTradeNo = params.get("trade_no")
  const status = params.get("trade_status")
  if (!outTradeNo || !providerTradeNo || (status !== "TRADE_SUCCESS" && status !== "TRADE_FINISHED")) {
    throw new Error("RENWORK_ALIPAY_TRADE_NOT_PAID")
  }
  return { outTradeNo, providerTradeNo, amountMinor }
}

function rawResponseObject(body: string, key: string) {
  const match = `"${key}":`
  const keyStart = body.indexOf(match)
  if (keyStart < 0) throw new Error("RENWORK_ALIPAY_RESPONSE_INVALID")
  const start = body.indexOf("{", keyStart + match.length)
  if (start < 0 || body.slice(keyStart + match.length, start).trim()) throw new Error("RENWORK_ALIPAY_RESPONSE_INVALID")
  let depth = 0
  let quoted = false
  let escaped = false
  for (let index = start; index < body.length; index++) {
    const char = body[index]
    if (escaped) { escaped = false; continue }
    if (char === "\\" && quoted) { escaped = true; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (quoted) continue
    if (char === "{") depth++
    if (char === "}" && --depth === 0) return body.slice(start, index + 1)
  }
  throw new Error("RENWORK_ALIPAY_RESPONSE_INVALID")
}

export function verifyAlipayRefundResponse(body: string, config: AlipayConfiguration, expected: {
  outTradeNo: string
  amountMinor: number
}) {
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { throw new Error("RENWORK_ALIPAY_RESPONSE_INVALID") }
  if (!parsed || typeof parsed !== "object" || !("sign" in parsed) || typeof parsed.sign !== "string") {
    throw new Error("RENWORK_ALIPAY_RESPONSE_INVALID")
  }
  const raw = rawResponseObject(body, "alipay_trade_refund_response")
  const verifier = createVerify("RSA-SHA256")
  verifier.update(raw, "utf8")
  verifier.end()
  if (!verifier.verify(pem(config.publicKey, "PUBLIC"), parsed.sign, "base64")) {
    throw new Error("RENWORK_ALIPAY_RESPONSE_SIGNATURE_INVALID")
  }
  const response: unknown = JSON.parse(raw)
  if (!response || typeof response !== "object" || !("code" in response) || response.code !== "10000"
    || !("fund_change" in response) || response.fund_change !== "Y"
    || !("out_trade_no" in response) || response.out_trade_no !== expected.outTradeNo
    || !("refund_fee" in response) || response.refund_fee !== (expected.amountMinor / 100).toFixed(2)) {
    // fund_change=N / absent requires a separately verified refund query.
    throw new Error("RENWORK_ALIPAY_REFUND_UNCONFIRMED")
  }
  return true
}

export async function requestAlipayFullRefund(input: {
  config: AlipayConfiguration
  outTradeNo: string
  providerTradeNo: string
  amountMinor: number
  requestNo: string
  reason: string
}) {
  const params = new URLSearchParams({
    app_id: input.config.appId,
    method: "alipay.trade.refund",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    version: "1.0",
    biz_content: JSON.stringify({ out_trade_no: input.outTradeNo, trade_no: input.providerTradeNo,
      refund_amount: (input.amountMinor / 100).toFixed(2), refund_reason: input.reason.slice(0, 256),
      out_request_no: input.requestNo }),
  })
  params.set("sign", signAlipayRequest(params, input.config.privateKey))
  const response = await fetch(ALIPAY_GATEWAY, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params, signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error("RENWORK_ALIPAY_REFUND_UNCONFIRMED")
  verifyAlipayRefundResponse(await response.text(), input.config,
    { outTradeNo: input.outTradeNo, amountMinor: input.amountMinor })
}
