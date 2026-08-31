import { describe, expect, test } from "bun:test";

import { createRenWorkModelCatalogService } from "./admin-catalog-service.js";
import { createTestCatalog } from "./test-fixtures.js";

describe("RenWork super-admin model catalog", () => {
  test("keeps relay, runtime and custom routes private while publishing one stable SKU", () => {
    const initial = createTestCatalog();
    initial.providers.push({
      id: "custom-compatible",
      displayName: "Custom Compatible Gateway",
      kind: "custom",
      protocol: "openai_compatible",
      baseUrl: "https://custom.example/v1",
      credentialRef: "secret://renwork/custom-compatible",
      authMode: "service_secret",
      credentialStore: "server_secret",
      executionScope: "cloud_gateway",
      sharingScope: "organization",
      deviceOAuthPolicy: null,
      enabled: true,
      health: "healthy",
    });
    initial.models[0]!.routes.push({
      id: "route-custom-standard",
      providerId: "custom-compatible",
      upstreamModelId: "standard-model",
      priority: 30,
      enabled: true,
      source: "official",
    });
    const service = createRenWorkModelCatalogService(initial);

    expect(service.getAdminCatalog("super_admin").providers.map((provider) => provider.kind)).toEqual([
      "relay",
      "runtime",
      "custom",
    ]);
    expect(() => service.getAdminCatalog("member")).toThrow("super_admin");
    expect(service.getPublicCatalog(new Date("2026-08-28T12:00:00.000Z")).models[0]?.modelID).toBe("renwork-standard");
    expect(JSON.stringify(service.getPublicCatalog())).not.toContain("custom.example");
    expect(service.resolveRoute("renwork-standard").providerId).toBe("openrouter-primary");
  });

  test("uses optimistic version checks for administrator updates", () => {
    const initial = createTestCatalog();
    const service = createRenWorkModelCatalogService(initial);
    const next = createTestCatalog();
    next.version = "test-2026-08-v2";
    expect(service.replaceAdminCatalog({
      role: "super_admin",
      expectedVersion: initial.version,
      catalog: next,
    }).version).toBe("test-2026-08-v2");
    expect(() => service.replaceAdminCatalog({
      role: "super_admin",
      expectedVersion: initial.version,
      catalog: initial,
    })).toThrow("VERSION_CONFLICT");
  });
});
