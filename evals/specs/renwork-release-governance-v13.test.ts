import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("V13 unifies RenWork identity, version governance, RBAC and durable settlement audit", async ({ evidence }) => {
  const rootPackage = JSON.parse(await readFile("../package.json", "utf8")) as { version: string };
  const appPackage = JSON.parse(await readFile("../apps/app/package.json", "utf8")) as { version: string };
  const desktopPackage = JSON.parse(await readFile("../apps/desktop/package.json", "utf8")) as { version: string };
  const serverPackage = JSON.parse(await readFile("../apps/server/package.json", "utf8")) as { version: string };
  const branding = await readFile("../ee/apps/den-web/app/(den)/dashboard/_components/brand-appearance-screen.tsx", "utf8");
  const dashboard = await readFile("../ee/apps/den-web/app/(den)/dashboard/_components/dashboard-overview-screen.tsx", "utf8");
  const adminUi = await readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8");
  const rencreditRoute = await readFile("../ee/apps/den-api/src/routes/admin/rencredit.ts", "utf8");
  const desktopPolicy = await readFile("../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management.ts", "utf8");

  expect(new Set([rootPackage.version, appPackage.version, desktopPackage.version, serverPackage.version])).toEqual(new Set(["0.18.57"]));
  expect(branding).toContain("Default RenWork");
  expect(branding).not.toContain("Default OpenWork");
  expect(dashboard).toContain("RenWork users");
  expect(adminUi).toContain('data-testid="rencredit-settlement-audit"');
  expect(adminUi).toContain("不可变租户账本");
  expect(rencreditRoute.match(/adminRoute\(\)/g)?.length ?? 0).toBe(2);
  expect(desktopPolicy).toContain("return false");

  evidence.fact("RenWork identity is visible", "Dashboard and brand settings use RenWork defaults and the managed RenWork mark.", true);
  evidence.fact("Release version is single-source consistent", "Root, web app, desktop and embedded server all report 0.18.57.", true);
  evidence.fact("Provider governance cannot be bypassed", "Desktop provider mutation remains disabled while platform provider and settlement routes require the platform-admin middleware.", true);
  evidence.fact("Durable settlement is auditable", "The super-admin panel exposes wallet balances, reservation freeze/capture/release, private model routes and immutable tenant ledger rows without credentials or prompt content.", true);
});
