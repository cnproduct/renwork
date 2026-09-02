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
    billingPolicy: {
      official: "token_metered",
      byok: "token_metered",
      local: "token_metered",
    },
    updatedAt: now.toISOString(),
    providers: [{
      id: "openrouter-primary",
      displayName: "OpenRouter Primary",
      kind: "relay",
      protocol: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      credentialRef: "env://OPENROUTER_API_KEY",
      authMode: "service_secret",
      credentialStore: "server_secret",
      executionScope: "cloud_gateway",
      sharingScope: "organization",
      deviceOAuthPolicy: null,
      enabled: true,
      health: "unknown",
    }, {
      id: "openai-codex-personal",
      displayName: "OpenAI Codex OAuth（个人设备）",
      kind: "runtime",
      protocol: "codex_cli",
      baseUrl: null,
      credentialRef: null,
      authMode: "device_oauth",
      credentialStore: "device_vault",
      executionScope: "personal_device",
      sharingScope: "user_private",
      deviceOAuthPolicy: {
        maxDevicesPerUser: 3,
        maxConcurrentRunsPerUser: 1,
      },
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
      {
        sku: "renwork-codex",
        displayName: "Codex OAuth",
        description: "在已批准的个人设备上使用 ChatGPT Plus / Pro 的 Codex CLI，并按实际 Token 结算 RenCredit",
        tier: "professional",
        sortOrder: 40,
        autoEligible: false,
        status: "published",
        contextWindow: null,
        tags: ["codex", "oauth", "personal-device"],
        displayMultiplierBps: 10_000,
        priceMultiplierBps: 10_000,
        rates: { ...DEFAULT_RATES },
        promotion: null,
        allowedPlanIds: ["individual", "enterprise"],
        routes: [{
          id: "route-renwork-codex-personal",
          providerId: "openai-codex-personal",
          upstreamModelId: "gpt-5.6-luna",
          priority: 10,
          enabled: true,
          source: "local",
        }],
      },
    ],
  };
}
