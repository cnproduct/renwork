import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("OpenAI subscription models require a connected desktop OAuth runtime before execution", async ({ evidence }) => {
  const [picker, session, server, serverTest] = await Promise.all([
    readFile("../apps/app/src/components/model-select.tsx", "utf8"),
    readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
    readFile("../apps/server/src/rencredit-oauth-proxy.e2e.test.ts", "utf8"),
  ]);

  expect(picker).toContain("requiredPersonalSubscriptionProvider");
  expect(picker).toContain('scope: "personal_subscription_oauth"');
  expect(session).toContain("readOpenProviderAuthEventDetail");
  expect(session).toContain('personalSubscriptionOnly: sessionProviderAuthSnapshot.providerAuthScope === "personal_subscription_oauth"');
  expect(server).toContain("assertMeteredLocalModelReady");
  expect(server).toContain("rencredit_local_provider_not_connected");
  expect(server).toContain("localRuntimeMetering.release(reservation, failureCode)");
  expect(serverTest).toContain("releases RenCredit and explains when OpenAI is not connected");

  evidence.fact(
    "Missing OAuth is intercepted before execution",
    "Choosing a local OpenAI or Google catalog SKU opens the subscription OAuth flow when the matching provider is not connected.",
    true,
  );
  evidence.fact(
    "RenCredit freezes cannot linger after readiness failure",
    "The host verifies the exact provider and model after reservation, releases the reservation on failure, and never forwards an unavailable model to OpenCode.",
    true,
  );
});
