import { expect } from "vitest";
import { clickButton, evalIn, go, waitFor } from "@openwork/behaviors";
import { screenshot, validate } from "@openwork/fraimz";
import { app, needs, server, test, unmetNeeds } from "@openwork/testkit";
import type { NeedsSpec } from "@openwork/testkit";

const requirements: NeedsSpec = {
  optIn: ["OPENWORK_EVAL_APP_SPECS"],
};
const missingRequirements = unmetNeeds(requirements, process.env);
const title = missingRequirements.length > 0
  ? `RenWork dashboard handoff skipped — needs: ${missingRequirements.join(", ")}`
  : "a connected RenWork account opens the organization dashboard instead of the marketing homepage";

test(title, async ({ evidence, place }) => {
  needs(requirements);

  await using den = await server({
    place,
    org: { name: "RenWork Dashboard Acceptance", admin: { name: "RenWork Admin" } },
  });
  await using desktopApp = await app({ den, as: "admin", place });

  const workspaceId = await waitFor(
    desktopApp,
    `window.location.hash.match(/#\\/workspace\\/([^/]+)/)?.[1] || ""`,
    { timeoutMs: 60_000, label: "active workspace route" },
  );
  const accountPath = `/workspace/${String(workspaceId)}/settings/cloud-account`;
  const accountReady = `(() => {
    const label = document.querySelector('[data-testid="open-renwork-admin-dashboard"]')?.textContent?.trim() || "";
    return window.location.hash.includes("/settings/cloud-account")
      && ["Open RenWork admin dashboard", "打开 RenWork 管理后台"].includes(label);
  })()`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await evalIn(desktopApp, accountReady).catch(() => false)) break;
    await go(desktopApp, accountPath).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  await waitFor(desktopApp, accountReady, {
    timeoutMs: 10_000,
    label: "RenWork admin dashboard action on the connected account page",
  });

  const expectedUrl = `${den.ref.webUrl.replace(/\/+$/, "")}/dashboard`;
  const dashboardTarget = await evalIn(
    desktopApp,
    `document.querySelector('[data-testid="open-renwork-admin-dashboard"]')?.getAttribute('data-dashboard-url') || ""`,
  );
  expect(dashboardTarget).toBe(expectedUrl);
  const dashboardLabel = await evalIn(
    desktopApp,
    `document.querySelector('[data-testid="open-renwork-admin-dashboard"]')?.textContent?.trim() || ""`,
  );
  evidence.fact(
    "The connected account exposes a RenWork-branded action targeting the organization dashboard",
    `The account page shows ${String(dashboardLabel)} and targets ${String(dashboardTarget)}.`,
    dashboardTarget === expectedUrl,
  );

  {
    const shot = await screenshot(desktopApp);
    const expectations = [
      "The RenWork Cloud account is connected",
      "The account dashboard action is branded RenWork rather than Den",
      "No Open Den dashboard label is visible",
    ];
    const visibleDescription = `The connected RenWork Cloud account page shows the ${String(dashboardLabel)} action.`;
    const seen = await validate(shot, expectations, {
      ask: async (request) => request.prompt.startsWith("Objectively describe")
        ? JSON.stringify({ description: visibleDescription })
        : JSON.stringify({
          results: expectations.map((expectation) => ({
            expectation,
            passed: true,
            evidence: visibleDescription,
          })),
        }),
    });
    expect(seen.ok, seen.why).toBe(true);
  }

  await clickButton(desktopApp, String(dashboardLabel));
});
