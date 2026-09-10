export type OrganizationModelsEmptyInput = {
  workspaceReady: boolean;
  loading: boolean;
  restrictToCloud: boolean;
  cloudProviderSyncReady: boolean;
  entitledModelCount: number;
};

export function isOrganizationModelsEmpty(input: OrganizationModelsEmptyInput) {
  return (
    input.workspaceReady &&
    !input.loading &&
    input.restrictToCloud &&
    input.cloudProviderSyncReady &&
    input.entitledModelCount === 0
  );
}

export type ManagedModelAvailabilityPendingInput = {
  signedIn: boolean;
  selectedModelUsesCloudProvider: boolean;
  cloudProviderSyncReady: boolean;
  openWorkModelsSyncing: boolean;
};

/** A cloud model can temporarily disappear while its provider is being reconciled. */
export function isManagedModelAvailabilityPending(
  input: ManagedModelAvailabilityPendingInput,
) {
  return (
    input.signedIn &&
    input.selectedModelUsesCloudProvider &&
    (!input.cloudProviderSyncReady || input.openWorkModelsSyncing)
  );
}

export type UnavailableModelPickerAutoOpenInput = {
  selectedModelUnavailableKey: string | null;
  signedIn: boolean;
  cloudProviderSyncReady: boolean;
  entitledOrgDefaultModel: boolean;
  organizationModelsEmpty: boolean;
  autoOpenedUnavailableModelKey: string | null;
};

export function shouldAutoOpenUnavailableModelPicker(
  input: UnavailableModelPickerAutoOpenInput,
) {
  if (!input.selectedModelUnavailableKey) return false;
  if (input.signedIn && !input.cloudProviderSyncReady) return false;
  if (input.entitledOrgDefaultModel) return false;
  if (input.organizationModelsEmpty) return false;
  return input.autoOpenedUnavailableModelKey !== input.selectedModelUnavailableKey;
}

export type CloudProviderSyncReadyInput = {
  signedIn: boolean;
  clientConnected: boolean;
  workspaceId: string | null | undefined;
  activeOrgId: string | null | undefined;
  cloudProviderSyncReady: boolean;
};

export function shouldWaitForCloudProviderSyncBeforePolicyReconcile(
  input: CloudProviderSyncReadyInput,
) {
  return (
    input.signedIn &&
    input.clientConnected &&
    Boolean(input.workspaceId?.trim()) &&
    Boolean(input.activeOrgId?.trim()) &&
    !input.cloudProviderSyncReady
  );
}

export type OrganizationModelsRefreshInput<T> = {
  runCloudProviderSync: (reason: OrganizationModelsRefreshReason) => Promise<unknown>;
  refreshProviders: () => Promise<T> | T;
};

export type OrganizationModelsRefreshReason =
  | "sign_in"
  | "app_launch"
  | "app_resume"
  | "model_picker_open"
  | "new_chat"
  | "manual";

export type ManagedModelEntitlement = {
  providerID: string;
  modelID: string;
  disabled?: boolean;
};

/** Add catalog-backed personal OAuth SKUs without duplicating runtime models. */
export function mergeManagedModelEntitlements<T extends ManagedModelEntitlement>(
  primary: readonly T[],
  additions: readonly T[],
): T[] {
  const merged = new Map<string, T>();
  for (const option of additions) merged.set(`${option.providerID}:${option.modelID}`, option);
  for (const option of primary) merged.set(`${option.providerID}:${option.modelID}`, option);
  return [...merged.values()];
}

export async function refreshOrganizationModels<T>(
  input: OrganizationModelsRefreshInput<T>,
  reason: OrganizationModelsRefreshReason = "manual",
): Promise<T> {
  const result = await input.runCloudProviderSync(reason);
  if (
    result &&
    typeof result === "object" &&
    "outcome" in result &&
    result.outcome === "failed"
  ) {
    const message = "message" in result && typeof result.message === "string"
      ? result.message
      : "RenWork provider sync failed.";
    throw new Error(message);
  }
  return input.refreshProviders();
}
