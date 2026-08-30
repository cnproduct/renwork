import { describe, expect, it } from "bun:test";
import {
  assertRenWorkMeteredCommand,
  assertRenWorkMeteredPrompt,
  assertRenWorkMeteredSummarize,
} from "./renwork-metered-runtime-gate.js";

function body(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).buffer;
}

describe("RenWork metered runtime gate", () => {
  it("allows the RenWork provider", () => {
    expect(() => assertRenWorkMeteredPrompt(body({ model: { providerID: "renwork", modelID: "renwork-standard" } }))).not.toThrow();
  });

  it("rejects direct OAuth, BYOK and local providers before execution", () => {
    for (const providerID of ["openai", "google", "openrouter", "ollama", "opencode"]) {
      expect(() => assertRenWorkMeteredPrompt(body({ model: { providerID, modelID: "anything" } }))).toThrow("metered runtime");
    }
  });

  it("rejects a prompt without an explicit metered model", () => {
    expect(() => assertRenWorkMeteredPrompt(body({ parts: [] }))).toThrow("metered runtime");
  });

  it("requires metered models for commands and summarization", () => {
    expect(() => assertRenWorkMeteredCommand(body({ model: "renwork/renwork-standard" }))).not.toThrow();
    expect(() => assertRenWorkMeteredCommand(body({ model: "openai/gpt-5" }))).toThrow("metered runtime");
    expect(() => assertRenWorkMeteredSummarize(body({ providerID: "renwork", modelID: "renwork-standard" }))).not.toThrow();
    expect(() => assertRenWorkMeteredSummarize(body({ providerID: "openai", modelID: "gpt-5" }))).toThrow("metered runtime");
  });
});
