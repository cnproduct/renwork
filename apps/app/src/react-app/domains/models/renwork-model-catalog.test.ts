declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toEqual: (expected: unknown) => void;
};

import type { RenWorkPublicModelCatalog } from "@openwork/rencredit-metering";

import { personalSubscriptionCatalogModelOptions } from "./renwork-model-catalog";

const catalog: RenWorkPublicModelCatalog = {
  version: "v29-test",
  currency: "REN_CREDIT",
  models: [{
    sku: "renwork-standard",
    providerID: "renwork",
    modelID: "renwork-standard",
    displayName: "DeepSeek V4 Flash",
    description: "Cloud model",
    tier: "standard",
    autoEligible: true,
    contextWindow: null,
    tags: ["cloud"],
    displayMultiplierBps: 1_300,
    effectiveDisplayMultiplierBps: 1_300,
    promotionLabel: null,
    promotionEndsAt: null,
    billingMode: "token_metered",
    executionLocation: "cloud",
  }, {
    sku: "renwork-openai-gpt-5-6-luna",
    providerID: "renwork",
    modelID: "renwork-openai-gpt-5-6-luna",
    displayName: "GPT-5.6 Luna",
    description: "Personal OpenAI OAuth",
    tier: "standard",
    autoEligible: false,
    contextWindow: null,
    tags: ["openai", "oauth", "personal-device"],
    displayMultiplierBps: 10_000,
    effectiveDisplayMultiplierBps: 10_000,
    promotionLabel: null,
    promotionEndsAt: null,
    billingMode: "token_metered",
    executionLocation: "local",
  }, {
    sku: "renwork-google-gemini-pro",
    providerID: "renwork",
    modelID: "renwork-google-gemini-pro",
    displayName: "Gemini Pro",
    description: "Personal Google OAuth",
    tier: "professional",
    autoEligible: false,
    contextWindow: null,
    tags: ["google", "oauth", "personal-device"],
    displayMultiplierBps: 10_000,
    effectiveDisplayMultiplierBps: 10_000,
    promotionLabel: null,
    promotionEndsAt: null,
    billingMode: "token_metered",
    executionLocation: "local",
  }],
};

describe("personal subscription catalog model options", () => {
  test("only exposes local OAuth SKUs whose provider is connected on this device", () => {
    expect(personalSubscriptionCatalogModelOptions(catalog, ["openai"]).map((option) => option.modelID)).toEqual([
      "renwork-openai-gpt-5-6-luna",
    ]);
    expect(personalSubscriptionCatalogModelOptions(catalog, ["google"]).map((option) => option.modelID)).toEqual([
      "renwork-google-gemini-pro",
    ]);
    expect(personalSubscriptionCatalogModelOptions(catalog, []).map((option) => option.modelID)).toEqual([]);
  });
});
