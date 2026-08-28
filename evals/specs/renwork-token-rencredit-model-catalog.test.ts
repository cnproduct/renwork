import { expect } from "vitest";
import { test } from "@openwork/testkit";

import {
  createRenCreditBillingService,
  normalizeOpenCodeUsage,
  requireSuperAdmin,
  toPublicModelCatalog,
} from "../../packages/rencredit-metering/src/index";
import { createTestCatalog } from "../../packages/rencredit-metering/src/test-fixtures";

test("RenWork meters every model token behind a super-admin catalog", async ({ evidence }) => {
  const adminCatalog = createTestCatalog();
  expect(() => requireSuperAdmin("member")).toThrow("super_admin");

  const publicCatalog = toPublicModelCatalog(adminCatalog, new Date("2026-08-28T12:00:00.000Z"));
  expect(publicCatalog.models.map((model) => model.providerID)).toEqual(["renwork"]);
  expect(JSON.stringify(publicCatalog)).not.toContain("openrouter");
  expect(JSON.stringify(publicCatalog)).not.toContain("credentialRef");

  const service = createRenCreditBillingService({
    catalog: adminCatalog,
    wallets: { org_eval: 1_000 },
    now: () => new Date("2026-08-28T12:00:00.000Z"),
  });
  const quote = service.quote({
    modelSku: "renwork-standard",
    estimatedUsage: normalizeOpenCodeUsage({
      input: 40,
      output: 40,
      reasoning: 40,
      cache: { read: 40, write: 40 },
    }),
  });
  const reservation = service.reserve({
    quoteId: quote.id,
    tenantId: "org_eval",
    userId: "member_eval",
    idempotencyKey: "eval-reserve",
  });
  const receipt = service.settle({
    reservationId: reservation.id,
    runId: "run_eval",
    events: [{
      id: "usage_eval",
      runId: "run_eval",
      modelSku: "renwork-standard",
      routeId: "route-openrouter-standard",
      providerResponseId: "provider_response_eval",
      usage: normalizeOpenCodeUsage({ input: 20, output: 20, reasoning: 20, cache: { read: 20, write: 20 } }),
      measuredAt: "2026-08-28T12:00:01.000Z",
      accuracy: "reported",
    }],
    idempotencyKey: "eval-settle",
  });
  expect(receipt.capturedMicroCredits).toBeGreaterThan(0);
  expect(receipt.releasedMicroCredits).toBeGreaterThan(0);
  expect(service.getBalance("org_eval")).toBe(950);

  evidence.fact(
    "RenWork model choice is separated from provider routing",
    "Members receive only published RenWork model SKUs and multipliers, while provider routes and secret references remain super-admin-only.",
    true,
  );
  evidence.fact(
    "All reported token classes settle through RenCredit",
    "Input, output, reasoning, cache-read, and cache-write usage are quoted, reserved, captured once, and unused credit is released.",
    true,
  );
});
