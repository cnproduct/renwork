import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("RenWork advanced settings branding", () => {
  test("uses RenWork translation keys and deep-link examples", () => {
    const source = readSource(
      "../src/react-app/domains/settings/pages/advanced-view-sections.tsx",
    );

    expect(source).toContain('t("settings.renwork_server_label")');
    expect(source).toContain('t("settings.renwork_server_desc")');
    expect(source).toContain('t("settings.restart_renwork_server")');
    expect(source).toContain('placeholder="renwork://..."');
    expect(source).not.toContain('t("settings.openwork_server_label")');
    expect(source).not.toContain('t("settings.openwork_server_desc")');
    expect(source).not.toContain('t("settings.restart_openwork_server")');
    expect(source).not.toContain('placeholder="openwork://..."');
  });

  test("keeps legacy paths and raw runtime data behind compatibility disclosures", () => {
    const source = readSource(
      "../src/react-app/domains/settings/pages/advanced-view-sections.tsx",
    );

    expect(source).toContain('t("settings.compatibility_details")');
    expect(source).toContain('props.configStatus.legacyOpenwork.path');
    expect(source).toContain("<details");
    expect(source).not.toContain("Legacy OpenWork metadata");
    expect(source).not.toContain("OpenWork runtime DB");
    expect(source).not.toContain("OpenWork injected config");
  });

  test("presents the compatibility default agent as RenWork", () => {
    const source = readSource(
      "../src/react-app/domains/settings/pages/advanced-view-sections.tsx",
    );

    expect(source).toContain('/^(openwork|renwork)$/i.test(rawDefaultAgent) ? "RenWork"');
  });
});
