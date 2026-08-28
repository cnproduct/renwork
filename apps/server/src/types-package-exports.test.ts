import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Production Node runtimes cannot execute TypeScript source from a workspace
 * package. Runtime-bearing exports therefore resolve to built JavaScript by
 * default, while local development keeps resolving directly from source. The
 * Docker, alpha, and test pipelines must build this package before production
 * resolution is exercised.
 */
describe("@openwork/types package exports", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dir, "../../../packages/types/package.json"), "utf8"),
  ) as { exports: Record<string, Record<string, string> | string> };

  test("built runtime subpaths resolve to JavaScript by default and source in development", () => {
    const invalid = Object.entries(manifest.exports).flatMap(([subpath, target]) => {
      const conditions = typeof target === "string" ? { default: target } : target;
      if (!("default" in conditions) || !conditions.default?.startsWith("./dist/")) return [];
      const valid = conditions.development?.startsWith("./src/");
      return valid ? [] : [subpath];
    });

    expect(invalid).toEqual([]);
  });

  test("the runtime subpaths this app imports are declared", () => {
    // Regression anchor: automations is a runtime module (zod schemas), unlike
    // the type-only subpaths that surrounded it when it was introduced.
    expect(manifest.exports["./automations"]).toMatchObject({
      types: "./src/automations.ts",
      development: "./src/automations.ts",
      default: "./dist/automations.js",
    });
  });
});
