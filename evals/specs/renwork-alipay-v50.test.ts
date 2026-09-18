import { generateKeyPairSync, createSign } from "node:crypto";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { createAlipayCheckoutUrl, verifyAlipayNotification } from "../../ee/apps/den-api/src/renwork-alipay-protocol";

test("V50 Alipay request and verified notification are bound to the merchant and immutable amount", async ({ evidence }) => {
  const merchant = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const alipay = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const config = {
    appId: "2021000000000000", sellerId: "2088000000000000",
    privateKey: merchant.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: alipay.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
  const checkout = new URL(createAlipayCheckoutUrl({
    config, outTradeNo: "rwao_test", amountMinor: 6_900, title: "RenWork Light",
    notifyUrl: "https://api.example.test/v1/webhooks/renwork/alipay",
    returnUrl: "https://example.test/dashboard/inference",
  }));
  expect(checkout.origin).toBe("https://openapi.alipay.com");
  expect(JSON.parse(checkout.searchParams.get("biz_content") ?? "{}").total_amount).toBe("69.00");

  const fields = new URLSearchParams({
    app_id: config.appId, seller_id: config.sellerId, out_trade_no: "rwao_test", trade_no: "trade_1",
    total_amount: "69.00", trade_status: "TRADE_SUCCESS", sign_type: "RSA2",
  });
  const canonical = [...fields.entries()].filter(([key]) => key !== "sign_type")
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("&");
  const signer = createSign("RSA-SHA256");
  signer.update(canonical);
  signer.end();
  fields.set("sign", signer.sign(alipay.privateKey, "base64"));
  expect(verifyAlipayNotification(fields.toString(), config).amountMinor).toBe(6_900);
  fields.set("total_amount", "0.01");
  expect(() => verifyAlipayNotification(fields.toString(), config)).toThrow("RENWORK_ALIPAY_SIGNATURE_INVALID");
  evidence.fact("Server amount", "The signed cashier URL uses the server-supplied 6900 cents.", true);
  evidence.fact("Verified callback", "Only the merchant-bound signed callback yields 6900 cents; a changed amount is rejected.", true);
});
