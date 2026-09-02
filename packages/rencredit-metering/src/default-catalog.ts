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

export const OPENAI_OAUTH_CATALOG_MIGRATION = "v13-openai-oauth-chat-models";
export const OPENAI_OAUTH_PROVIDER_POLICY_MIGRATION = "v13-openai-oauth-provider-policy";

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

function openAIOAuthModel(input: {
  sku: string;
  upstreamModelId: string;
  displayName: string;
  description: string;
  tier: RenWorkModelTier;
  sortOrder: number;
  tags?: string[];
}): RenWorkAdminModel {
  return {
    sku: input.sku,
    displayName: input.displayName,
    description: input.description,
    tier: input.tier,
    sortOrder: input.sortOrder,
    autoEligible: false,
    status: "published",
    contextWindow: null,
    tags: ["openai", "oauth", "personal-device", ...(input.tags ?? [])],
    displayMultiplierBps: 10_000,
    priceMultiplierBps: 10_000,
    rates: { ...DEFAULT_RATES },
    promotion: null,
    allowedPlanIds: ["individual", "enterprise"],
    routes: [{
      id: `route-${input.sku}-personal`,
      providerId: "openai",
      upstreamModelId: input.upstreamModelId,
      priority: 10,
      enabled: true,
      source: "local",
    }],
  };
}

export function createDefaultRenWorkModelCatalog(now = new Date()): RenWorkAdminModelCatalog {
  return {
    version: "renwork-model-catalog-v13",
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
    }, {
      // This ID deliberately matches OpenCode's built-in OpenAI provider. The
      // OAuth credential remains in the signed-in user's device vault; Den
      // returns only this provider/model route in the execution grant.
      id: "openai",
      displayName: "OpenAI ChatGPT OAuth（个人设备）",
      kind: "runtime",
      protocol: "opencode",
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
        displayName: "Codex CLI OAuth",
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
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-6-luna",
        upstreamModelId: "gpt-5.6-luna",
        displayName: "GPT-5.6 Luna",
        description: "使用本机 ChatGPT OAuth，适合快速日常任务",
        tier: "standard",
        sortOrder: 15,
      }),
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-5",
        upstreamModelId: "gpt-5.5",
        displayName: "GPT-5.5",
        description: "使用本机 ChatGPT OAuth，适合通用编程与知识工作",
        tier: "professional",
        sortOrder: 41,
      }),
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-6",
        upstreamModelId: "gpt-5.6",
        displayName: "GPT-5.6",
        description: "使用本机 ChatGPT OAuth 的 GPT-5.6 通用模型",
        tier: "professional",
        sortOrder: 42,
      }),
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-6-terra",
        upstreamModelId: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
        description: "使用本机 ChatGPT OAuth，平衡速度与复杂任务能力",
        tier: "professional",
        sortOrder: 43,
      }),
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-3-codex-spark",
        upstreamModelId: "gpt-5.3-codex-spark",
        displayName: "GPT-5.3 Codex Spark",
        description: "使用本机 ChatGPT Pro OAuth 的高速代码模型",
        tier: "professional",
        sortOrder: 44,
        tags: ["codex", "pro-only"],
      }),
      openAIOAuthModel({
        sku: "renwork-openai-gpt-5-6-sol",
        upstreamModelId: "gpt-5.6-sol",
        displayName: "GPT-5.6 Sol",
        description: "使用本机 ChatGPT OAuth，适合可靠的高强度任务",
        tier: "ultimate",
        sortOrder: 31,
      }),
    ],
  };
}

/**
 * Adds product defaults introduced after a catalog was first persisted while
 * preserving every administrator-owned row and override. Callers must record
 * the migration separately so an intentional later deletion is not re-added
 * on every service restart.
 */
export function mergeMissingDefaultCatalogEntries(
  persisted: RenWorkAdminModelCatalog,
  defaults: RenWorkAdminModelCatalog,
): { catalog: RenWorkAdminModelCatalog; changed: boolean } {
  const providerIds = new Set(persisted.providers.map((provider) => provider.id));
  const modelSkus = new Set(persisted.models.map((model) => model.sku));
  const missingProviders = defaults.providers.filter((provider) => !providerIds.has(provider.id));
  const missingModels = defaults.models.filter((model) => !modelSkus.has(model.sku));
  const changed = missingProviders.length > 0 || missingModels.length > 0;

  if (!changed) return { catalog: persisted, changed: false };
  return {
    changed: true,
    catalog: {
      ...persisted,
      version: `${persisted.version}-${OPENAI_OAUTH_CATALOG_MIGRATION}`,
      updatedAt: defaults.updatedAt,
      providers: [...persisted.providers, ...missingProviders],
      models: [...persisted.models, ...missingModels],
    },
  };
}

/**
 * Catalogs written before the provider-governance fields existed can already
 * contain OpenCode's built-in `openai` runtime row. Normalization must remain
 * conservative, so it projects that row as unauthenticated. Upgrade only the
 * exact legacy shape whose governance fields were all absent; an explicit
 * administrator choice, including `authMode: "none"`, is never overwritten.
 */
export function migrateLegacyOpenAIOAuthProvider(
  persisted: RenWorkAdminModelCatalog,
  rawPersisted: unknown,
  defaults: RenWorkAdminModelCatalog,
): { catalog: RenWorkAdminModelCatalog; changed: boolean } {
  if (!rawPersisted || typeof rawPersisted !== "object") return { catalog: persisted, changed: false };
  const rawProviders = (rawPersisted as { providers?: unknown }).providers;
  if (!Array.isArray(rawProviders)) return { catalog: persisted, changed: false };

  const rawOpenAI = rawProviders.find((provider): provider is Record<string, unknown> => (
    Boolean(provider) && typeof provider === "object" && (provider as { id?: unknown }).id === "openai"
  ));
  if (!rawOpenAI) return { catalog: persisted, changed: false };

  const governanceFields = [
    "authMode",
    "credentialStore",
    "executionScope",
    "sharingScope",
    "deviceOAuthPolicy",
  ] as const;
  if (governanceFields.some((field) => Object.prototype.hasOwnProperty.call(rawOpenAI, field))) {
    return { catalog: persisted, changed: false };
  }

  const currentIndex = persisted.providers.findIndex((provider) => provider.id === "openai");
  const oauthDefault = defaults.providers.find((provider) => provider.id === "openai");
  const current = persisted.providers[currentIndex];
  if (
    currentIndex < 0
    || !current
    || !oauthDefault
    || current.kind !== "runtime"
    || current.protocol !== "opencode"
    || current.baseUrl !== null
    || current.credentialRef !== null
  ) {
    return { catalog: persisted, changed: false };
  }

  const providers = [...persisted.providers];
  providers[currentIndex] = {
    ...current,
    authMode: oauthDefault.authMode,
    credentialStore: oauthDefault.credentialStore,
    executionScope: oauthDefault.executionScope,
    sharingScope: oauthDefault.sharingScope,
    deviceOAuthPolicy: oauthDefault.deviceOAuthPolicy
      ? { ...oauthDefault.deviceOAuthPolicy }
      : null,
  };
  return {
    changed: true,
    catalog: {
      ...persisted,
      version: `${persisted.version}-${OPENAI_OAUTH_PROVIDER_POLICY_MIGRATION}`,
      updatedAt: defaults.updatedAt,
      providers,
    },
  };
}
