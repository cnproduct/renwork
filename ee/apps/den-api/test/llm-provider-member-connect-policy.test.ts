import { describe, expect, test } from "bun:test";
import { isMemberConnectableProvider } from "../src/llm/provider-connection-policy";

describe("member LLM provider connection policy", () => {
  test("exposes only the per-member RenWork gateway", () => {
    expect(isMemberConnectableProvider({ providerId: "renwork", source: "openwork" })).toBe(true);
    expect(isMemberConnectableProvider({ providerId: "openrouter-primary", source: "custom" })).toBe(false);
    expect(isMemberConnectableProvider({ providerId: "opencode-go-primary", source: "custom" })).toBe(false);
  });
});
