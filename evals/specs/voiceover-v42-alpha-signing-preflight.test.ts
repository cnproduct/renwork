import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V42 rejects an unconfigured macOS Alpha before packaging", async ({ evidence }) => {
  const [voiceover, workflow] = await Promise.all([
    readFile("../evals/voiceovers/voiceover-v42-four-machine-release-gates.md", "utf8"),
    readFile("../.github/workflows/alpha-macos-aarch64.yml", "utf8"),
  ]);

  expect(voiceover).toContain("four-machine release gates");
  expect(voiceover).toContain("Windows Server 2016 must remain cloud-only");
  expect(workflow).toContain("ALPHA_RELEASE_NAME: RenWork Alpha (macOS arm64)");
  expect(workflow).not.toContain("OpenWork Alpha (macOS arm64)");
  expect(workflow).toContain("APPLE_NOTARY_API_KEY_P8_BASE64");
  expect(workflow).toContain("APPLE_NOTARY_API_KEY_ID");
  expect(workflow).toContain("APPLE_NOTARY_API_ISSUER_ID");
  expect(workflow).toContain("APPLE_CODESIGN_CERT_P12_BASE64");
  expect(workflow).toContain("APPLE_CODESIGN_CERT_PASSWORD");
  expect(workflow).toContain("missing=()");
  expect(workflow).toContain("Missing RenWork macOS notarization/signing secrets");
  expect(workflow).toContain("Rolling alpha channel for RenWork macOS arm64 builds");

  evidence.fact(
    "Alpha signing fails before packaging when credentials are missing",
    "The workflow validates all five required Apple signing and notarization inputs before writing the notary key or invoking electron-builder.",
    true,
  );
  evidence.fact(
    "Alpha publication uses RenWork branding",
    "The rolling release name and notes no longer identify the artifact as OpenWork.",
    true,
  );
});
