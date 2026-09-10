declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
};

import type { DesktopAppRestrictionChecker } from "@/app/cloud/desktop-app-restrictions";
import {
  resolveEntitledOrgDefaultModel,
  resolveEntitledSessionModel,
} from "./provider-policy";

const managedModelsPolicy: DesktopAppRestrictionChecker = (input) =>
  input.restriction === "allowZenModel";

const options = [
  { providerID: "openai", modelID: "gpt-5.5" },
  { providerID: "opencode", modelID: "big-pickle" },
  { providerID: "lpr_acme", modelID: "gpt-5.4" },
  { providerID: "lpr_acme", modelID: "gpt-5.5" },
];

const optionsWithAuto = [
  ...options,
  { providerID: "lpr_renwork", modelID: "renwork-code-kimi-k3" },
  { providerID: "lpr_renwork", modelID: "renwork-auto" },
];

describe("resolveEntitledOrgDefaultModel", () => {
  test("selects the first entitled organization model when the current default is blocked", () => {
    expect(resolveEntitledOrgDefaultModel(options, {
      currentDefault: { providerID: "opencode", modelID: "big-pickle" },
      restrictToCloud: true,
      checkRestriction: managedModelsPolicy,
    })).toEqual({ providerID: "lpr_acme", modelID: "gpt-5.4" });
  });

  test("keeps an existing entitled organization default", () => {
    expect(resolveEntitledOrgDefaultModel(options, {
      currentDefault: { providerID: "lpr_acme", modelID: "gpt-5.5" },
      restrictToCloud: true,
      checkRestriction: managedModelsPolicy,
    })).toBe(null);
  });

  test("returns null when no organization model is entitled", () => {
    expect(resolveEntitledOrgDefaultModel([
      { providerID: "openai", modelID: "gpt-5.5" },
    ], {
      currentDefault: null,
      restrictToCloud: true,
      checkRestriction: managedModelsPolicy,
    })).toBe(null);
  });

  test("prefers RenWork Auto when recovering a deleted default SKU", () => {
    expect(resolveEntitledOrgDefaultModel(optionsWithAuto, {
      currentDefault: { providerID: "openai", modelID: "gpt-5.5" },
      restrictToCloud: true,
      checkRestriction: managedModelsPolicy,
    })).toEqual({ providerID: "lpr_renwork", modelID: "renwork-auto" });
  });
});

describe("resolveEntitledSessionModel", () => {
  test("replaces a stale conversation override with the entitled global default", () => {
    expect(resolveEntitledSessionModel(optionsWithAuto, {
      requested: { providerID: "openai", modelID: "gpt-5.6-luna" },
      currentDefault: { providerID: "lpr_renwork", modelID: "renwork-code-kimi-k3" },
    })).toEqual({ providerID: "lpr_renwork", modelID: "renwork-code-kimi-k3" });
  });

  test("falls back to RenWork Auto when both remembered models are stale", () => {
    expect(resolveEntitledSessionModel(optionsWithAuto, {
      requested: { providerID: "openai", modelID: "gpt-5.6-luna" },
      currentDefault: { providerID: "opencode", modelID: "big-pickle" },
    })).toEqual({ providerID: "lpr_renwork", modelID: "renwork-auto" });
  });
});
