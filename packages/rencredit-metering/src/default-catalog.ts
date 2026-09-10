import type {
  RenWorkAdminModel,
  RenWorkAdminModelCatalog,
  RenWorkModelTier,
} from "./contracts.js";
import { isDenServerProvider } from "./catalog.js";

const DEFAULT_RATES = {
  inputMicroCreditsPerMillion: 1_000_000,
  outputMicroCreditsPerMillion: 3_000_000,
  reasoningMicroCreditsPerMillion: 3_000_000,
  cacheReadMicroCreditsPerMillion: 200_000,
  cacheWriteMicroCreditsPerMillion: 1_250_000,
} as const;

export const OPENAI_OAUTH_CATALOG_MIGRATION = "v13-openai-oauth-chat-models";
export const OPENAI_OAUTH_PROVIDER_POLICY_MIGRATION = "v13-openai-oauth-provider-policy";
export const DEN_SERVER_EXCLUSIVE_CATALOG_MIGRATION = "v36-den-server-exclusive";
export const DEN_SERVER_CATALOG_PURGE_MIGRATION = "v38-den-server-catalog-purge";

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
    allowedPlanIds: ["individual", "enterprise"],
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
    version: "renwork-model-catalog-v38",
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
      id: "opencode-go-primary",
      displayName: "OpenCode Go",
      kind: "relay",
      protocol: "openai_compatible",
      baseUrl: "https://opencode.ai/zen/go/v1",
      credentialRef: "env://OPENCODE_GO_API_KEY",
      authMode: "service_secret",
      credentialStore: "server_secret",
      executionScope: "cloud_gateway",
      sharingScope: "organization",
      deviceOAuthPolicy: null,
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
        sku: "renwork-code-kimi-k3",
        displayName: "Kimi K3",
        description: "通过 RenWork 云端计费网关提供的代码与智能体模型",
        tier: "professional",
        sortOrder: 40,
        autoEligible: false,
        status: "published",
        contextWindow: null,
        tags: ["coding", "agent"],
        displayMultiplierBps: 10_000,
        priceMultiplierBps: 10_000,
        rates: { ...DEFAULT_RATES },
        promotion: null,
        allowedPlanIds: ["individual", "enterprise"],
        routes: [{
          id: "route-renwork-code-kimi-k3",
          providerId: "opencode-go-primary",
          upstreamModelId: "kimi-k3",
          priority: 10,
          enabled: true,
          source: "official",
        }],
      },
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

/**
 * One-time, reversible cleanup for catalogs created before Den became the only
 * execution boundary. Legacy rows stay visible to the super administrator for
 * audit, but they cannot be published or selected by a member.
 */
export function migrateToDenServerExclusiveCatalog(
  persisted: RenWorkAdminModelCatalog,
  now = new Date(),
): { catalog: RenWorkAdminModelCatalog; changed: boolean } {
  const serverProviderIds = new Set(
    persisted.providers.filter((provider) => isDenServerProvider(provider)).map((provider) => provider.id),
  );
  const providers = persisted.providers.map((provider) => (
    serverProviderIds.has(provider.id)
      ? provider
      : { ...provider, enabled: false, health: "offline" as const }
  ));
  const models = persisted.models.map((model) => {
    const routes = model.routes.map((route) => (
      route.source === "official" && serverProviderIds.has(route.providerId)
        ? route
        : { ...route, enabled: false }
    ));
    const hasEnabledRoute = routes.some((route) => route.enabled);
    return {
      ...model,
      routes,
      status: model.status === "published" && !hasEnabledRoute ? "paused" as const : model.status,
    };
  });
  const billingPolicy = { official: "token_metered", byok: "token_metered", local: "token_metered" } as const;
  const changed = persisted.billingPolicy.official !== billingPolicy.official
    || persisted.billingPolicy.byok !== billingPolicy.byok
    || persisted.billingPolicy.local !== billingPolicy.local
    || providers.some((provider, index) => provider.enabled !== persisted.providers[index]?.enabled || provider.health !== persisted.providers[index]?.health)
    || models.some((model, index) => model.status !== persisted.models[index]?.status || model.routes.some((route, routeIndex) => route.enabled !== persisted.models[index]?.routes[routeIndex]?.enabled));
  if (!changed) return { catalog: persisted, changed: false };
  return {
    changed: true,
    catalog: {
      ...persisted,
      version: `${persisted.version}-${DEN_SERVER_EXCLUSIVE_CATALOG_MIGRATION}`,
      updatedAt: now.toISOString(),
      billingPolicy,
      providers,
      models,
    },
  };
}

/**
 * Permanently removes legacy client-side credentials and routes. Unlike the
 * V36 audit migration, this leaves no dormant BYOK/local row that a later UI
 * or configuration change could accidentally reactivate.
 */
export function purgeNonDenCatalogEntries(
  persisted: RenWorkAdminModelCatalog,
  now = new Date(),
): { catalog: RenWorkAdminModelCatalog; changed: boolean } {
  const providers = persisted.providers.filter(isDenServerProvider);
  const providerIds = new Set(providers.map((provider) => provider.id));
  const blockedTags = new Set(["oauth", "personal-device", "local", "byok", "device-vault"]);
  const models = persisted.models.flatMap((model) => {
    const routes = model.routes.filter((route) => route.source === "official" && providerIds.has(route.providerId));
    const removedEveryConfiguredRoute = model.routes.length > 0 && routes.length === 0;
    if (removedEveryConfiguredRoute) return [];
    const allowedPlanIds = model.allowedPlanIds.filter((planId) => planId !== "free");
    const tags = model.tags.filter((tag) => !blockedTags.has(tag.trim().toLowerCase()));
    const hasEnabledRoute = routes.some((route) => route.enabled);
    const description = /oauth|personal[ -]?device|local model|api key|byok|本机|个人设备|自有\s*key/i.test(model.description)
      ? "通过 RenWork 云端计费网关提供的模型。"
      : model.description;
    return [{
      ...model,
      description,
      allowedPlanIds: allowedPlanIds.length > 0 ? allowedPlanIds : ["individual", "enterprise"],
      tags,
      routes,
      status: model.status === "published" && !hasEnabledRoute ? "paused" as const : model.status,
    }];
  });
  const billingPolicy = { official: "token_metered", byok: "token_metered", local: "token_metered" } as const;
  const changed = JSON.stringify({ providers, models, billingPolicy }) !== JSON.stringify({
    providers: persisted.providers,
    models: persisted.models,
    billingPolicy: persisted.billingPolicy,
  });
  if (!changed) return { catalog: persisted, changed: false };
  return {
    changed: true,
    catalog: {
      ...persisted,
      version: `${persisted.version}-${DEN_SERVER_CATALOG_PURGE_MIGRATION}`,
      updatedAt: now.toISOString(),
      billingPolicy,
      providers,
      models,
    },
  };
}
