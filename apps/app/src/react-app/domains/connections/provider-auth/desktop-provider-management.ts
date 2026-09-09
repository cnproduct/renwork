export function canManageDesktopModelProviders(input: {
  signedIn: boolean;
  hasAuthToken: boolean;
  hasActiveOrganization: boolean;
  workspaceType: string | null | undefined;
}) {
  void input;
  return false;
}

export function canConnectPersonalSubscriptionOAuth(input: {
  desktopRuntime: boolean;
  signedIn: boolean;
  hasAuthToken: boolean;
  hasActiveOrganization: boolean;
  hasActiveRuntime: boolean;
  hasPlatformGrantedModel: boolean;
  workspaceType: string | null | undefined;
}) {
  return (
    input.desktopRuntime &&
    input.signedIn &&
    input.hasAuthToken &&
    input.hasActiveOrganization &&
    input.hasActiveRuntime &&
    input.hasPlatformGrantedModel &&
    input.workspaceType !== "remote"
  );
}

export function hasPlatformGrantedPersonalSubscriptionModel(
  providers: ReadonlyArray<{
    providerId: string;
    source: string;
    models: ReadonlyArray<{ id: string }>;
  }>,
): boolean {
  return providers.some(
    (provider) =>
      provider.providerId === "renwork" &&
      provider.source === "openwork" &&
      provider.models.some(
        (model) =>
          model.id === "renwork-codex" ||
          model.id.startsWith("renwork-openai-") ||
          model.id.startsWith("renwork-google-"),
      ),
  );
}
