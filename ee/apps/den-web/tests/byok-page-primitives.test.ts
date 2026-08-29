import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = join(import.meta.dir, "..", "app", "(den)");

function readComponent(...segments: string[]) {
  return readFileSync(join(appRoot, ...segments), "utf8");
}

const screen = readComponent("dashboard", "_components", "llm-providers-screen.tsx");
const shell = readComponent("dashboard", "_components", "org-dashboard-shell.tsx");

describe("organization model policy page", () => {
  test("sidebar and page title expose policy instead of provider administration", () => {
    expect(shell).toContain('label: "Model policy"');
    expect(shell).toContain('return "Model policy";');
    expect(shell).not.toContain('"LLM Providers"');
    expect(screen).toContain('title="Model policy"');
    expect(screen).not.toContain("Bring your Own Keys");
  });

  test("Owner policy covers only the approved governance controls", () => {
    expect(screen).toContain("allowedModelSkus");
    expect(screen).toContain("defaultModelSku");
    expect(screen).toContain("dailyBudgetMicroCredits");
    expect(screen).toContain("monthlyBudgetMicroCredits");
    expect(screen).toContain("memberMonthlyBudgetMicroCredits");
    expect(screen).not.toContain("test-connection");
    expect(screen).not.toContain("apiKey");
  });

  test("screen uses the shared dashboard surface and native accessible form controls", () => {
    for (const primitive of ["DashboardPageTemplate", "DenCard", "DenButton", "DenNotice"]) {
      expect(screen).toContain(primitive);
    }
    expect(screen).not.toContain("<table");
    expect(screen).toContain("<input");
    expect(screen).toContain("<select");
  });

  test("option card renders a native input so keyboard and e2e flows keep working", () => {
    const optionCard = readComponent("_components", "ui", "option-card.tsx");
    expect(optionCard).toContain("<input");
    expect(optionCard).toContain("data-testid={testId}");
  });

  test("brand mark reuses the shared icon ladder and ends on a monogram", () => {
    const brandMark = readComponent("_components", "ui", "brand-mark.tsx");
    const integrationIcon = readComponent("dashboard", "_components", "integration-icon.tsx");
    expect(brandMark).toContain("brandIconCandidates");
    expect(integrationIcon).toContain("brandIconCandidates");
    expect(integrationIcon).not.toContain("cdn.simpleicons.org");
    expect(brandMark).toContain("monogram");
  });
});
