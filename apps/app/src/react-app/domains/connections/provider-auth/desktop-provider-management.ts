export function canManageDesktopModelProviders(input: {
  signedIn: boolean;
  hasAuthToken: boolean;
  hasActiveOrganization: boolean;
  workspaceType: string | null | undefined;
}) {
  return input.workspaceType === "local"
    && !input.signedIn
    && !input.hasAuthToken
    && !input.hasActiveOrganization;
}
