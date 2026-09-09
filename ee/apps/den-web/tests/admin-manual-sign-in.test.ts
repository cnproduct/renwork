import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, `file://${appRoot}/`), "utf8");
}

describe("platform admin manual sign-in", () => {
  test("admin access errors open the dedicated sign-in route instead of the marketing homepage", () => {
    const source = read("components/den-admin-panel.tsx");
    expect(source).toContain('href="/admin/sign-in"');
    expect(source).not.toMatch(/href="\/"[\s\S]{0,180}Open sign-in page/);
  });

  test("the dedicated route is password-first, sign-in-only, and returns to admin", () => {
    const source = read("app/admin/sign-in/page.tsx");
    expect(source).toContain('initialMode="sign-in"');
    expect(source).toContain("signInOnly");
    expect(source).toContain("hideSocialAuth");
    expect(source).toContain('authenticatedRedirectPath="/admin"');
    const authPanel = read("app/(den)/_components/auth-panel.tsx");
    expect(authPanel).toContain('signInOnly && authMode !== "sign-in"');
  });

  test("successful authentication honors the explicit admin destination", () => {
    const source = read("app/(den)/_components/auth-panel.tsx");
    expect(source).toContain("if (next && authenticatedRedirectPath)");
    expect(source).toContain("router.replace(authenticatedRedirectPath)");
  });

  test("an existing session can continue or switch accounts", () => {
    const source = read("app/admin/sign-in/status.tsx");
    expect(source).toContain('router.replace("/admin")');
    expect(source).toContain("await signOut()");
    expect(source).toContain("切换管理员账号");
  });
});
