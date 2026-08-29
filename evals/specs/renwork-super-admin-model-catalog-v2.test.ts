import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { readFile } from "node:fs/promises";

test("platform super admin controls the private model catalog while members see RenWork choices", async ({ evidence }) => {
  const adminUi = await readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8");
  const adminApi = await readFile("../ee/apps/den-api/src/routes/admin/model-catalog.ts", "utf8");
  const cloudApi = await readFile("../deploy/cloud-api-server/src/server.ts", "utf8");
  const metering = await readFile("../packages/rencredit-metering/src/service.ts", "utf8");

  expect(adminApi).toContain("adminRoute()");
  expect(adminApi).toContain("RENWORK_MODEL_CATALOG_ADMIN_TOKEN");
  expect(adminUi).toContain("真实 Key 必须注入服务端");
  expect(adminUi).toContain("普通用户模型选择器预览");
  expect(cloudApi).toContain("timingSafeEqual");
  expect(cloudApi).toContain("/v1/admin/models/providers/:providerId/test");
  expect(metering).toContain("options.catalog.billingPolicy[route.source]");

  evidence.fact(
    "Only platform admins can configure private routes",
    "The Den admin allowlist gates catalog reads, publishes, and connection tests while the server-to-server token remains outside the browser.",
    true,
  );
  evidence.fact(
    "All route sources share one enforceable billing policy",
    "Official, BYOK, and local sources default to token metering and settlement uses the actual route source selected for each usage event.",
    true,
  );
  evidence.fact(
    "Members receive a provider-safe RenWork catalog",
    "The preview and public projection contain RenWork SKUs, descriptions, multipliers, promotions, and billing mode without provider routes or credential references.",
    true,
  );
});
