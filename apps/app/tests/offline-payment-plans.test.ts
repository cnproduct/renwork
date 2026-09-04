import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("RenWork offline plan channels", () => {
  test("shows offline activation for fixed and contract-priced plans", () => {
    const view = read("../src/react-app/domains/settings/pages/renwork-commerce-view.tsx");
    const zh = read("../src/i18n/locales/zh.ts");
    const en = read("../src/i18n/locales/en.ts");

    expect(view).toContain('data-testid="offline-payment-channel"');
    expect(zh).toContain('"commerce.cta_request_access": "申请线下开通"');
    expect(zh).toContain('"commerce.cta_contact_sales": "联系销售并线下签约"');
    expect(en).toContain('"commerce.cta_request_access": "Request offline activation"');
    expect(en).toContain('"commerce.cta_contact_sales": "Contact sales for offline contract"');
  });
});
