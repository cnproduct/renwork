import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { Hono } from "hono";

let app: Hono;
const statePath = `/private/tmp/renwork-model-catalog-test-${process.pid}.json`;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.RENWORK_SUPER_ADMIN_TOKEN = "renwork-super-admin-test-token";
  delete process.env.OPENROUTER_API_KEY;
  process.env.DATA_PATH = statePath;
  ({ app } = await import("./server.js"));
});

describe("RenWork model catalog API", () => {
  test("publishes member model choices without provider routing or secret references", async () => {
    const response = await app.request("/v1/models/catalog");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.models.length).toBeGreaterThan(0);
    expect(payload.models[0]?.providerID).toBe("renwork");
    expect(JSON.stringify(payload)).not.toContain("providers");
    expect(JSON.stringify(payload)).not.toContain("credentialRef");
    expect(JSON.stringify(payload)).not.toContain("OPENROUTER_API_KEY");
  });

  test("keeps administrator catalog details behind the dedicated super-admin token", async () => {
    const denied = await app.request("/v1/admin/models/catalog", {
      headers: { Authorization: "Bearer member-token" },
    });
    expect(denied.status).toBe(403);

    const allowed = await app.request("/v1/admin/models/catalog", {
      headers: { Authorization: "Bearer renwork-super-admin-test-token" },
    });
    expect(allowed.status).toBe(200);
    const payload = await allowed.json();
    expect(payload.providers[0]?.credentialRef).toBe("env://OPENROUTER_API_KEY");
  });

  test("keeps provider health tests behind the super-admin boundary", async () => {
    const denied = await app.request("/v1/admin/models/providers/openrouter-primary/test", {
      method: "POST",
      headers: { Authorization: "Bearer member-token" },
    });
    expect(denied.status).toBe(403);

    const allowed = await app.request("/v1/admin/models/providers/openrouter-primary/test", {
      method: "POST",
      headers: { Authorization: "Bearer renwork-super-admin-test-token" },
    });
    expect(allowed.status).toBe(200);
    const payload = await allowed.json();
    expect(payload.providerId).toBe("openrouter-primary");
    expect(payload.health).toBe("degraded");
    expect(payload.message).toContain("environment secret is missing");
  });

  test("self-checks device OAuth policy without accepting a cloud token", async () => {
    const current = await app.request("/v1/admin/models/catalog", {
      headers: { Authorization: "Bearer renwork-super-admin-test-token" },
    }).then((response) => response.json());
    const deviceProvider = {
      id: "openai-personal-oauth",
      displayName: "OpenAI Personal OAuth",
      kind: "runtime",
      protocol: "opencode",
      baseUrl: null,
      credentialRef: null,
      authMode: "device_oauth",
      credentialStore: "device_vault",
      executionScope: "personal_device",
      sharingScope: "user_private",
      deviceOAuthPolicy: { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 },
      enabled: true,
      health: "unknown",
    };
    const updated = { ...current, version: `${current.version}-device-oauth`, providers: [...current.providers, deviceProvider] };
    const save = await app.request("/v1/admin/models/catalog", {
      method: "PUT",
      headers: { Authorization: "Bearer renwork-super-admin-test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: current.version, catalog: updated }),
    });
    expect(save.status).toBe(200);

    const checked = await app.request("/v1/admin/models/providers/openai-personal-oauth/test", {
      method: "POST",
      headers: { Authorization: "Bearer renwork-super-admin-test-token" },
    });
    expect(checked.status).toBe(200);
    const payload = await checked.json();
    expect(payload.ok).toBe(true);
    expect(payload.message).toContain("设备 OAuth 策略有效");
    expect(JSON.stringify(await save.json())).not.toContain("oauth_token");

    const persisted = JSON.parse(await readFile(statePath, "utf8"));
    expect(Object.keys(persisted)).toEqual(["modelCatalog"]);
    expect(JSON.stringify(persisted)).not.toContain("wallet");
  });

  test("does not expose the retired file-backed RenCredit ledger", async () => {
    const wallet = await app.request("/v1/rencredit/wallet");
    const reserve = await app.request("/v1/rencredit/reservations", { method: "POST" });
    expect(wallet.status).toBe(404);
    expect(reserve.status).toBe(404);
  });
});
