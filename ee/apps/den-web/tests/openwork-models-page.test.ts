import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INFERENCE_MODEL_ALIASES } from "@openwork/types/den/inference";

const screen = readFileSync(
  join(import.meta.dir, "..", "app", "(den)", "dashboard", "_components", "inference-screen.tsx"),
  "utf8",
);

describe("RenWork Models page", () => {
  test("leads with the flat page header instead of the gradient hero", () => {
    expect(screen).toContain("DenPageHeader");
    expect(screen).toContain("Reliable, hand-picked models for knowledge work.");
    expect(screen).not.toContain("DashboardPageTemplate");
  });

  test("renders the lineup through the shared table primitive", () => {
    for (const primitive of ["DenTable", "DenCard", "DenSectionHeader", "DenNotice", "DenButton"]) {
      expect(screen).toContain(primitive);
    }
    expect(screen).toContain('headerTone="plain"');
    expect(screen).toContain("Best for");
    expect(screen).toContain("Model ID");
  });

  test("describes every shipped model", () => {
    for (const [id, model] of Object.entries(INFERENCE_MODEL_ALIASES)) {
      if (!model.enabled) continue;
      expect(screen).toContain(`"${id}": { bestFor:`);
    }
  });

  test("uses the authoritative V7 plan request flow instead of legacy Stripe checkout", () => {
    expect(screen).toContain("/v1/renwork/commerce/catalog");
    expect(screen).toContain("/v1/renwork/commerce/access-requests");
    expect(screen).toContain("Request access");
    expect(screen).toContain("No free plan");
    expect(screen).toContain("Manage subscription");
    expect(screen).not.toContain("/v1/billing/stripe/checkout");
    expect(screen).not.toContain("$10 / user / month");
    expect(screen).toContain('method: "PATCH"');
  });

  test("does not advertise BYOK or local model fallback", () => {
    expect(screen).not.toContain("Set up Bring your Own Keys.");
    expect(screen).not.toContain("Keep your own provider keys");
    expect(screen).toContain("no local model or personal API-key fallback");
  });
});
