import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildSignInRoute,
  getSafeInternalReturnTo,
} from "../app/(den)/_lib/client-route";

const appRoot = fileURLToPath(new URL("../", import.meta.url));

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, `file://${appRoot}/`), "utf8");
}

describe("hosted sign-in return route", () => {
  test("builds a dedicated sign-in route with a safe internal return target", () => {
    expect(buildSignInRoute("/dashboard/inference")).toBe(
      "/sign-in?returnTo=%2Fdashboard%2Finference",
    );
    expect(getSafeInternalReturnTo("//example.com/steal")).toBeNull();
    expect(getSafeInternalReturnTo("https://example.com/steal")).toBeNull();
    expect(getSafeInternalReturnTo("/sign-in?returnTo=/dashboard")).toBeNull();
  });

  test("serves the normal authentication screen at the dedicated route", () => {
    expect(read("app/(den)/sign-in/page.tsx")).toContain("<AuthScreen />");
  });

  test("protected dashboard pages return signed-out users to their requested page", () => {
    const provider = read("app/(den)/dashboard/_providers/org-dashboard-provider.tsx");
    expect(provider).toContain("router.replace(buildSignInRoute(pathnameRef.current))");
    expect(provider).not.toContain('router.replace("/");');
  });

  test("the auth screen honors the safe return target after sign-in", () => {
    const screen = read("app/(den)/_components/auth-screen.tsx");
    expect(screen).toContain("authenticatedRedirectPath={authenticatedRedirectPath ?? undefined}");
    expect(screen).toContain("router.replace(returnTo)");
  });
});
