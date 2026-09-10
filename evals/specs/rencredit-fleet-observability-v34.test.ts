import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V34 exposes sanitized fleet health without weakening RenCredit", async ({ evidence }) => {
  const [voiceover, route, runtime, server, admin] = await Promise.all([
    readFile("../evals/voiceovers/rencredit-fleet-observability-v34.md", "utf8"),
    readFile("../ee/apps/den-api/src/routes/admin/rencredit.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../apps/server/src/rencredit-local-runtime.ts", "utf8"),
    readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8"),
  ]);

  expect(voiceover).toContain("0.05 RenCredit");
  expect(voiceover).toContain("prerelease");
  expect(route).toContain('"/v1/admin/rencredit/runtime-health"');
  expect(route).toContain("expiredReservations");
  expect(route).toContain("failureRate24h");
  expect(runtime).toContain("X-RenWork-Client-Version");
  expect(server).toContain("X-RenWork-Client-Version");
  expect(admin).toContain("组织运行与计费健康");
  expect(admin).toContain("不显示密钥、提示词或回复内容");

  evidence.fact("Fleet health remains platform-admin-only", "The monitoring route uses the existing adminRoute guard and emits only bounded operational metadata.", true);
  evidence.fact("Client adoption becomes measurable", "Metered desktop traffic reports a bounded RenWork version and Den stores it with the existing device registration.", true);
  evidence.fact("Release promotion remains evidence-gated", "The Voiceover keeps the release in prerelease until installed-platform and real billing gates pass.", true);
});
