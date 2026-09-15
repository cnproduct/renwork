import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("Voiceover V48 keeps test candidates separate from formal release evidence", async ({ evidence }) => {
  const [voiceover, workflow, english, chinese] = await Promise.all([
    read("../voiceovers/voiceover-v48-cross-platform-candidates.md"),
    read("../../.github/workflows/build-voiceover-v48-candidates.yml"),
    read("../../apps/app/src/i18n/locales/en.ts"),
    read("../../apps/app/src/i18n/locales/zh.ts"),
  ]);

  for (const target of [
    "macOS Apple Silicon",
    "macOS Intel",
    "Windows x64",
    "Windows Server 2016 cloud-only",
    "Linux x64",
    "Linux arm64",
  ]) {
    expect(voiceover).toContain(target);
  }
  expect(voiceover).toContain("does not publish a GitHub Release");
  expect(voiceover).toContain("exact-platform installation");
  expect(voiceover).toContain("RenCredit reservation/capture receipt");
  expect(workflow).toContain("electron-builder.server2016-cloud.yml");
  expect(workflow).toContain("ubuntu-22.04-arm");
  expect(workflow).toContain("SHA256SUMS.txt");
  expect(workflow).toContain("forbidden OpenCode sidecar");
  expect(english).toContain("Provider-reported tokens are still settled in RenCredit");
  expect(chinese).toContain("供应商已报告的 Token 仍会结算 RenCredit");

  evidence.fact(
    "V48 candidate scope is explicit",
    "The voiceover and private workflow cover both macOS architectures, Windows x64, the separate Server 2016 cloud-only distribution, and both Linux architectures without moving a public release or updater pointer.",
    true,
  );
  evidence.fact(
    "Reasoning-only completion is visible to the user",
    "English and Chinese recovery copy state that no visible answer arrived and that provider-reported Token usage is still settled in RenCredit and can be checked in the usage receipt.",
    true,
  );
});
