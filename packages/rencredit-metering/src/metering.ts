import {
  BASIS_POINTS,
  RATE_PER_TOKENS,
  type RenWorkAdminModel,
  type RenWorkTokenRateCard,
  type RenWorkTokenUsage,
} from "./contracts.js";

export const EMPTY_TOKEN_USAGE: RenWorkTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

function safeTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeOpenCodeUsage(input: unknown): RenWorkTokenUsage {
  if (!record(input)) return { ...EMPTY_TOKEN_USAGE };
  const cache = record(input.cache) ? input.cache : {};
  return {
    inputTokens: safeTokenCount(input.input),
    outputTokens: safeTokenCount(input.output),
    reasoningTokens: safeTokenCount(input.reasoning),
    cacheReadTokens: safeTokenCount(cache.read),
    cacheWriteTokens: safeTokenCount(cache.write),
  };
}

export function normalizeOpenAiUsage(input: unknown): RenWorkTokenUsage {
  if (!record(input)) return { ...EMPTY_TOKEN_USAGE };
  const promptDetails = record(input.prompt_tokens_details) ? input.prompt_tokens_details : {};
  const completionDetails = record(input.completion_tokens_details) ? input.completion_tokens_details : {};
  const cacheReadTokens = safeTokenCount(promptDetails.cached_tokens);
  const promptTokens = safeTokenCount(input.prompt_tokens);
  return {
    inputTokens: Math.max(0, promptTokens - cacheReadTokens),
    outputTokens: safeTokenCount(input.completion_tokens),
    reasoningTokens: safeTokenCount(completionDetails.reasoning_tokens),
    cacheReadTokens,
    cacheWriteTokens: 0,
  };
}

export function normalizeAnthropicUsage(input: unknown): RenWorkTokenUsage {
  if (!record(input)) return { ...EMPTY_TOKEN_USAGE };
  return {
    inputTokens: safeTokenCount(input.input_tokens),
    outputTokens: safeTokenCount(input.output_tokens),
    reasoningTokens: safeTokenCount(input.reasoning_tokens),
    cacheReadTokens: safeTokenCount(input.cache_read_input_tokens),
    cacheWriteTokens: safeTokenCount(input.cache_creation_input_tokens),
  };
}

export function addTokenUsage(left: RenWorkTokenUsage, right: RenWorkTokenUsage): RenWorkTokenUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  };
}

function weightedRateNumerator(usage: RenWorkTokenUsage, rates: RenWorkTokenRateCard): bigint {
  return BigInt(usage.inputTokens) * BigInt(rates.inputMicroCreditsPerMillion)
    + BigInt(usage.outputTokens) * BigInt(rates.outputMicroCreditsPerMillion)
    + BigInt(usage.reasoningTokens) * BigInt(rates.reasoningMicroCreditsPerMillion)
    + BigInt(usage.cacheReadTokens) * BigInt(rates.cacheReadMicroCreditsPerMillion)
    + BigInt(usage.cacheWriteTokens) * BigInt(rates.cacheWriteMicroCreditsPerMillion);
}

function ceilDivision(numerator: bigint, denominator: bigint): bigint {
  if (numerator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

export function calculateRenCreditMicroCharge(
  usage: RenWorkTokenUsage,
  model: Pick<RenWorkAdminModel, "rates" | "priceMultiplierBps" | "promotion">,
  now = new Date(),
): number {
  const promotionActive = model.promotion
    ? Date.parse(model.promotion.startsAt) <= now.getTime() && now.getTime() < Date.parse(model.promotion.endsAt)
    : false;
  const promotionBps = promotionActive ? model.promotion?.multiplierBps ?? BASIS_POINTS : BASIS_POINTS;
  const numerator = weightedRateNumerator(usage, model.rates)
    * BigInt(model.priceMultiplierBps)
    * BigInt(promotionBps);
  const denominator = BigInt(RATE_PER_TOKENS) * BigInt(BASIS_POINTS) * BigInt(BASIS_POINTS);
  const result = ceilDivision(numerator, denominator);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("RenCredit charge exceeds the safe integer range.");
  return Number(result);
}

export function formatRenCredit(microCredits: number): string {
  if (!Number.isSafeInteger(microCredits) || microCredits < 0) throw new Error("microCredits must be a non-negative safe integer.");
  const whole = Math.floor(microCredits / 1_000_000);
  const fraction = String(microCredits % 1_000_000).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formatMultiplier(multiplierBps: number): string {
  if (!Number.isSafeInteger(multiplierBps) || multiplierBps < 0) throw new Error("multiplierBps must be non-negative.");
  const value = multiplierBps / BASIS_POINTS;
  return `×${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}
