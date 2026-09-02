import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(...parts: string[]) {
  return readFileSync(join(import.meta.dir, ...parts), "utf8");
}

describe("Voiceover V13 visible RenWork identity and settlement audit", () => {
  test("uses RenWork identity on the dashboard and brand settings surfaces", () => {
    const dashboard = source("..", "app", "(den)", "dashboard", "_components", "dashboard-overview-screen.tsx");
    const branding = source("..", "app", "(den)", "dashboard", "_components", "brand-appearance-screen.tsx");
    const shell = source("..", "app", "(den)", "dashboard", "_components", "org-dashboard-shell.tsx");

    expect(dashboard).not.toContain("OpenWork users");
    expect(dashboard).toContain("RenWork users");
    expect(branding).not.toContain("Default OpenWork");
    expect(branding).toContain("Default RenWork");
    expect(shell).toContain('src="/renwork-mark.png"');
    expect(shell).not.toContain('return "OpenWork Web"');
  });

  test("renders the platform-only freeze, capture, release, route and tenant-ledger audit", () => {
    const admin = source("..", "components", "renwork-model-catalog-admin.tsx");

    expect(admin).toContain('data-testid="rencredit-settlement-audit"');
    expect(admin).toContain("冻结中");
    expect(admin).toContain("已扣费");
    expect(admin).toContain("已释放");
    expect(admin).toContain("providerId");
    expect(admin).toContain("不可变租户账本");
  });
});
