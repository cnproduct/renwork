import { describe, expect, test } from "bun:test";

import { buildDenDashboardUrl } from "../src/app/lib/den";

describe("RenWork admin dashboard URL", () => {
  test("opens the dashboard instead of the marketing root", () => {
    expect(buildDenDashboardUrl("https://www.rrenn.com/"))
      .toBe("https://www.rrenn.com/dashboard");
  });

  test("keeps self-hosted control planes on their own origin", () => {
    expect(buildDenDashboardUrl("https://renwork.example/control-plane"))
      .toBe("https://renwork.example/dashboard");
  });
});
