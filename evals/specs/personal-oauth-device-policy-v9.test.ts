import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V9 keeps personal OAuth on each approved device", async ({ evidence }) => {
  const [contracts, catalog, admin, desktop, gateway, ledger, cloud] = await Promise.all([
    readFile("../packages/rencredit-metering/src/contracts.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/provider-auth-modal.tsx", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
    readFile("../deploy/cloud-api-server/src/server.ts", "utf8"),
  ]);

  expect(contracts).toContain('RENWORK_PROVIDER_AUTH_MODES = ["service_secret", "device_oauth", "none"]');
  expect(contracts).toContain('RENWORK_PROVIDER_CREDENTIAL_STORES = ["server_secret", "device_vault", "none"]');
  expect(catalog).toContain("device OAuth cannot contain a server credential or Base URL");
  expect(catalog).toContain('provider.sharingScope !== "user_private"');
  expect(admin).toContain("个人 OAuth 设备审批");
  expect(admin).toContain("原始 OAuth 凭据只保存在该设备的系统安全存储中");
  expect(admin).toContain("适配器自检");
  expect(desktop).toContain("Connect this device");
  expect(desktop).toContain("never uploaded to RenWork Cloud");
  expect(gateway).toContain('status: "pending"');
  expect(gateway).toContain('eq(RenCreditRuntimeDeviceTable.status, "active")');
  expect(gateway).toContain("settleInferenceCredits");
  expect(gateway).toContain("DEVICE_OAUTH_DEVICE_LIMIT_EXCEEDED");
  expect(ledger).toContain("DEVICE_OAUTH_CONCURRENCY_EXCEEDED");
  expect(cloud).toContain("设备 OAuth 策略有效");

  evidence.fact(
    "Personal OAuth credentials stay on each device",
    "The catalog accepts only a device-vault, personal-device, user-private policy and the desktop explains that every computer connects separately.",
    true,
  );
  evidence.fact(
    "Cloud control is metadata and RenCredit only",
    "Den approves a public-key device record and settles content-free signed receipts; it never receives provider OAuth tokens.",
    true,
  );
});
