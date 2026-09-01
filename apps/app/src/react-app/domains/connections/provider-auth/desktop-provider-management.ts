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
  workspaceType: string | null | undefined;
}) {
  return (
    input.desktopRuntime &&
    input.signedIn &&
    input.hasAuthToken &&
    input.hasActiveOrganization &&
    input.hasActiveRuntime &&
    input.workspaceType !== "remote"
  );
}
