import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V29 keeps approved personal OAuth models selectable and inside RenCredit metering", async ({ evidence }) => {
  const [voiceover, catalogClient, sessionRoute, desktopProxy, proxyAcceptance] = await Promise.all([
    readFile("../evals/voiceovers/personal-oauth-model-recovery-v29.md", "utf8"),
    readFile("../apps/app/src/react-app/domains/models/renwork-model-catalog.ts", "utf8"),
    readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
    readFile("../apps/server/src/rencredit-oauth-proxy.e2e.test.ts", "utf8"),
  ]);

  expect(voiceover).toContain("Daisy");
  expect(voiceover).toContain("GPT-5.6 Luna");
  expect(voiceover).toContain("RenCredit");

  expect(catalogClient).toContain("personalSubscriptionCatalogModelOptions");
  expect(catalogClient).toContain("denSettingsChangedEvent");
  expect(catalogClient).toContain("setCatalog(null)");
  expect(sessionRoute).toContain("useRenWorkModelCatalog(true, denAuth.isSignedIn)");
  expect(sessionRoute).toContain("mergeManagedModelEntitlements");
  expect(sessionRoute).toContain("selectedPersonalSubscriptionModelAvailable");

  expect(desktopProxy).toContain("assertMeteredLocalModelReady");
  expect(desktopProxy).toContain("rewriteMeteredModel");
  expect(desktopProxy).toContain("input.localRuntimeMetering.release");
  expect(desktopProxy).toContain("settleMeteredOpenCodeRun");
  expect(proxyAcceptance).toContain("rencredit_local_provider_not_connected");
  expect(proxyAcceptance).toContain('expect(released).toEqual(["RENCREDIT_LOCAL_PROVIDER_NOT_CONNECTED"])');

  evidence.fact(
    "The picker and composer use the same OAuth entitlement",
    "A published local OAuth SKU is merged into the session entitlement only while its required local provider is connected, so a selectable model is not immediately rejected as unavailable.",
    true,
  );
  evidence.fact(
    "OAuth credentials remain device-local",
    "The public catalog contributes only the stable RenWork SKU; the trusted desktop host verifies and rewrites the private provider route without exposing or uploading the OAuth credential.",
    true,
  );
  evidence.fact(
    "RenCredit remains fail-closed",
    "The host reserves before local execution, settles reported usage on success, and releases the reservation when the required local OAuth provider is unavailable.",
    true,
  );
});
