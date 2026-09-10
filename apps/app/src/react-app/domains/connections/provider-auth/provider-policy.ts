import {
  isDesktopProviderBlocked,
  type DesktopAppRestrictionChecker,
} from "@/app/cloud/desktop-app-restrictions";
import type { ModelOption, ModelRef } from "@/app/types";
import { isCloudManagedProviderKey } from "./cloud-provider-config";

export type ProviderDesktopPolicyInput = {
  providerId: string;
  restrictToCloud: boolean;
  checkRestriction: DesktopAppRestrictionChecker;
};

export type ProviderAddRestrictionInput = {
  providerId?: string | null;
  checkRestriction: DesktopAppRestrictionChecker;
};

export type FilterEntitledModelOptionsInput = {
  restrictToCloud: boolean;
  checkRestriction: DesktopAppRestrictionChecker;
};

export type ModelEntitlementOption = Pick<ModelOption, "providerID" | "modelID"> & {
  disabled?: boolean;
};

const RENWORK_AUTO_MODEL_ID = "renwork-auto";

function sameModel(left: ModelRef | null | undefined, right: ModelRef | null | undefined) {
  return Boolean(
    left &&
      right &&
      left.providerID === right.providerID &&
      left.modelID === right.modelID,
  );
}

function preferredEntitledModel(options: readonly ModelEntitlementOption[]): ModelRef | null {
  const replacement =
    options.find(
      (option) =>
        isCloudManagedProviderKey(option.providerID) &&
        option.modelID === RENWORK_AUTO_MODEL_ID,
    ) ?? options.find((option) => isCloudManagedProviderKey(option.providerID));
  return replacement
    ? { providerID: replacement.providerID, modelID: replacement.modelID }
    : null;
}

export function isProviderAllowedByDesktopPolicy(input: ProviderDesktopPolicyInput) {
  const providerId = input.providerId.trim();
  if (!providerId) return false;

  if (
    isDesktopProviderBlocked({
      providerId,
      checkRestriction: input.checkRestriction,
    })
  ) {
    return false;
  }

  if (!input.restrictToCloud) return true;
  return isCloudManagedProviderKey(providerId);
}

export function isProviderAddRestrictedByDesktopPolicy(input: ProviderAddRestrictionInput) {
  const restrictToCloud = input.checkRestriction({ restriction: "allowCustomProviders" });
  if (!restrictToCloud) return false;

  const providerId = input.providerId?.trim() ?? "";
  if (!providerId) return true;

  return !isProviderAllowedByDesktopPolicy({
    providerId,
    restrictToCloud,
    checkRestriction: input.checkRestriction,
  });
}

export function filterEntitledModelOptions<T extends Pick<ModelOption, "providerID"> & { disabled?: boolean }>(
  options: readonly T[],
  input: FilterEntitledModelOptionsInput,
): T[] {
  return options.filter((option) => {
    if (option.disabled) return false;
    return isProviderAllowedByDesktopPolicy({
      providerId: option.providerID,
      restrictToCloud: input.restrictToCloud,
      checkRestriction: input.checkRestriction,
    });
  });
}

export function resolveEntitledOrgDefaultModel(
  options: readonly ModelEntitlementOption[],
  input: FilterEntitledModelOptionsInput & { currentDefault: ModelRef | null },
): ModelRef | null {
  const entitled = filterEntitledModelOptions(options, input);
  if (
    input.currentDefault &&
    entitled.some(
      (option) =>
        option.providerID === input.currentDefault?.providerID &&
        option.modelID === input.currentDefault.modelID,
    )
  ) {
    return null;
  }

  return preferredEntitledModel(entitled);
}

/**
 * Resolve an immediately sendable model for a remembered conversation.
 *
 * Session model memory predates organization-scoped catalogs. A removed SKU
 * can therefore outlive a catalog refresh and keep every retry pinned to a
 * model the active organization can no longer use. Prefer the current request
 * while it is still entitled, otherwise fall back to the entitled global
 * default, then RenWork Auto (or the first managed RenWork model).
 */
export function resolveEntitledSessionModel(
  options: readonly ModelEntitlementOption[],
  input: { requested: ModelRef | null; currentDefault: ModelRef | null },
): ModelRef | null {
  const entitled = options.filter(
    (option) => !option.disabled && isCloudManagedProviderKey(option.providerID),
  );
  const contains = (model: ModelRef | null) =>
    Boolean(model && entitled.some((option) => sameModel(option, model)));

  if (contains(input.requested)) return input.requested;
  if (contains(input.currentDefault)) return input.currentDefault;
  return preferredEntitledModel(entitled);
}
