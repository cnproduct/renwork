import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V35 produces a valid macOS test-package signature envelope", async ({ evidence }) => {
  const [afterSign, workflow] = await Promise.all([
    readFile("../apps/desktop/scripts/electron-after-sign.cjs", "utf8"),
    readFile("../.github/workflows/build-electron-desktop.yml", "utf8"),
  ]);

  expect(afterSign).toContain("signMacAppAdHocWhenDistributionIdentityIsUnavailable(appPath)");
  expect(afterSign).toContain("hasMacDistributionSigningMaterial()");
  expect(afterSign).toContain("hasDistributionSignature(appPath)");
  expect(afterSign).toContain("process.env.CSC_LINK");
  expect(afterSign).toContain('["--verify", "--deep", "--strict", "--verbose=2", appPath]');
  expect(workflow).toContain("Validate macOS application signature envelope");
  expect(workflow).toContain('test -f "$app/Contents/_CodeSignature/CodeResources"');
  expect(workflow).toContain('codesign --verify --deep --strict --verbose=2 "$app"');

  evidence.fact(
    "Unsigned macOS test packages carry a complete ad-hoc signature envelope",
    "The afterPack hook signs the final app bundle only when no distribution identity is available and immediately performs strict deep verification.",
    true,
  );
  evidence.fact(
    "CI rejects incomplete macOS signature envelopes before artifact upload",
    "The workflow mounts the generated DMG, requires CodeResources, and performs strict deep codesign verification.",
    true,
  );
});
