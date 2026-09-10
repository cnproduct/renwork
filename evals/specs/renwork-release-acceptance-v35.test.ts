import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V35 keeps v0.18.63 promotion behind cross-platform and RenCredit evidence", async ({ evidence }) => {
  const [voiceover, rootPackage, appPackage, desktopPackage, serverPackage, versions, desktopWorkflow, server2016Workflow, desktopRuntime] = await Promise.all([
    readFile("../evals/voiceovers/renwork-release-acceptance-v35.md", "utf8"),
    readFile("../package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/app/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/desktop/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../apps/server/package.json", "utf8").then((value) => JSON.parse(value) as { version: string }),
    readFile("../ee/apps/den-api/src/generated/desktop-versions.ts", "utf8"),
    readFile("../.github/workflows/build-electron-desktop.yml", "utf8"),
    readFile("../.github/workflows/build-server-2016-cloud.yml", "utf8"),
    readFile("../apps/server/src/rencredit-local-runtime.ts", "utf8"),
  ]);

  expect(new Set([rootPackage.version, appPackage.version, desktopPackage.version, serverPackage.version])).toEqual(new Set(["0.18.63"]));
  expect(versions).toContain('"0.18.63"');
  expect(desktopWorkflow).toContain("--mac dmg zip --arm64");
  expect(desktopWorkflow).toContain("--mac dmg zip --x64");
  expect(desktopWorkflow).toContain("--win nsis zip");
  expect(server2016Workflow).toContain("electron-builder.server2016-cloud.yml");
  expect(server2016Workflow).toContain("must not contain OpenCode sidecars");
  expect(desktopRuntime).toContain("X-RenWork-Client-Version");
  expect(voiceover).toContain("zero captured RenCredit");
  expect(voiceover).toContain("0.05 RenCredit");
  expect(voiceover).toContain("unsigned test packages");
  expect(voiceover).toContain("remains a prerelease");
  expect(voiceover).toContain("rrenn.com");

  evidence.fact("One source version drives every desktop package", "The root, app, desktop, embedded server and Den desktop-version catalog all publish v0.18.63.", true);
  evidence.fact("The package matrix includes legacy cloud mode", "CI builds Apple Silicon, Intel Mac and ordinary Windows packages, while the Server 2016 workflow verifies its cloud-only package contains no OpenCode sidecar.", true);
  evidence.fact("Formal promotion is evidence-gated", "Unsigned Mac artifacts remain test-only and production download pointers cannot move before exact-platform, tenant, device and RenCredit settlement evidence passes.", true);
});
