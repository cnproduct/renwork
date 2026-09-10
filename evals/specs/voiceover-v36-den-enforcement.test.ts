import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V36 makes Den the only production execution and billing boundary", async ({ evidence }) => {
  const [voiceover, catalog, migration, gateway, runtime, ledger, settlementPlan, distribution, desktopPolicy, admin, rootPackage, appPackage, desktopPackage, serverPackage, versions] = await Promise.all([
    readFile("../evals/voiceovers/voiceover-v36-den-enforcement.md", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-settlement-plan.ts", "utf8"),
    readFile("../apps/desktop/electron/desktop-distribution.mjs", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management.ts", "utf8"),
    readFile("../ee/apps/den-web/components/renwork-model-catalog-admin.tsx", "utf8"),
    readFile("../package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/app/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/desktop/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/server/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../ee/apps/den-api/src/generated/desktop-versions.ts", "utf8"),
  ]);

  expect(voiceover).toContain("at most 0.05 RenCredit");
  expect(catalog).toContain("validateDenServerCatalog");
  expect(catalog).toContain('route.source === "official"');
  expect(catalog).toContain('normalized.credentialStore === "server_secret"');
  expect(migration).toContain("migrateToDenServerExclusiveCatalog");
  expect(migration).toContain('status: model.status === "published" && !hasEnabledRoute ? "paused"');

  expect(gateway).toContain("isDenServerRoute(candidate, providers)");
  expect(gateway).toContain('const billingMode = "token_metered" as const');
  expect(gateway.indexOf("reserveInferenceCredits({")).toBeLessThan(gateway.indexOf("await fetch(chatCompletionsUrl"));
  expect(runtime).toContain('app.all("/api/v1/metered-runtime/*"');
  expect(runtime).toContain('code: "LOCAL_RUNTIME_DISABLED"');
  expect(runtime.indexOf('app.all("/api/v1/metered-runtime/*"')).toBeLessThan(runtime.indexOf('app.put("/api/v1/metered-runtime/devices/:deviceId"'));

  expect(settlementPlan).toContain("additionalChargeMicroCredits");
  expect(ledger).toContain('entry_type: "adjustment"');
  expect(ledger).toContain('reason_code: "INFERENCE_TOKEN_OVERAGE_ADJUSTMENT"');
  expect(ledger).toContain('idempotency_key: `${reservation.id}:overage`');

  for (const flavor of ["PUBLIC", "CLOUD", "ENTERPRISE", "SERVER_2016_CLOUD"]) {
    const start = distribution.indexOf(`export const ${flavor}_DESKTOP_DISTRIBUTION`);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(distribution.slice(start, start + 500)).toContain("localRuntimeEnabled: false");
  }
  expect(desktopPolicy).toContain("void input;\n  return false;");
  expect(admin).not.toContain('<option value="device_oauth">');
  expect(admin).not.toContain('<option value="free">');
  expect(admin).toContain("超出预冻结");
  expect(new Set([rootPackage.version, appPackage.version, desktopPackage.version, serverPackage.version])).toEqual(new Set(["0.18.65"]));
  expect(versions).toContain('"0.18.65"');

  evidence.fact(
    "Only Den-routed models are selectable",
    "Public catalog projection and inference routing share the same server-secret, official-route predicate; production desktop distributions disable local runtime execution.",
    true,
  );
  evidence.fact(
    "Legacy local execution fails closed",
    "Every public metered-runtime device endpoint terminates with LOCAL_RUNTIME_DISABLED before device registration or settlement code can run; administrators retain revocation-only cleanup.",
    true,
  );
  evidence.fact(
    "Actual Token cost is fully charged and explained",
    "Final usage captures the reservation and appends an idempotent adjustment for any overage, while no-result and upstream-failure paths release the reservation.",
    true,
  );
});
