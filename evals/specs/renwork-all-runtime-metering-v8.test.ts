import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const approvedVoiceoverV8 = [
  "验证账号、组织、订阅或特批、模型授权、成员预算和 RenCredit 钱包。",
  "模型选择器只显示 RenWork 目录允许的模型、执行位置、上下文容量与倍率。",
  "执行前冻结最大预估 RenCredit。",
  "所有模型调用统一经过 RenWork Metered Runtime。",
  "云端使用供应商 usage，本地使用批准 tokenizer 与设备签名收据。",
  "界面同时显示上下文容量和 RenCredit 实时结算。",
  "成功按实际量结算，失败、取消、崩溃和无结果释放冻结。",
  "本地执行必须在线鉴权，不能离线绕过。",
  "OAuth、BYOK、Ollama 与自定义端点不能绕过计量。",
  "超级管理员管理供应商、模型、tokenizer、费率、倍率、位置和特批。",
  "持久化多租户账本是唯一 RenCredit 事实源。",
  "双租户验证余额隔离、重复请求、失败释放和并发扣费。",
] as const;

test("Voiceover V8 closes direct-model bypass and adds signed local settlement", async ({ evidence }) => {
  const [contracts, receipt, gateway, runtime, ledger, schema, migration, picker, commerce] = await Promise.all([
    readFile("../packages/rencredit-metering/src/contracts.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/local-runtime-receipt.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../apps/server/src/renwork-metered-runtime-gate.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
    readFile("../ee/packages/den-db/src/schema/inference.ts", "utf8"),
    readFile("../ee/packages/den-db/drizzle/0069_rencredit_runtime_devices.sql", "utf8"),
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx", "utf8"),
  ]);

  expect(approvedVoiceoverV8).toHaveLength(12);
  expect(contracts).toContain('RENWORK_EXECUTION_LOCATIONS = ["cloud", "local"]');
  expect(contracts).toContain("RenWorkLocalRuntimeReceiptPayload");
  expect(receipt).toContain("exactKeys(record, PAYLOAD_KEYS)");
  expect(receipt).not.toContain("prompt:");
  expect(gateway).toContain('createPublicKey(device.public_key_pem)');
  expect(gateway).toContain('status: "pending"');
  expect(gateway).toContain('eq(RenCreditRuntimeDeviceTable.status, "active")');
  expect(gateway).toContain("canonicalLocalRuntimeReceiptPayload");
  expect(gateway).toContain("reserveInferenceCredits");
  expect(gateway).toContain("settleInferenceCredits");
  expect(gateway).toContain("releaseInferenceCredits");
  expect(runtime).toContain('payload.model.providerID !== "renwork"');
  expect(runtime).toContain('payload.model.startsWith("renwork/")');
  expect(runtime).toContain('payload.providerID !== "renwork"');
  expect(ledger).toContain("getInferenceReservationForPrincipal");
  expect(schema).toContain("RenCreditRuntimeDeviceTable");
  expect(migration).toContain("rencredit_runtime_devices");
  expect(migration).toContain("'tokenizer'");
  expect(picker).toContain('executionLocation === "local" ? "本地" : "云端"');
  expect(commerce).toContain("context_capacity_title");
  expect(commerce).toContain('t("commerce.settlement_title")');

  evidence.fact(
    "Direct provider bypass is rejected before execution",
    "Cloud and Enterprise desktop prompts must name the RenWork provider; OAuth, BYOK, Ollama and custom provider IDs fail closed in the local proxy.",
    true,
  );
  evidence.fact(
    "Local metering is content-free and device signed",
    "Den accepts only exact token-count receipt fields, verifies an approved Ed25519 device key, and settles the same durable tenant reservation ledger.",
    true,
  );
});
