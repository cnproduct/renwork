import { describe, expect, test } from "bun:test";

import { parseManualAuthInput } from "../src/react-app/domains/cloud/forced-signin-page";
import { parseManualDenAuthInput } from "../src/app/lib/openwork-links";

const GRANT = "one-time-desktop-grant";

describe("manual Den auth input", () => {
  test("accepts RenWork production and development handoff links", () => {
    const denBaseUrl = "https://www.rrenn.com";

    expect(parseManualAuthInput(
      `renwork://den-auth?grant=${GRANT}&denBaseUrl=${encodeURIComponent(denBaseUrl)}`,
    )).toEqual({ grant: GRANT, baseUrl: denBaseUrl });
    expect(parseManualAuthInput(`renwork-dev://den-auth?grant=${GRANT}`)).toEqual({
      grant: GRANT,
      baseUrl: undefined,
    });
  });

  test("uses the shared parser on every manual sign-in surface", () => {
    const input = `renwork://den-auth?grant=${GRANT}`;
    expect(parseManualAuthInput(input)).toEqual(parseManualDenAuthInput(input));
  });

  test("keeps legacy OpenWork handoff links compatible", () => {
    expect(parseManualAuthInput(`openwork://den-auth?grant=${GRANT}`)).toEqual({
      grant: GRANT,
      baseUrl: undefined,
    });
  });

  test("accepts a raw one-time grant but rejects unrelated URLs", () => {
    expect(parseManualAuthInput(GRANT)).toEqual({ grant: GRANT });
    expect(parseManualAuthInput("https://www.rrenn.com/?grant=not-a-handoff")).toBeNull();
    expect(parseManualAuthInput(`renwork://other-route?grant=${GRANT}`)).toBeNull();
  });
});
