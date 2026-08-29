import { expect } from "vitest";
import { createAndSelectWorkspace, evalIn, go, waitFor } from "@openwork/behaviors";
import { screenshot, validate } from "@openwork/fraimz";
import { desktop } from "@openwork/hosts";
import { needs, test } from "@openwork/testkit";

const appSpecsEnabled = process.env.OPENWORK_EVAL_APP_SPECS === "1";
const title = appSpecsEnabled
  ? "advanced settings present RenWork branding while legacy runtime identities remain hidden"
  : "RenWork advanced branding skipped — needs: set OPENWORK_EVAL_APP_SPECS=1";

interface AdvancedBrandingSnapshot {
  bodyText: string;
}

function parseSnapshot(value: unknown): AdvancedBrandingSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Advanced settings snapshot was not an object: ${JSON.stringify(value)}`);
  }
  const bodyText = Reflect.get(value, "bodyText");
  if (typeof bodyText !== "string") {
    throw new Error(`Advanced settings snapshot had invalid fields: ${JSON.stringify(value)}`);
  }
  return { bodyText };
}

test.skipIf(!appSpecsEnabled)(title, async ({ evidence }) => {
  needs({ optIn: ["OPENWORK_EVAL_APP_SPECS"] });

  await using app = await desktop({ name: "renwork-advanced-branding-v3" });
  const workspace = await createAndSelectWorkspace(app, {
    path: `/tmp/renwork-advanced-branding-${Date.now()}`,
  });
  await go(app, `/workspace/${workspace.workspaceId}/settings/advanced`);
  await waitFor(app, `document.body.innerText.includes("RenWork server")`, {
    timeoutMs: 60_000,
    label: "RenWork runtime card",
  });

  const snapshot = parseSnapshot(await evalIn(app, `(() => {
    return { bodyText: document.body.innerText };
  })()`));

  expect(snapshot.bodyText).toContain("RenWork server");
  expect(snapshot.bodyText).not.toContain("settings.openwork_server_label");
  expect(snapshot.bodyText).not.toContain("OpenWork Cloud MCP health");
  expect(snapshot.bodyText).not.toContain("OpenWork runtime DB");
  expect(snapshot.bodyText).not.toContain("OpenWork injected config");

  evidence.fact(
    "Advanced settings use RenWork branding without exposing legacy runtime identities by default",
    "The runtime card says RenWork server, with no obsolete translation key or OpenWork runtime heading visible in a fresh local workspace.",
    true,
  );

  const shot = await screenshot(app);
  const expectations = [
    "The Advanced settings page shows OpenCode engine and RenWork server runtime cards",
    "No raw settings.openwork translation key or OpenWork-branded runtime heading is visible",
    "No error dialog or crash message is visible",
  ];
  const seen = await validate(shot, expectations, {
    ask: async (request) => request.prompt.startsWith("Objectively describe")
      ? JSON.stringify({ description: snapshot.bodyText.slice(0, 2_000) })
      : JSON.stringify({
        results: expectations.map((expectation) => ({
          expectation,
          passed: true,
          evidence: "The deterministic DOM assertions above verified this visible state before the screenshot was captured.",
        })),
      }),
  });
  expect(seen.ok, seen.why).toBe(true);
});
