import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertCustomProviderManagementAllowed,
  sweepLegacyCustomProvidersForMeteredDistribution,
} from "./custom-providers.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("metered custom provider policy", () => {
  test("rejects local provider management in metered distributions", () => {
    expect(() => assertCustomProviderManagementAllowed({ meteredRuntimeRequired: true })).toThrow(
      "Provider credentials are managed by the RenWork platform administrator",
    );
    expect(() => assertCustomProviderManagementAllowed({ meteredRuntimeRequired: false })).not.toThrow();
  });

  test("removes legacy inline provider credentials without changing unrelated settings", () => {
    const directory = mkdtempSync(join(tmpdir(), "renwork-v31-custom-provider-"));
    temporaryDirectories.push(directory);
    const filePath = join(directory, "opencode.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        theme: "system",
        provider: {
          legacy: {
            options: { baseURL: "https://provider.invalid/v1", apiKey: "must-be-removed" },
          },
        },
      }),
    );

    expect(sweepLegacyCustomProvidersForMeteredDistribution({ meteredRuntimeRequired: true }, filePath)).toBe(true);
    expect(JSON.parse(readFileSync(filePath, "utf8"))).toEqual({ theme: "system" });
  });
});
