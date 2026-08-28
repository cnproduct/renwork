export const REN_CREDIT_MICRO_UNITS = 1_000_000;
export const RATE_PER_TOKENS = 1_000_000;
export const BASIS_POINTS = 10_000;

export const RENWORK_MODEL_TIERS = ["auto", "standard", "professional", "ultimate"] as const;
export type RenWorkModelTier = (typeof RENWORK_MODEL_TIERS)[number];

export const RENWORK_PROVIDER_KINDS = ["direct", "relay", "runtime", "custom", "byok", "local"] as const;
export type RenWorkProviderKind = (typeof RENWORK_PROVIDER_KINDS)[number];

export const RENWORK_PROVIDER_PROTOCOLS = [
  "openai_compatible",
  "anthropic_compatible",
  "gemini",
  "opencode",
  "local",
] as const;
export type RenWorkProviderProtocol = (typeof RENWORK_PROVIDER_PROTOCOLS)[number];

export const RENWORK_ROUTE_SOURCES = ["official", "byok", "local"] as const;
export type RenWorkRouteSource = (typeof RENWORK_ROUTE_SOURCES)[number];

export const RENWORK_BILLING_MODES = ["token_metered", "free"] as const;
export type RenWorkBillingMode = (typeof RENWORK_BILLING_MODES)[number];

export type RenWorkSourceBillingPolicy = Record<RenWorkRouteSource, RenWorkBillingMode>;

export type RenWorkActorRole = "super_admin" | "tenant_admin" | "member";
export type RenWorkCatalogStatus = "draft" | "active" | "retired";
export type RenWorkModelStatus = "draft" | "published" | "paused" | "retired";

export interface RenWorkTokenUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface RenWorkTokenRateCard {
  inputMicroCreditsPerMillion: number;
  outputMicroCreditsPerMillion: number;
  reasoningMicroCreditsPerMillion: number;
  cacheReadMicroCreditsPerMillion: number;
  cacheWriteMicroCreditsPerMillion: number;
}

export interface RenWorkAdminProvider {
  id: string;
  displayName: string;
  kind: RenWorkProviderKind;
  protocol: RenWorkProviderProtocol;
  baseUrl: string | null;
  credentialRef: string | null;
  enabled: boolean;
  health: "unknown" | "healthy" | "degraded" | "offline";
}

export interface RenWorkAdminModelRoute {
  id: string;
  providerId: string;
  upstreamModelId: string;
  priority: number;
  enabled: boolean;
  source: RenWorkRouteSource;
}

export interface RenWorkModelPromotion {
  label: string;
  multiplierBps: number;
  startsAt: string;
  endsAt: string;
}

export interface RenWorkAdminModel {
  sku: string;
  displayName: string;
  description: string;
  tier: RenWorkModelTier;
  status: RenWorkModelStatus;
  autoEligible: boolean;
  contextWindow: number | null;
  tags: string[];
  sortOrder: number;
  displayMultiplierBps: number;
  priceMultiplierBps: number;
  rates: RenWorkTokenRateCard;
  promotion: RenWorkModelPromotion | null;
  allowedPlanIds: string[];
  routes: RenWorkAdminModelRoute[];
}

export interface RenWorkAdminModelCatalog {
  version: string;
  status: RenWorkCatalogStatus;
  currency: "REN_CREDIT";
  billingPolicy: RenWorkSourceBillingPolicy;
  updatedAt: string;
  providers: RenWorkAdminProvider[];
  models: RenWorkAdminModel[];
}

export interface RenWorkPublicModel {
  sku: string;
  providerID: "renwork";
  modelID: string;
  displayName: string;
  description: string;
  tier: RenWorkModelTier;
  autoEligible: boolean;
  contextWindow: number | null;
  tags: string[];
  displayMultiplierBps: number;
  effectiveDisplayMultiplierBps: number;
  promotionLabel: string | null;
  promotionEndsAt: string | null;
  billingMode: RenWorkBillingMode;
}

export interface RenWorkPublicModelCatalog {
  version: string;
  currency: "REN_CREDIT";
  models: RenWorkPublicModel[];
}

export interface RenWorkTokenQuote {
  id: string;
  catalogVersion: string;
  modelSku: string;
  estimatedUsage: RenWorkTokenUsage;
  reservedMicroCredits: number;
  billingMode: RenWorkBillingMode;
  expiresAt: string;
}

export interface RenWorkTokenReservation {
  id: string;
  quoteId: string;
  tenantId: string;
  userId: string;
  modelSku: string;
  catalogVersion: string;
  reservedMicroCredits: number;
  status: "reserved" | "captured" | "released";
  createdAt: string;
}

export interface RenWorkTokenUsageEvent {
  id: string;
  runId: string;
  modelSku: string;
  routeId: string;
  providerResponseId: string;
  usage: RenWorkTokenUsage;
  measuredAt: string;
  accuracy: "reported" | "estimated";
}

export interface RenWorkTokenReceipt {
  id: string;
  reservationId: string;
  runId: string;
  tenantId: string;
  userId: string;
  modelSku: string;
  catalogVersion: string;
  usage: RenWorkTokenUsage;
  capturedMicroCredits: number;
  releasedMicroCredits: number;
  eventCount: number;
  createdAt: string;
}
