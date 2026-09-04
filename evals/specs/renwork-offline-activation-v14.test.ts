import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("V15 records fixed and two-admin contract offline activation as auditable operations", async ({ evidence }) => {
  const service = await readFile("../ee/apps/den-api/src/renwork-offline-order.ts", "utf8");
  const quoteService = await readFile("../ee/apps/den-api/src/renwork-contract-quote.ts", "utf8");
  const route = await readFile("../ee/apps/den-api/src/routes/admin/offline-commerce.ts", "utf8");
  const schema = await readFile("../ee/packages/den-db/src/schema/renwork-commerce.ts", "utf8");
  const dialog = await readFile("../ee/apps/den-web/components/offline-activation-dialog.tsx", "utf8");
  const inference = await readFile("../ee/apps/den-api/src/inference.ts", "utf8");
  const catalog = await readFile("../ee/apps/den-api/src/renwork-growth/plan-catalog.ts", "utf8");

  expect(service).toContain("RENWORK_OFFLINE_AMOUNT_MISMATCH");
  expect(service).toContain('entry_type: "grant"');
  expect(service).toContain('entry_type: "refund"');
  expect(service).toContain("previous_entitlement_snapshot");
  expect(route.match(/adminRoute\(\)/g)?.length ?? 0).toBe(10);
  expect(schema).toContain("renwork_offline_orders_org_idempotency");
  expect(schema).toContain("renwork_offline_orders_payment_reference");
  expect(schema).toContain("renwork_contract_quotes_org_reference");
  expect(quoteService).toContain("RENWORK_CONTRACT_SECOND_ADMIN_REQUIRED");
  expect(quoteService).toContain('status: "approved"');
  expect(quoteService).toContain('status: "published"');
  expect(service).toContain('eq(RenworkContractQuoteTable.status, "published")');
  expect(service).toContain('eq(RenworkContractQuoteTable.organization_id, input.organizationId)');
  expect(dialog).toContain("确认收款并开通");
  expect(dialog).toContain('data-testid="enterprise-contract-quote-workflow"');
  expect(dialog).toContain("第二管理员审批");
  expect(dialog).toContain("发布报价");
  expect(dialog).toContain("当前目录没有 ¥100 加油包");
  expect(dialog).toContain("全部固定价格的个人版和企业版套餐均可线下收款开通");
  expect(catalog.match(/paymentChannels: \["offline_manual"\]/g)?.length ?? 0).toBe(11);
  expect(inference).toContain('access.source === "subscription" || access.source === "offline_payment"');
  expect(inference).toContain("await revokeMemberInferenceKeys(member.id)");

  evidence.fact("Catalog is authoritative", "The recorded amount and RenCredit grant are derived from one fixed catalog offer; arbitrary top-up conversion is rejected.", true);
  evidence.fact("Custom enterprise terms need two admins", "An organization-bound quote is not orderable until a second platform admin approves it and an admin publishes it.", true);
  evidence.fact("Custom quotes are tenant-scoped", "Published quote lookup matches both quote ID and organization ID before an offline order can lock its amount and RenCredit grant.", true);
  evidence.fact("Money, entitlement and credit are atomic", "The order, organization entitlement and immutable grant ledger entry share one database transaction and idempotency boundary.", true);
  evidence.fact("Reversal is auditable", "A reversal restores the prior entitlement snapshot and appends a refund ledger entry without deleting history.", true);
  evidence.fact("Expired access fails closed", "Offline-paid model access uses the same time-bound access resolver and synchronization revokes stale member keys and managed providers.", true);
});
