/** @jsxImportSource react */
declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toContain: (expected: string) => void;
  not: { toContain: (expected: string) => void };
};

import { renderToStaticMarkup } from "react-dom/server";

import { AttributionStep } from "./attribution-step";

describe("RenWork attribution onboarding", () => {
  test("renders the RenWork brand without exposing the upstream product name", () => {
    const markup = renderToStaticMarkup(
      <AttributionStep onSubmit={() => undefined} onSkip={() => undefined} />,
    );

    expect(markup).toContain("How did you hear about RenWork?");
    expect(markup).not.toContain("OpenWork");
  });
});
