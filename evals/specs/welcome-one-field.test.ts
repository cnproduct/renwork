import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
const welcomePagePath = fileURLToPath(
  new URL("../../apps/app/src/react-app/domains/onboarding/welcome-page.tsx", import.meta.url),
);

test("the welcome screen follows verified account and tenant selection with runtime choice", async ({ evidence }) => {
  const welcomeSource = readFileSync(welcomePagePath, "utf8");

  expect(welcomeSource).not.toContain("OrganizationServerAffordance");
  expect(welcomeSource).not.toContain('data-testid="welcome-join-org"');
  expect(welcomeSource).toContain('data-testid="verified-account"');
  expect(welcomeSource).toContain('data-testid="runtime-managed"');
  expect(welcomeSource).toContain('data-testid="runtime-local"');
  expect(welcomeSource).toContain('data-testid="runtime-local-agent"');
  expect(welcomeSource).toContain('data-testid="runtime-byok"');
  expect(welcomeSource).toContain('data-testid="runtime-continue"');
  expect(welcomeSource).toContain("登录只用于确认身份、租户与可用权益");

  evidence.fact(
    "The welcome screen starts after RenWork has verified the account and selected a tenant",
    "The screen displays verified account and tenant context, then offers RenWork Cloud, local Agent, and BYOK execution choices without exposing server URL or provider setup to ordinary users.",
    true,
  );
});
