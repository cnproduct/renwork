import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { RENWORK_MODEL_CATALOG } from "../../packages/types/src/den/inference";
import {
  listModelCatalog,
  RENWORK_MANAGED_PROVIDER_ID,
  resolveModelAlias,
} from "../../ee/apps/inference/src/model-catalog";
import {
  createOpenRouterProviderAdapter,
  createRenWorkProviderGateway,
} from "../../ee/apps/inference/src/provider-gateway";

test("RenWork owns the managed model catalog and provider routing boundary", async ({ evidence }) => {
  const catalog = listModelCatalog();
  expect(RENWORK_MANAGED_PROVIDER_ID).toBe("renwork");
  expect(catalog.length).toBeGreaterThan(0);
  expect(Object.values(RENWORK_MODEL_CATALOG).every((model) => model.displayName.startsWith("RenWork:"))).toBe(true);
  expect(resolveModelAlias(`renwork/${catalog[0]?.alias}`)?.alias).toBe(catalog[0]?.alias);
  expect(resolveModelAlias(`openwork/${catalog[0]?.alias}`)?.alias).toBe(catalog[0]?.alias);
  expect(catalog.some((model) => model.alias.startsWith("openwork/"))).toBe(false);

  const gateway = createRenWorkProviderGateway([
    createOpenRouterProviderAdapter({
      baseUrl: "https://provider.example/v1",
      async resolveCredential() {
        return { encrypted_api_key: "server-only-secret" };
      },
    }),
  ]);
  const routed = await gateway.route({
    organizationId: "org_test",
    providerId: catalog[0]?.gatewayProviderId ?? "",
    upstreamPath: "/chat/completions",
  });
  expect(routed.ok).toBe(true);
  if (!routed.ok) throw new Error("Expected the gateway to resolve a provider route");
  expect(routed.route.upstreamUrl.toString()).toBe("https://provider.example/v1/chat/completions");

  evidence.fact(
    "RenWork model catalog and provider gateway are established",
    "The public catalog is RenWork-branded, the RenWork provider prefix resolves, the legacy prefix remains a non-advertised compatibility alias, and routing is delegated through a registered server-side provider adapter.",
    true,
  );
});
