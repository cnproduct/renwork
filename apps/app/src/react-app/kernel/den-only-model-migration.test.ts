declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => { toBe: (expected: unknown) => void; toEqual: (expected: unknown) => void };

import { migrateDenOnlyModelState } from "./den-only-model-migration";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
}

describe("Den-only model migration", () => {
  test("removes local/BYOK choices while preserving managed RenWork session models", () => {
    const storage = new MemoryStorage();
    storage.setItem("openwork.defaultModel", "openai:gpt-5.6-luna");
    storage.setItem("openwork.preferences", JSON.stringify({
      defaultModel: { providerID: "opencode", modelID: "big-pickle" },
      modelVariant: "high",
      analyticsEnabled: true,
    }));
    storage.setItem("openwork.sessionModels.v1", JSON.stringify({
      stale: { model: { providerID: "openai", modelID: "gpt-5.6-luna" }, variant: null },
      valid: { model: { providerID: "lpr_renwork", modelID: "renwork-code-kimi-k3" }, variant: null },
    }));
    storage.setItem("openwork.sessionModels.workspace-1", JSON.stringify({ stale: "openai:gpt-5.6-luna" }));

    expect(migrateDenOnlyModelState(storage)).toBe(true);
    expect(storage.getItem("openwork.defaultModel")).toBe("renwork/renwork-auto");
    expect(JSON.parse(storage.getItem("openwork.preferences") ?? "{}")).toEqual({
      defaultModel: { providerID: "renwork", modelID: "renwork-auto" },
      modelVariant: null,
      analyticsEnabled: true,
    });
    expect(JSON.parse(storage.getItem("openwork.sessionModels.v1") ?? "{}")).toEqual({
      valid: { model: { providerID: "lpr_renwork", modelID: "renwork-code-kimi-k3" }, variant: null },
    });
    expect(storage.getItem("openwork.sessionModels.workspace-1")).toBe(null);
    expect(migrateDenOnlyModelState(storage)).toBe(false);
  });
});
