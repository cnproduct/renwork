import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import {
  parseInviteLinkInput,
  parseServerUrlInput,
} from "../../apps/app/src/react-app/domains/cloud/join-organization-input";

const welcomePagePath = fileURLToPath(
  new URL("../../apps/app/src/react-app/domains/onboarding/welcome-page.tsx", import.meta.url),
);
const dialogPath = fileURLToPath(
  new URL("../../apps/app/src/react-app/domains/cloud/join-organization-dialog.tsx", import.meta.url),
);
test("the post-sign-in welcome screen offers RenWork managed, local, and BYOK model sources", async ({ evidence }) => {
  const welcomeSource = readFileSync(welcomePagePath, "utf8");
  const dialogSource = readFileSync(dialogPath, "utf8");

  const invite = parseInviteLinkInput("https://den.acme.test/join-org?invite=inv_123");
  expect(invite).toEqual({
    url: "https://den.acme.test/join-org?invite=inv_123",
    origin: "https://den.acme.test",
    host: "den.acme.test",
  });
  expect(parseInviteLinkInput("https://den.acme.test/install?token=abc")).toBeNull();
  expect(parseServerUrlInput("https://openwork.acme.test/")).toEqual({
    url: "https://openwork.acme.test",
    host: "openwork.acme.test",
  });
  expect(parseServerUrlInput("openwork://den-auth?grant=abcdefghijkl")).toBeNull();
  expect(parseServerUrlInput("raw-sign-in-grant-value")).toBeNull();

  expect(welcomeSource).not.toContain("OrganizationServerAffordance");
  expect(welcomeSource).toContain('data-testid="welcome-model-source-managed"');
  expect(welcomeSource).toContain('data-testid="welcome-model-source-local"');
  expect(welcomeSource).toContain('data-testid="welcome-model-source-byok"');
  expect(welcomeSource).toContain('data-testid="welcome-model-source-continue"');
  expect(welcomeSource).toContain("RenWork 托管");
  expect(welcomeSource).not.toContain("OpenDesign");
  expect(dialogSource).toContain("if (await submitInstallLink(trimmedInput)) return;");
  expect(dialogSource).toContain("if (await submitInviteLink(trimmedInput)) return;");
  expect(dialogSource).toContain("if (await submitServerUrl(trimmedInput)) return;");
  expect(dialogSource).toContain("if (await submitManualAuth(trimmedInput)) return;");
  expect(dialogSource).toContain("setPendingInvite(parsed)");
  expect(dialogSource).toContain('data-testid="join-invite-confirm-dialog"');
  expect(dialogSource).toContain("saveControlPlaneUrl(invite.origin)");
  expect(dialogSource).toContain("platform.openLink(invite.url)");

  evidence.fact(
    "The post-sign-in welcome screen keeps provider setup simple and RenWork branded",
    "Members choose RenWork managed service, a local agent, or BYOK; organization invite parsing remains in the dedicated join dialog and no OpenDesign label is exposed.",
    true,
  );
});
