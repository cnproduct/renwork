import { describe, expect, test } from "bun:test";
import type { RenWorkPublicModelCatalog } from "@openwork/rencredit-metering";

import { catalogModelOptions, renWorkTierLabel } from "../src/react-app/domains/models/renwork-model-catalog";

const catalog: RenWorkPublicModelCatalog = {
  version: "test-v1",
  currency: "REN_CREDIT",
  models: [{
    sku: "renwork-pro",
    providerID: "renwork",
    modelID: "renwork-pro",
    displayName: "RenWork 专业",
    description: "复杂任务",
    tier: "professional",
    autoEligible: true,
    contextWindow: 256_000,
    tags: ["推理"],
    displayMultiplierBps: 28_000,
    effectiveDisplayMultiplierBps: 14_000,
    promotionLabel: "限时 5 折",
    promotionEndsAt: "2026-09-01T00:00:00.000Z",
    billingMode: "token_metered",
  }],
};

describe("RenWork member model catalog", () => {
  test("maps published SKUs to the stable RenWork runtime provider", () => {
    expect(catalogModelOptions(catalog)).toEqual([{
      billing: catalog.models[0],
      option: {
        providerID: "renwork",
        modelID: "renwork-pro",
        title: "RenWork 专业",
        description: "复杂任务",
        behaviorTitle: "Reasoning",
        behaviorLabel: "Default",
        behaviorDescription: "",
        behaviorValue: null,
        isFree: false,
      },
    }]);
  });

  test("uses user-facing capability tiers instead of supplier groups", () => {
    expect(renWorkTierLabel("auto")).toBe("智能 Auto");
    expect(renWorkTierLabel("standard")).toBe("标准");
    expect(renWorkTierLabel("professional")).toBe("专业");
    expect(renWorkTierLabel("ultimate")).toBe("极致");
  });

  test("marks a super-admin free policy as free in the member picker", () => {
    const freeCatalog: RenWorkPublicModelCatalog = {
      ...catalog,
      models: [{ ...catalog.models[0]!, billingMode: "free" }],
    };
    expect(catalogModelOptions(freeCatalog)[0]?.option.isFree).toBe(true);
  });
});
