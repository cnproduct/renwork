export function canManageDesktopModelProviders(input: {
  signedIn: boolean;
  hasAuthToken: boolean;
  hasActiveOrganization: boolean;
  workspaceType: string | null | undefined;
}) {
  void input;
  return false;
}
