import type {
  RenWorkAdminModel,
  RenWorkAdminModelCatalog,
  RenWorkModelTier,
} from "./contracts.js";

const DEFAULT_RATES = {
  inputMicroCreditsPerMillion: 1_000_000,
  outputMicroCreditsPerMillion: 3_000_000,
  reasoningMicroCreditsPerMillion: 3_000_000,
  cacheReadMicroCreditsPerMillion: 200_000,
  cacheWriteMicroCreditsPerMillion: 1_250_000,
} as const;

function defaultModel(input: {
  sku: string;
  displayName: string;
  description: string;
  tier: RenWorkModelTier;
  multiplierBps: number;
  sortOrder: number;
  autoEligible: boolean;
}): RenWorkAdminModel {
  const {
    sku,
    displayName,
    description,
    tier,
    multiplierBps,
    sortOrder,
    autoEligible,
  } = input;
  return {
    sku,
    displayName,
    description,
    tier,
    sortOrder,
    autoEligible,
    status: "published",
    contextWindow: null,
    tags: [],
    displayMultiplierBps: multiplierBps,
    priceMultiplierBps: multiplierBps,
    rates: { ...DEFAULT_RATES },
    promotion: null,
    allowedPlanIds: ["free", "individual", "enterprise"],
    routes: [{
      id: `route-${sku}`,
      providerId: "openrouter-primary",
      upstreamModelId: sku === "renwork-auto"
        ? "deepseek/deepseek-v4-flash"
        : sku === "renwork-standard"
          ? "deepseek/deepseek-v4-flash"
          : sku === "renwork-professional"
            ? "moonshotai/kimi-k2.6"
            : "z-ai/glm-5.2",
      priority: 10,
      enabled: true,
      source: "official",
    }],
  };
}

export function createDefaultRenWorkModelCatalog(now = new Date()): RenWorkAdminModelCatalog {
  return {
    version: "renwork-model-catalog-v1",
    status: "active",
    currency: "REN_CREDIT",
    updatedAt: now.toISOString(),
    providers: [{
      id: "openrouter-primary",
      displayName: "OpenRouter Primary",
      kind: "relay",
      protocol: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      credentialRef: "env://OPENROUTER_API_KEY",
      enabled: true,
      health: "unknown",
    }],
    models: [
      defaultModel({
        sku: "renwork-auto",
        displayName: "智能 Auto",
        description: "由 RenWork 按任务自动选择合适模型",
        tier: "auto",
        multiplierBps: 10_000,
        sortOrder: 0,
        autoEligible: true,
      }),
      defaultModel({
        sku: "renwork-standard",
        displayName: "DeepSeek V4 Flash",
        description: "适合日常问答、整理与轻量执行",
        tier: "standard",
        multiplierBps: 1_300,
        sortOrder: 10,
        autoEligible: true,
      }),
      defaultModel({
        sku: "renwork-professional",
        displayName: "Kimi K2.6",
        description: "适合复杂研究、分析与多步骤任务",
        tier: "professional",
        multiplierBps: 10_000,
        sortOrder: 20,
        autoEligible: true,
      }),
      defaultModel({
        sku: "renwork-ultimate",
        displayName: "GLM-5.2",
        description: "适合高难度推理和关键业务任务",
        tier: "ultimate",
        multiplierBps: 28_000,
        sortOrder: 30,
        autoEligible: false,
      }),
    ],
  };
}
