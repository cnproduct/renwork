import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const panel = readFileSync(join(import.meta.dir, "..", "components", "den-admin-panel.tsx"), "utf8");
const dialog = readFileSync(join(import.meta.dir, "..", "components", "offline-activation-dialog.tsx"), "utf8");
const route = readFileSync(join(import.meta.dir, "..", "..", "den-api", "src", "routes", "admin", "offline-commerce.ts"), "utf8");
const customerPlans = readFileSync(join(import.meta.dir, "..", "app", "(den)", "dashboard", "_components", "inference-screen.tsx"), "utf8");

describe("RenWork offline activation admin", () => {
  test("exposes one platform-admin entry from each organization row", () => {
    expect(panel).toContain("线下收款/开通");
    expect(panel).toContain("OfflineActivationDialog");
    expect(dialog).toContain("确认收款并开通");
    expect(dialog).toContain("配置模型与预算");
    expect(dialog).toContain("全部固定价格的个人版和企业版套餐均可线下收款开通");
    expect(dialog).toContain("企业定制版同样支持线下付款");
  });

  test("locks money and RenCredit to the authoritative offer", () => {
    expect(dialog).toContain("到账金额（目录锁定）");
    expect(dialog).toContain("本次入账");
    expect(dialog).toContain("当前目录没有 ¥100 加油包");
    expect(dialog).toContain("readOnly");
  });

  test("uses platform-admin routes for create, history and reversal", () => {
    expect(route.match(/adminRoute\(\)/g)?.length).toBe(10);
    expect(dialog).toContain("/v1/admin/renwork/offline-orders");
    expect(dialog).toContain("退款/冲正");
  });

  test("requires an organization-bound two-admin contract quote before custom activation", () => {
    expect(dialog).toContain('data-testid="enterprise-contract-quote-workflow"');
    expect(dialog).toContain("必须由另一位平台超级管理员审批");
    expect(dialog).toContain("第二管理员审批");
    expect(dialog).toContain("发布报价");
    expect(route).toContain("/v1/admin/renwork/contract-quotes");
    expect(route).toContain('denTypeIdSchema("renworkContractQuote")');
  });

  test("presents offline payment on every customer plan path", () => {
    expect(customerPlans).toContain("Every personal and enterprise plan supports offline payment");
    expect(customerPlans).toContain("Request offline activation");
    expect(customerPlans).toContain("Contact sales for offline contract");
    expect(customerPlans).toContain("Complete the offline payment or contract");
  });
});
