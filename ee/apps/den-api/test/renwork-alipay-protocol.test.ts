import { generateKeyPairSync, createSign } from "node:crypto"
import { expect, test } from "bun:test"
import { createAlipayCheckoutUrl, verifyAlipayNotification, verifyAlipayRefundResponse } from "../src/renwork-alipay-protocol.js"

const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 })
const alipay = generateKeyPairSync("rsa", { modulusLength: 2048 })
const config = {
  appId: "2021000000000000",
  sellerId: "2088000000000000",
  privateKey: merchant.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  publicKey: alipay.publicKey.export({ type: "spki", format: "pem" }).toString(),
}

function signedNotice(changes: Record<string, string> = {}) {
  const fields = new URLSearchParams({
    app_id: config.appId,
    seller_id: config.sellerId,
    out_trade_no: "rwao_test_order",
    trade_no: "alipay_test_trade",
    total_amount: "69.00",
    trade_status: "TRADE_SUCCESS",
    sign_type: "RSA2",
    ...changes,
  })
  const canonical = [...fields.entries()].filter(([key]) => key !== "sign_type")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("&")
  const signer = createSign("RSA-SHA256")
  signer.update(canonical)
  signer.end()
  fields.set("sign", signer.sign(alipay.privateKey, "base64"))
  return fields.toString()
}

test("checkout uses server-side amount and merchant RSA2 signature", () => {
  const url = new URL(createAlipayCheckoutUrl({ config, outTradeNo: "rwao_test_order", amountMinor: 6_900,
    title: "RenWork Light", notifyUrl: "https://api.example.test/v1/webhooks/renwork/alipay",
    returnUrl: "https://example.test/dashboard/inference" }))
  expect(url.origin).toBe("https://openapi.alipay.com")
  expect(JSON.parse(url.searchParams.get("biz_content") ?? "{}")).toMatchObject({ total_amount: "69.00", seller_id: config.sellerId })
  expect(url.searchParams.get("sign_type")).toBe("RSA2")
})

test("valid async payment and exact cents are accepted", () => {
  expect(verifyAlipayNotification(signedNotice(), config)).toEqual({
    outTradeNo: "rwao_test_order", providerTradeNo: "alipay_test_trade", amountMinor: 6_900,
  })
})

test("tampering, merchant mismatch, unsigned and unfinished events fail closed", () => {
  const tampered = new URLSearchParams(signedNotice())
  tampered.set("total_amount", "0.01")
  expect(() => verifyAlipayNotification(tampered.toString(), config)).toThrow("RENWORK_ALIPAY_SIGNATURE_INVALID")
  expect(() => verifyAlipayNotification(signedNotice({ app_id: "wrong" }), config)).toThrow("RENWORK_ALIPAY_MERCHANT_MISMATCH")
  expect(() => verifyAlipayNotification(signedNotice({ seller_id: "wrong" }), config)).toThrow("RENWORK_ALIPAY_MERCHANT_MISMATCH")
  expect(() => verifyAlipayNotification(signedNotice({ trade_status: "WAIT_BUYER_PAY" }), config)).toThrow("RENWORK_ALIPAY_TRADE_NOT_PAID")
  expect(() => verifyAlipayNotification("trade_status=TRADE_SUCCESS", config)).toThrow("RENWORK_ALIPAY_SIGNATURE_INVALID")
})

test("refund requires a signed response with confirmed fund change and exact amount", () => {
  const response = { code: "10000", fund_change: "Y", out_trade_no: "rwao_test_order", refund_fee: "69.00" }
  const raw = JSON.stringify(response)
  const signer = createSign("RSA-SHA256")
  signer.update(raw)
  signer.end()
  const body = `{"alipay_trade_refund_response":${raw},"sign":"${signer.sign(alipay.privateKey, "base64")}"}`
  expect(verifyAlipayRefundResponse(body, config, { outTradeNo: "rwao_test_order", amountMinor: 6_900 })).toBe(true)
  expect(() => verifyAlipayRefundResponse(body, config, { outTradeNo: "rwao_test_order", amountMinor: 7_000 }))
    .toThrow("RENWORK_ALIPAY_REFUND_UNCONFIRMED")
  expect(() => verifyAlipayRefundResponse(body.replace("69.00", "70.00"), config,
    { outTradeNo: "rwao_test_order", amountMinor: 6_900 })).toThrow("RENWORK_ALIPAY_RESPONSE_SIGNATURE_INVALID")
  const uncertain = JSON.stringify({ ...response, fund_change: "N" })
  const signer2 = createSign("RSA-SHA256")
  signer2.update(uncertain)
  signer2.end()
  expect(() => verifyAlipayRefundResponse(`{"alipay_trade_refund_response":${uncertain},"sign":"${signer2.sign(alipay.privateKey, "base64")}"}`,
    config, { outTradeNo: "rwao_test_order", amountMinor: 6_900 })).toThrow("RENWORK_ALIPAY_REFUND_UNCONFIRMED")
})
