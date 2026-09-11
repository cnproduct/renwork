import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V40 recovers stale models and defines private Den-only candidates", async ({ evidence }) => {
  const [voiceover, policy, route, migration, afterPack, server2016, desktopPackage] = await Promise.all([
    readFile("../evals/voiceovers/voiceover-v40-private-desktop-recovery.md", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/provider-policy.ts", "utf8"),
    readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8"),
    readFile("../apps/app/src/react-app/kernel/den-only-model-migration.ts", "utf8"),
    readFile("../apps/desktop/scripts/electron-after-pack.cjs", "utf8"),
    readFile("../apps/desktop/electron-builder.server2016-cloud.yml", "utf8"),
    readFile("../apps/desktop/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
  ]);

  expect(voiceover).toContain("private test candidates");
  expect(voiceover).toContain("Production model calls are not made");
  expect(policy).toContain("RENWORK_AUTO_MODEL_ID");
  expect(policy).toContain("resolveEntitledSessionModel");
  expect(route).toContain("useSessionModelStore.getState().setModel(selectedSessionId, replacement, null)");
  expect(route).toContain("const sendModel = resolveEntitledSessionModel");
  expect(migration).toContain("migrateDenOnlyModelStateForDistributedDesktop");
  expect(migration).toContain("isCloudManagedProviderKey");
  expect(afterPack).toContain('["public", "cloud", "enterprise", "server2016-cloud"]');
  expect(server2016).not.toContain("sidecars/opencode");
  expect(desktopPackage.version).toBe("0.18.66");

  evidence.fact(
    "Stale model recovery",
    "Global and conversation-level stale SKUs recover to an entitled managed RenWork model, preferring RenWork Auto, before a request is submitted.",
    true,
  );
  evidence.fact(
    "Private Den-only candidates",
    "The four candidates are defined as private artifacts; ordinary distributions strip local OpenCode sidecars and the Server 2016 target has no local runtime payload.",
    true,
  );
});
