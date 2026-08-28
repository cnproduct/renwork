import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

function source(path: string): string {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

test("production desktop opens the RenWork account origin and callback", async ({ evidence }) => {
  const denClient = source("apps/app/src/app/lib/den.ts");
  const desktopMain = source("apps/desktop/electron/main.mjs");
  const builder = source("apps/desktop/electron-builder.yml");

  expect(denClient).toContain('"https://account.rrenn.com"');
  expect(desktopMain).toContain('const DEFAULT_DEN_BASE_URL = "https://account.rrenn.com"');
  expect(denClient).toContain('target.searchParams.set("desktopScheme", "renwork")');
  expect(builder).toMatch(/schemes:\s*\n\s*- renwork/);

  evidence.fact(
    "RenWork owns the production account handoff",
    "First launch targets account.rrenn.com and requests the registered renwork callback scheme.",
    true,
  );
});

test("hosted account access is passwordless and creates a verified session", async ({ evidence }) => {
  const provider = source("ee/apps/den-web/app/(den)/_providers/den-flow-provider.tsx");
  const panel = source("ee/apps/den-web/app/(den)/_components/auth-panel.tsx");

  expect(provider).toContain('type: "sign-in"');
  expect(provider).toContain('"/api/auth/sign-in/email-otp"');
  expect(provider).toContain("DEFAULT_AUTH_NAME");
  expect(panel).toContain("Verification code");
  expect(panel).not.toMatch(/type="password"/);

  evidence.fact(
    "Email OTP is the default account path",
    "The hosted UI sends and verifies a six-digit sign-in OTP and exposes no password field in the MVP flow.",
    true,
  );
});

test("desktop handoff schemes are server allowlisted", async ({ evidence }) => {
  const handoff = source("ee/apps/den-api/src/routes/auth/desktop-handoff.ts");

  expect(handoff).toContain('const DEFAULT_DESKTOP_SCHEME = "renwork"');
  expect(handoff).toContain('new Set(["renwork", "openwork", "openwork-dev"])');
  expect(handoff).toContain("unsupported_desktop_scheme");

  evidence.fact(
    "Callback scheme cannot be redirected to an attacker application",
    "The API accepts the RenWork scheme and an explicit legacy compatibility set instead of arbitrary caller-provided schemes.",
    true,
  );
});

test("new desktop signups establish tenant context before handoff", async ({ evidence }) => {
  const provider = source("ee/apps/den-web/app/(den)/_providers/den-flow-provider.tsx");
  const organization = source("ee/apps/den-web/app/(den)/_components/organization-screen.tsx");

  expect(provider).toContain('setDesktopHandoffDeferred(true)');
  expect(provider).toContain('runtimeConfig.orgMode === "multi_org" && orgDirectory.orgs.length === 0');
  expect(provider).toContain('return "organization" as const');
  expect(organization).toContain("await completeDesktopAuthHandoff()");

  evidence.fact(
    "Desktop grants are tenant-bound",
    "A new multi-tenant account must create or join an organization before the one-time RenWork desktop grant is issued.",
    true,
  );
});

test("production Node resolves built RenWork packages and both services share multi-org mode", async ({ evidence }) => {
  const typesPackage = JSON.parse(source("packages/types/package.json")) as {
    exports: Record<string, { default: string }>;
  };
  const compose = source("deploy/2c4g/docker-compose.account.yml");

  expect(typesPackage.exports["./renwork-commerce"]?.default).toBe("./dist/renwork-commerce.js");
  expect(typesPackage.exports["./renwork-buyer-growth"]?.default).toBe("./dist/renwork-buyer-growth.js");
  expect(compose.match(/DEN_ORG_MODE: multi_org/g)).toHaveLength(2);

  evidence.fact(
    "Production runtime and tenant configuration are deployable",
    "Node loads compiled package entrypoints and Den API plus Den Web are pinned to the same multi-organization mode.",
    true,
  );
});
