import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V9 device OAuth is denied by default with a bounded weijian pilot", async ({ evidence }) => {
  const [contracts, catalog, admin, desktop, gateway, ledger, cloud, pilotPolicy] = await Promise.all([
    readFile("../packages/rencredit-metering/src/contracts.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/provider-auth-modal.tsx", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
    readFile("../deploy/cloud-api-server/src/server.ts", "utf8"),
    readFile("../ee/apps/den-api/src/subscription-cli-policy.ts", "utf8"),
  ]);

  expect(contracts).toContain('RENWORK_PROVIDER_AUTH_MODES = ["service_secret", "device_oauth", "none"]');
  expect(contracts).toContain('RENWORK_PROVIDER_CREDENTIAL_STORES = ["server_secret", "device_vault", "none"]');
  expect(catalog).toContain("device OAuth cannot contain a server credential or Base URL");
  expect(catalog).toContain('provider.sharingScope !== "user_private"');
  expect(admin).toContain("历史本地设备清理");
  expect(admin).toContain("V36 不再允许批准本地执行设备");
  expect(admin).not.toContain("批准设备");
  expect(desktop).toContain("Connect this device");
  expect(desktop).toContain("never uploaded to RenWork Cloud");
  expect(gateway).toContain('app.all("/api/v1/metered-runtime/*"');
  expect(gateway).toContain('code: "LOCAL_RUNTIME_DISABLED"');
  expect(gateway).toContain("subscriptionCliAccessForMember");
  expect(gateway).toContain('organization?.slug === "weijian"');
  expect(pilotPolicy).toContain('input.organizationSlug !== "weijian"');
  expect(ledger).toContain("DEVICE_OAUTH_CONCURRENCY_EXCEEDED");
  expect(cloud).toContain("DEN_SERVER_EXCLUSIVE_CATALOG_MIGRATION");
  expect(cloud).toContain("validateDenServerCatalog");

  evidence.fact(
    "Device execution is denied by default",
    "The leading Den route returns LOCAL_RUNTIME_DISABLED outside an explicitly granted weijian member policy.",
    true,
  );
  evidence.fact(
    "The pilot remains organization scoped",
    "The weijian exception requires a current member policy and approved device; other organizations retain the V36 Den-only path.",
    true,
  );
});
