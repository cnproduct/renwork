import {
  BASIS_POINTS,
  RENWORK_BILLING_MODES,
  RENWORK_MODEL_TIERS,
  RENWORK_ROUTE_SOURCES,
  type RenWorkActorRole,
  type RenWorkAdminModel,
  type RenWorkAdminModelCatalog,
  type RenWorkAdminProvider,
  type RenWorkModelPromotion,
  type RenWorkModelTier,
  type RenWorkPublicModel,
  type RenWorkPublicModelCatalog,
} from "./contracts.js";

const TIER_ORDER = new Map(RENWORK_MODEL_TIERS.map((tier, index) => [tier, index]));

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required.`);
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative safe integer.`);
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive safe integer.`);
}

export function normalizeAdminProvider(
  provider: RenWorkAdminProvider | (Omit<RenWorkAdminProvider, "authMode" | "credentialStore" | "executionScope" | "sharingScope" | "deviceOAuthPolicy"> & Partial<Pick<RenWorkAdminProvider, "authMode" | "credentialStore" | "executionScope" | "sharingScope" | "deviceOAuthPolicy">>),
): RenWorkAdminProvider {
  const legacyPersonalRuntime = provider.kind === "runtime" || provider.kind === "local";
  const authMode = provider.authMode ?? (provider.credentialRef ? "service_secret" : "none");
  return {
    ...provider,
    authMode,
    credentialStore: provider.credentialStore ?? (authMode === "service_secret" ? "server_secret" : authMode === "device_oauth" ? "device_vault" : "none"),
    executionScope: provider.executionScope ?? (legacyPersonalRuntime ? "personal_device" : "cloud_gateway"),
    sharingScope: provider.sharingScope ?? (legacyPersonalRuntime ? "user_private" : "organization"),
    deviceOAuthPolicy: provider.deviceOAuthPolicy ?? (authMode === "device_oauth" ? { maxDevicesPerUser: 3, maxConcurrentRunsPerUser: 1 } : null),
  };
}

export function normalizeAdminModelCatalog(catalog: RenWorkAdminModelCatalog): RenWorkAdminModelCatalog {
  return { ...catalog, providers: catalog.providers.map((provider) => normalizeAdminProvider(provider)) };
}

function promotionIsActive(promotion: RenWorkModelPromotion | null, now: Date): boolean {
  if (!promotion) return false;
  const startsAt = Date.parse(promotion.startsAt);
  const endsAt = Date.parse(promotion.endsAt);
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now.getTime() && now.getTime() < endsAt;
}

export function effectiveDisplayMultiplierBps(model: RenWorkAdminModel, now = new Date()): number {
  if (!promotionIsActive(model.promotion, now)) return model.displayMultiplierBps;
  return Math.ceil(model.displayMultiplierBps * model.promotion!.multiplierBps / BASIS_POINTS);
}

export function validateAdminModelCatalog(catalog: RenWorkAdminModelCatalog): void {
  requireNonEmpty(catalog.version, "catalog.version");
  if (catalog.currency !== "REN_CREDIT") throw new Error("catalog.currency must be REN_CREDIT.");
  for (const source of RENWORK_ROUTE_SOURCES) {
    if (!RENWORK_BILLING_MODES.some((mode) => mode === catalog.billingPolicy[source])) {
      throw new Error(`catalog.billingPolicy.${source} must be token_metered or free.`);
    }
  }
  if (!Number.isFinite(Date.parse(catalog.updatedAt))) throw new Error("catalog.updatedAt must be an ISO date.");

  const providerIds = new Set<string>();
  // Catalog rows written before the OAuth governance fields were introduced
  // intentionally omit those fields. Validate their normalized projection so
  // a rolling Den deployment can continue to read the previous catalog while
  // the catalog service is upgraded independently.
  for (const persistedProvider of catalog.providers) {
    const provider = normalizeAdminProvider(persistedProvider);
    requireNonEmpty(provider.id, "provider.id");
    if (providerIds.has(provider.id)) throw new Error(`Duplicate provider id: ${provider.id}`);
    providerIds.add(provider.id);
    if (provider.credentialRef && !/^(secret|env):\/\/[A-Za-z0-9_./-]+$/.test(provider.credentialRef)) {
      throw new Error(`Provider ${provider.id} credentialRef must use a secret:// or env:// reference.`);
    }
    if (provider.authMode === "device_oauth") {
      if (provider.credentialStore !== "device_vault" || provider.executionScope !== "personal_device" || provider.sharingScope !== "user_private") {
        throw new Error(`Provider ${provider.id} device OAuth must use device_vault, personal_device and user_private.`);
      }
      if (provider.credentialRef !== null || provider.baseUrl !== null) {
        throw new Error(`Provider ${provider.id} device OAuth cannot contain a server credential or Base URL.`);
      }
      if (!provider.deviceOAuthPolicy) throw new Error(`Provider ${provider.id} device OAuth policy is required.`);
      requirePositiveInteger(provider.deviceOAuthPolicy.maxDevicesPerUser, `${provider.id}.deviceOAuthPolicy.maxDevicesPerUser`);
      requirePositiveInteger(provider.deviceOAuthPolicy.maxConcurrentRunsPerUser, `${provider.id}.deviceOAuthPolicy.maxConcurrentRunsPerUser`);
    } else if (provider.deviceOAuthPolicy !== null) {
      throw new Error(`Provider ${provider.id} device OAuth policy is only allowed for device_oauth.`);
    }
    if (provider.credentialStore === "device_vault" && provider.authMode !== "device_oauth") {
      throw new Error(`Provider ${provider.id} device_vault requires device_oauth.`);
    }
    if (provider.authMode === "service_secret") {
      if (provider.credentialStore !== "server_secret" || provider.executionScope !== "cloud_gateway" || provider.sharingScope !== "organization" || !provider.credentialRef) {
        throw new Error(`Provider ${provider.id} service secret must stay in the cloud gateway and be organization-scoped.`);
      }
    }
  }

  const modelSkus = new Set<string>();
  for (const model of catalog.models) {
    requireNonEmpty(model.sku, "model.sku");
    if (modelSkus.has(model.sku)) throw new Error(`Duplicate model sku: ${model.sku}`);
    modelSkus.add(model.sku);
    requireNonNegativeInteger(model.displayMultiplierBps, `${model.sku}.displayMultiplierBps`);
    requireNonNegativeInteger(model.priceMultiplierBps, `${model.sku}.priceMultiplierBps`);
    requireNonNegativeInteger(model.sortOrder, `${model.sku}.sortOrder`);

    for (const [field, value] of Object.entries(model.rates)) {
      requireNonNegativeInteger(value, `${model.sku}.rates.${field}`);
    }
    if (model.promotion) {
      requireNonNegativeInteger(model.promotion.multiplierBps, `${model.sku}.promotion.multiplierBps`);
      if (model.promotion.multiplierBps > BASIS_POINTS) {
        throw new Error(`${model.sku}.promotion.multiplierBps cannot exceed ${BASIS_POINTS}.`);
      }
    }

    const routeIds = new Set<string>();
    for (const route of model.routes) {
      requireNonEmpty(route.id, `${model.sku}.route.id`);
      if (routeIds.has(route.id)) throw new Error(`Duplicate route id ${route.id} for ${model.sku}.`);
      routeIds.add(route.id);
      if (!providerIds.has(route.providerId)) throw new Error(`Unknown provider ${route.providerId} for ${model.sku}.`);
      requireNonNegativeInteger(route.priority, `${model.sku}.${route.id}.priority`);
    }

    if (model.status === "published" && !model.routes.some((route) => route.enabled)) {
      throw new Error(`Published model ${model.sku} requires an enabled route.`);
    }
  }
}

export function requireSuperAdmin(role: RenWorkActorRole): void {
  if (role !== "super_admin") throw new Error("super_admin role required.");
}

export function modelAllowedForPlan(model: Pick<RenWorkAdminModel, "allowedPlanIds">, planId: string): boolean {
  const allowedPlans = new Set(model.allowedPlanIds);
  if (allowedPlans.size === 0 || allowedPlans.has(planId)) return true;
  if ((planId === "free" || planId === "team") && allowedPlans.has("individual")) return true;
  return false;
}

export function toPublicModelCatalog(catalog: RenWorkAdminModelCatalog, now = new Date()): RenWorkPublicModelCatalog {
  validateAdminModelCatalog(catalog);
  const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]));

  const models = catalog.models
    .filter((model) => model.status === "published")
    .filter((model) => model.routes.some((route) => {
      const provider = providers.get(route.providerId);
      return route.enabled && provider?.enabled && provider.health !== "offline";
    }))
    .sort((left, right) => {
      const tierDifference = (TIER_ORDER.get(left.tier) ?? 0) - (TIER_ORDER.get(right.tier) ?? 0);
      return tierDifference || left.sortOrder - right.sortOrder || left.displayName.localeCompare(right.displayName);
    })
    .map((model) => {
      const promotionActive = promotionIsActive(model.promotion, now);
      const activeRoute = model.routes
        .filter((route) => route.enabled)
        .filter((route) => {
          const provider = providers.get(route.providerId);
          return provider?.enabled && provider.health !== "offline";
        })
        .sort((left, right) => left.priority - right.priority)[0];
      return {
        sku: model.sku,
        providerID: "renwork" as const,
        modelID: model.sku,
        displayName: model.displayName,
        description: model.description,
        tier: model.tier,
        autoEligible: model.autoEligible,
        contextWindow: model.contextWindow,
        tags: [...model.tags],
        displayMultiplierBps: model.displayMultiplierBps,
        effectiveDisplayMultiplierBps: effectiveDisplayMultiplierBps(model, now),
        promotionLabel: promotionActive ? model.promotion?.label ?? null : null,
        promotionEndsAt: promotionActive ? model.promotion?.endsAt ?? null : null,
        billingMode: activeRoute ? catalog.billingPolicy[activeRoute.source] : "token_metered",
        executionLocation: activeRoute?.source === "local" ? "local" as const : "cloud" as const,
      };
    });

  return { version: catalog.version, currency: "REN_CREDIT", models };
}

export function toPublicModelCatalogForPlan(
  catalog: RenWorkAdminModelCatalog,
  planId: string,
  now = new Date(),
): RenWorkPublicModelCatalog {
  return toPublicModelCatalog({
    ...catalog,
    models: catalog.models.filter((model) => modelAllowedForPlan(model, planId)),
  }, now);
}

export function findPublishedAdminModel(catalog: RenWorkAdminModelCatalog, sku: string): RenWorkAdminModel {
  validateAdminModelCatalog(catalog);
  const model = catalog.models.find((candidate) => candidate.sku === sku && candidate.status === "published");
  if (!model) throw new Error(`Published model not found: ${sku}`);
  return model;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isModelTier(value: unknown): value is RenWorkModelTier {
  return typeof value === "string" && RENWORK_MODEL_TIERS.some((tier) => tier === value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return [...value];
}

function parsePublicModel(value: unknown): RenWorkPublicModel | null {
  if (!record(value)) return null;
  const tags = stringArray(value.tags);
  if (
    typeof value.sku !== "string"
    || value.providerID !== "renwork"
    || typeof value.modelID !== "string"
    || typeof value.displayName !== "string"
    || typeof value.description !== "string"
    || !isModelTier(value.tier)
    || typeof value.autoEligible !== "boolean"
    || !(value.contextWindow === null || (typeof value.contextWindow === "number" && Number.isSafeInteger(value.contextWindow)))
    || !tags
    || typeof value.displayMultiplierBps !== "number"
    || !Number.isSafeInteger(value.displayMultiplierBps)
    || typeof value.effectiveDisplayMultiplierBps !== "number"
    || !Number.isSafeInteger(value.effectiveDisplayMultiplierBps)
    || !(value.promotionLabel === null || typeof value.promotionLabel === "string")
    || !(value.promotionEndsAt === null || typeof value.promotionEndsAt === "string")
    || !(value.billingMode === "token_metered" || value.billingMode === "free")
    || !(value.executionLocation === "cloud" || value.executionLocation === "local")
  ) return null;
  return {
    sku: value.sku,
    providerID: "renwork",
    modelID: value.modelID,
    displayName: value.displayName,
    description: value.description,
    tier: value.tier,
    autoEligible: value.autoEligible,
    contextWindow: value.contextWindow,
    tags,
    displayMultiplierBps: value.displayMultiplierBps,
    effectiveDisplayMultiplierBps: value.effectiveDisplayMultiplierBps,
    promotionLabel: value.promotionLabel,
    promotionEndsAt: value.promotionEndsAt,
    billingMode: value.billingMode,
    executionLocation: value.executionLocation,
  };
}

export function parsePublicModelCatalog(value: unknown): RenWorkPublicModelCatalog | null {
  if (!record(value) || typeof value.version !== "string" || value.currency !== "REN_CREDIT" || !Array.isArray(value.models)) {
    return null;
  }
  const models = value.models.map(parsePublicModel);
  if (models.some((model) => model === null)) return null;
  return {
    version: value.version,
    currency: "REN_CREDIT",
    models: models.flatMap((model) => model ? [model] : []),
  };
}
