import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
// The validator is an executable Node ESM script shared with GitHub Actions.
// @ts-expect-error -- its runtime exports are asserted by this proof.
import { REQUIRED_TARGETS, validateFleetEvidence } from "../../scripts/acceptance/validate-v49-fleet-evidence.mjs";

const commit = "a".repeat(40);

function deviceEvidence(targetId: string, index: number) {
  const target = REQUIRED_TARGETS[targetId];
  return {
    schemaVersion: 1,
    voiceover: "V49",
    sourceCommit: commit,
    observedAt: new Date().toISOString(),
    target: {
      id: targetId,
      os: target.os,
      osVersion: "acceptance-os-version",
      arch: target.arch,
      deviceId: `real-device-${index}`,
    },
    artifact: { name: `${targetId}.zip`, sha256: String(index).padStart(64, "0") },
    executionChannel: "installed-renwork-ui",
    checks: {
      installed: true,
      launchedInstalledBinary: true,
      organizationLogin: true,
      authoritativeCatalogLoaded: true,
      modelSelected: true,
      modelCallCompleted: true,
      cloudOnlyRuntime: targetId === "windows-server-2016-x64",
    },
    den: {
      origin: "https://den.test.invalid",
      organizationId: "org_test",
      memberId: "member_test",
      catalogVersion: "catalog-v49",
    },
    modelSku: "renwork-v49-acceptance",
    rencredit: {
      reservationId: `reservation-${index}`,
      receiptId: `reservation-${index}`,
      status: "captured",
      reservedMicroCredits: 100,
      capturedMicroCredits: 10,
      releasedMicroCredits: 90,
      approvedMaxMicroCredits: 100,
      walletBeforeAvailable: 2_000,
      walletAfterAvailable: 1_990,
      walletBeforeReserved: 0,
      walletAfterReserved: 0,
      usage: { inputTokens: 8, outputTokens: 2, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      ledgerEntryIds: [`reserve-ledger-${index}`, `capture-ledger-${index}`],
    },
    evidence: {
      install: `artifact://install-${index}`,
      login: `artifact://login-${index}`,
      modelCatalog: `artifact://catalog-${index}`,
      receipt: `artifact://receipt-${index}`,
    },
  };
}

test("Voiceover V49 replaces the simulated no-result test and guards release with exact-device evidence", async ({ evidence }) => {
  const [voiceover, liveSpec, liveWorkflow, fleetWorkflow, candidateWorkflow, finalizer, baseReleaseWorkflow, localHost] = await Promise.all([
    readFile(new URL("../voiceovers/voiceover-v49-real-den-fleet-acceptance.md", import.meta.url), "utf8"),
    readFile(new URL("./session-admission-no-result-recovery.e2e.test.ts", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/voiceover-v49-real-den-no-result.yml", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/voiceover-v49-real-device-fleet.yml", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/build-voiceover-v49-candidates.yml", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/acceptance/finalize-v49.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../.github/workflows/release-macos-aarch64.yml", import.meta.url), "utf8"),
    readFile(new URL("../packages/hosts/src/local.ts", import.meta.url), "utf8"),
  ]);

  expect(liveSpec).toContain("OPENWORK_EVAL_DEN_NO_RESULT_MODEL_SKU");
  expect(liveSpec).toContain("OPENWORK_EVAL_INFERENCE_KEY");
  expect(liveSpec).toContain('executionChannel: "real-den-inference-gateway"');
  expect(liveSpec).toContain('"/v1/rencredit/ledger?limit=100"');
  expect(liveSpec).toContain('receipt.status).toBe("captured")');
  expect(liveSpec).not.toContain("createServer");
  expect(liveSpec).not.toContain("admission-no-result-mock");
  expect(liveWorkflow).toContain("Fail closed when a real Den input is missing");
  expect(liveWorkflow).toContain("RENWORK_V49_INFERENCE_KEY");
  expect(liveWorkflow).toContain("push:\n    branches:");
  for (const targetId of Object.keys(REQUIRED_TARGETS)) expect(fleetWorkflow).toContain(`target: ${targetId}`);
  expect(fleetWorkflow).toContain("max-parallel: 1");
  expect(fleetWorkflow).toContain("Resolve the exact candidate build");
  expect(fleetWorkflow).toContain("caffeinate -dimsu pnpm");
  expect(fleetWorkflow).toContain("pnpm --dir evals install --frozen-lockfile --prefer-offline");
  expect(fleetWorkflow).toContain("cache-dependency-path: evals/pnpm-lock.yaml");
  expect(fleetWorkflow).toContain("push:\n    branches:");
  expect(candidateWorkflow.match(/artifact: RenWork-V49-/g)).toHaveLength(6);
  expect(finalizer).toContain("validateFleetEvidence(entries");
  expect(finalizer).toContain("No mutation occurs before this line");
  expect(finalizer).toContain('["pr", "merge", "80"');
  expect(finalizer).toContain('"-f", "prerelease=true"');
  expect(baseReleaseWorkflow).not.toContain("push:\n    tags:");
  expect(baseReleaseWorkflow).toContain("electron-builder.server2016-cloud.yml");
  expect(baseReleaseWorkflow).toContain("Expected 7 signed Windows installers");
  expect(localHost).toContain("if (!packagedBinary) await prepareSharedElectronResources");
  expect(voiceover).toContain("Hosted build VMs prove packaging only");

  const complete = Object.keys(REQUIRED_TARGETS).map((targetId, index) => deviceEvidence(targetId, index + 1));
  expect(validateFleetEvidence(complete, { commit, maxAgeHours: 24 })).toMatchObject({ ok: true, commit });
  expect(() => validateFleetEvidence(complete.slice(1), { commit, maxAgeHours: 24 })).toThrow(/exactly 6 device records/);
  const bypass = structuredClone(complete);
  bypass[0]!.rencredit.walletAfterReserved = 1;
  expect(() => validateFleetEvidence(bypass, { commit, maxAgeHours: 24 })).toThrow(/abandoned frozen balance/);

  evidence.fact(
    "The obsolete mock cannot satisfy V49",
    "The live spec requires explicit Den URLs, test-tenant credentials, organization and model SKU; it correlates reserve and capture ledger rows and contains no local HTTP provider.",
    true,
  );
  evidence.fact(
    "Six exact machines are a fail-closed release input",
    "The validator requires unique, fresh evidence for both Mac architectures, ordinary Windows, Server 2016 cloud-only, and both Linux architectures, all against one guarded commit.",
    true,
  );
});
