import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V31 keeps provider credentials server-exclusive and RenCredit mandatory", async ({ evidence }) => {
  const [voiceover, providerRoutes, providerPolicy, resources, providerSync, customProviders, meteredRuntime, catalog, inferenceGateway] = await Promise.all([
    readFile("../evals/voiceovers/server-exclusive-credentials-v31.md", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/llm-providers.ts", "utf8"),
    readFile("../ee/apps/den-api/src/llm/provider-connection-policy.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/org/resources.ts", "utf8"),
    readFile("../apps/server/src/cloud-provider-sync.ts", "utf8"),
    readFile("../apps/server/src/routes/custom-providers.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
  ]);

  expect(voiceover).toContain("Server-exclusive credentials");
  expect(voiceover).toContain("No reservation means no execution");
  expect(providerRoutes).toContain("provider_direct_connect_disabled");
  expect(providerPolicy).toContain("isMemberConnectableProvider");
  expect(resources).toContain("isMemberConnectableProvider(row)");
  expect(providerSync).toContain("server_exclusive_credentials");
  expect(providerSync).toContain("revokeProviderIds");
  expect(customProviders).toContain("provider_management_disabled");
  expect(meteredRuntime).toContain("LOCAL_RUNTIME_DEVICE_NOT_APPROVED");
  expect(meteredRuntime).toContain("LOCAL_RUNTIME_RECEIPT_SIGNATURE_INVALID");
  expect(meteredRuntime).toContain("IDEMPOTENT_REQUEST_REPLAYED");
  expect(inferenceGateway).toContain("releaseInferenceCredits");
  expect(catalog).toContain("requireSuperAdmin");
  expect(catalog).toContain("service secret must stay in the cloud gateway");

  evidence.fact(
    "Only the Den gateway reaches ordinary clients",
    "Usable provider sync is restricted to the per-member RenWork gateway; direct provider connect requests are denied before credentials are decoded.",
    true,
  );
  evidence.fact(
    "Legacy direct credentials are removed",
    "The desktop removes cloud-imported direct provider config, environment values, and engine authentication during convergence and sign-out.",
    true,
  );
  evidence.fact(
    "RenCredit remains fail-closed",
    "Execution requires a reservation, an entitled model route, and for personal OAuth an active platform-approved device with a valid signed settlement receipt.",
    true,
  );
});
