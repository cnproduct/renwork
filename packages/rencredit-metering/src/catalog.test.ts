import { describe, expect, test } from "bun:test";

import { modelAllowedForPlan, normalizeAdminModelCatalog, requireSuperAdmin, toPublicModelCatalog, toPublicModelCatalogForPlan, validateAdminModelCatalog } from "./catalog.js";
import { createDefaultRenWorkModelCatalog, mergeMissingDefaultCatalogEntries } from "./default-catalog.js";
import { createTestCatalog } from "./test-fixtures.js";

describe("RenWork model catalog", () => {
  test("filters the member catalog by organization plan without exposing private routes", () => {
    const catalog = createTestCatalog();
    catalog.models[0]!.allowedPlanIds = ["individual"];
    catalog.models.push({
      ...catalog.models[0]!,
      sku: "enterprise-only",
      displayName: "Enterprise Only",
      allowedPlanIds: ["enterprise"],
      routes: catalog.models[0]!.routes.map((route) => ({ ...route, id: `${route.id}-enterprise` })),
    });

    expect(modelAllowedForPlan(catalog.models[0]!, "team")).toBe(true);
    expect(modelAllowedForPlan(catalog.models.at(-1)!, "team")).toBe(false);
    const publicCatalog = toPublicModelCatalogForPlan(catalog, "team");
    expect(publicCatalog.models.map((model) => model.sku)).not.toContain("enterprise-only");
    expect(JSON.stringify(publicCatalog)).not.toMatch(/providers|credentialRef|upstreamModelId|baseUrl/);
  });

  test("publishes stable model SKUs without exposing routes or provider secrets", () => {
    const catalog = createTestCatalog();
    const publicCatalog = toPublicModelCatalog(catalog, new Date("2026-08-28T12:00:00.000Z"));

    expect(publicCatalog.models).toHaveLength(1);
    expect(publicCatalog.models[0]).toEqual({
      sku: "renwork-standard",
      providerID: "renwork",
      modelID: "renwork-standard",
      displayName: "RenWork 标准",
      description: "适合日常任务",
      tier: "standard",
      autoEligible: true,
      contextWindow: 128_000,
      tags: ["快速"],
      displayMultiplierBps: 10_000,
      effectiveDisplayMultiplierBps: 5_000,
      promotionLabel: "限时 5 折",
      promotionEndsAt: "2026-09-01T00:00:00.000Z",
      billingMode: "token_metered",
      executionLocation: "cloud",
    });
    expect(JSON.stringify(publicCatalog)).not.toContain("openrouter");
    expect(JSON.stringify(publicCatalog)).not.toContain("credentialRef");
  });

  test("rejects published models without a working route", () => {
    const catalog = createTestCatalog();
    catalog.models[0]!.routes = [];
    expect(() => validateAdminModelCatalog(catalog)).toThrow("requires an enabled route");
  });

  test("only the super administrator can access provider configuration", () => {
    expect(() => requireSuperAdmin("member")).toThrow("super_admin");
    expect(() => requireSuperAdmin("tenant_admin")).toThrow("super_admin");
    expect(() => requireSuperAdmin("super_admin")).not.toThrow();
  });

  test("ships cloud and approved-device RenWork product SKUs without exposing credentials", () => {
    const catalog = createDefaultRenWorkModelCatalog(new Date("2026-08-28T12:00:00.000Z"));
    const publicCatalog = toPublicModelCatalog(catalog);
    expect(publicCatalog.models.map((model) => model.sku)).toEqual([
      "renwork-auto",
      "renwork-standard",
      "renwork-openai-gpt-5-6-luna",
      "renwork-professional",
      "renwork-codex",
      "renwork-openai-gpt-5-5",
      "renwork-openai-gpt-5-6",
      "renwork-openai-gpt-5-6-terra",
      "renwork-openai-gpt-5-3-codex-spark",
      "renwork-ultimate",
      "renwork-openai-gpt-5-6-sol",
    ]);
    expect(catalog.providers[0]?.credentialRef).toBe("env://OPENROUTER_API_KEY");
    expect(catalog.providers[1]).toMatchObject({
      protocol: "codex_cli",
      authMode: "device_oauth",
      credentialRef: null,
      executionScope: "personal_device",
      sharingScope: "user_private",
    });
    expect(catalog.providers[2]).toMatchObject({
      id: "openai",
      protocol: "opencode",
      authMode: "device_oauth",
      credentialRef: null,
      executionScope: "personal_device",
      sharingScope: "user_private",
    });
    expect(catalog.models.find((model) => model.sku === "renwork-openai-gpt-5-6")?.routes[0]).toMatchObject({
      providerId: "openai",
      upstreamModelId: "gpt-5.6",
      source: "local",
    });
    expect(JSON.stringify(publicCatalog)).not.toContain("OPENROUTER_API_KEY");
  });

  test("migrates missing OAuth defaults without overwriting administrator catalog choices", () => {
    const defaults = createDefaultRenWorkModelCatalog(new Date("2026-09-01T12:00:00.000Z"));
    const persisted = createDefaultRenWorkModelCatalog(new Date("2026-08-28T12:00:00.000Z"));
    persisted.version = "production-admin-catalog";
    persisted.providers = persisted.providers.filter((provider) => provider.id !== "openai");
    persisted.models = persisted.models.filter((model) => !model.sku.startsWith("renwork-openai-"));
    persisted.models[0] = { ...persisted.models[0]!, displayName: "管理员自定义 Auto", priceMultiplierBps: 12_345 };
    persisted.models.push({
      ...persisted.models[0]!,
      sku: "admin-custom-model",
      displayName: "管理员自定义模型",
      routes: persisted.models[0]!.routes.map((route) => ({ ...route, id: "route-admin-custom" })),
    });

    const migrated = mergeMissingDefaultCatalogEntries(persisted, defaults);
    expect(migrated.changed).toBe(true);
    expect(migrated.catalog.models.find((model) => model.sku === "renwork-auto")).toMatchObject({
      displayName: "管理员自定义 Auto",
      priceMultiplierBps: 12_345,
    });
    expect(migrated.catalog.models.some((model) => model.sku === "admin-custom-model")).toBe(true);
    expect(migrated.catalog.models.some((model) => model.sku === "renwork-openai-gpt-5-6")).toBe(true);
    expect(migrated.catalog.providers.some((provider) => provider.id === "openai")).toBe(true);
    expect(() => validateAdminModelCatalog(migrated.catalog)).not.toThrow();
  });

  test("rejects raw provider credentials in administrator catalog payloads", () => {
    const catalog = createTestCatalog();
    catalog.providers[0]!.credentialRef = "sk-raw-key-must-never-be-stored-here";
    expect(() => validateAdminModelCatalog(catalog)).toThrow("secret:// or env://");
  });

  test("projects the active route billing policy without exposing its source", () => {
    const catalog = createTestCatalog();
    catalog.billingPolicy.official = "free";
    const publicCatalog = toPublicModelCatalog(catalog, new Date("2026-08-28T12:00:00.000Z"));
    expect(publicCatalog.models[0]?.billingMode).toBe("free");
    expect(JSON.stringify(publicCatalog)).not.toContain('"source"');
  });

  test("accepts only user-private device-vault OAuth without cloud credentials", () => {
    const catalog = createTestCatalog();
    catalog.providers[1] = {
      ...catalog.providers[1]!,
      displayName: "OpenAI Personal OAuth",
      authMode: "device_oauth",
      credentialStore: "device_vault",
      executionScope: "personal_device",
      sharingScope: "user_private",
      deviceOAuthPolicy: { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 },
    };
    expect(() => validateAdminModelCatalog(catalog)).not.toThrow();
    catalog.providers[1]!.credentialRef = "env://OPENAI_OAUTH_TOKEN";
    expect(() => validateAdminModelCatalog(catalog)).toThrow("cannot contain a server credential");
  });

  test("normalizes persisted providers from the pre-V9 catalog", () => {
    const legacy = createTestCatalog() as unknown as ReturnType<typeof createTestCatalog>;
    const provider = legacy.providers[0]! as unknown as Record<string, unknown>;
    delete provider.authMode;
    delete provider.credentialStore;
    delete provider.executionScope;
    delete provider.sharingScope;
    delete provider.deviceOAuthPolicy;
    const normalized = normalizeAdminModelCatalog(legacy);
    expect(normalized.providers[0]).toMatchObject({
      authMode: "service_secret",
      credentialStore: "server_secret",
      executionScope: "cloud_gateway",
      sharingScope: "organization",
      deviceOAuthPolicy: null,
    });
    expect(() => validateAdminModelCatalog(legacy)).not.toThrow();
  });
});
