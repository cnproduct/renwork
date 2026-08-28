import { beforeAll, describe, expect, test } from "bun:test";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.RENWORK_SUPER_ADMIN_TOKEN = "renwork-super-admin-test-token";
  process.env.DATA_PATH = `/private/tmp/renwork-cloud-api-test-${process.pid}.json`;
  ({ app } = await import("./server.js"));
});

describe("RenWork model catalog API", () => {
  test("publishes member model choices without provider routing or secret references", async () => {
    const response = await app.request("/v1/models/catalog");
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.models).toHaveLength(4);
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
});
