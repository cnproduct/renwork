import { describe, expect, test } from "bun:test";

import { calculateRenCreditMicroCharge, normalizeAnthropicUsage, normalizeOpenAiUsage, normalizeOpenCodeUsage } from "./metering.js";
import { createTestCatalog } from "./test-fixtures.js";

describe("RenWork token metering", () => {
  test("charges input, output, reasoning and both cache token classes", () => {
    const model = createTestCatalog().models[0]!;
    const charge = calculateRenCreditMicroCharge({
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 50,
    }, model, new Date("2026-08-28T12:00:00.000Z"));

    expect(charge).toBe(75);
  });

  test("normalizes OpenCode usage", () => {
    expect(normalizeOpenCodeUsage({ input: 10, output: 20, reasoning: 30, cache: { read: 40, write: 50 } })).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 30,
      cacheReadTokens: 40,
      cacheWriteTokens: 50,
    });
  });

  test("normalizes OpenAI cached input without charging it twice", () => {
    expect(normalizeOpenAiUsage({
      prompt_tokens: 100,
      completion_tokens: 40,
      prompt_tokens_details: { cached_tokens: 60 },
      completion_tokens_details: { reasoning_tokens: 10 },
    })).toEqual({
      inputTokens: 40,
      outputTokens: 40,
      reasoningTokens: 10,
      cacheReadTokens: 60,
      cacheWriteTokens: 0,
    });
  });

  test("normalizes Anthropic cache token classes", () => {
    expect(normalizeAnthropicUsage({
      input_tokens: 100,
      output_tokens: 40,
      cache_read_input_tokens: 60,
      cache_creation_input_tokens: 20,
    })).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      reasoningTokens: 0,
      cacheReadTokens: 60,
      cacheWriteTokens: 20,
    });
  });
});
