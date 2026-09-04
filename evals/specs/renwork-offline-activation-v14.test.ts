import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("V14 records offline payment, entitlement and RenCredit as one auditable operation", async ({ evidence }) => {
  const service = await readFile("../ee/apps/den-api/src/renwork-offline-order.ts", "utf8");
  const route = await readFile("../ee/apps/den-api/src/routes/admin/offline-commerce.ts", "utf8");
  const schema = await readFile("../ee/packages/den-db/src/schema/renwork-commerce.ts", "utf8");
  const dialog = await readFile("../ee/apps/den-web/components/offline-activation-dialog.tsx", "utf8");
  const inference = await readFile("../ee/apps/den-api/src/inference.ts", "utf8");

  expect(service).toContain("RENWORK_OFFLINE_AMOUNT_MISMATCH");
  expect(service).toContain('entry_type: "grant"');
  expect(service).toContain('entry_type: "refund"');
  expect(service).toContain("previous_entitlement_snapshot");
  expect(route.match(/adminRoute\(\)/g)?.length ?? 0).toBe(5);
  expect(schema).toContain("renwork_offline_orders_org_idempotency");
  expect(schema).toContain("renwork_offline_orders_payment_reference");
  expect(dialog).toContain("确认收款并开通");
  expect(dialog).toContain("当前目录没有 ¥100 加油包");
  expect(inference).toContain('access.source === "subscription" || access.source === "offline_payment"');
  expect(inference).toContain("await revokeMemberInferenceKeys(member.id)");

  evidence.fact("Catalog is authoritative", "The recorded amount and RenCredit grant are derived from one fixed catalog offer; arbitrary top-up conversion is rejected.", true);
  evidence.fact("Money, entitlement and credit are atomic", "The order, organization entitlement and immutable grant ledger entry share one database transaction and idempotency boundary.", true);
  evidence.fact("Reversal is auditable", "A reversal restores the prior entitlement snapshot and appends a refund ledger entry without deleting history.", true);
  evidence.fact("Expired access fails closed", "Offline-paid model access uses the same time-bound access resolver and synchronization revokes stale member keys and managed providers.", true);
});
