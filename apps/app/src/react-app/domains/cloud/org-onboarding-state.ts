export type OrgOnboardingSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type OrgOnboardingInitialSelectionState = {
  hasSelectedOrganization: boolean;
  autoContinueResources: boolean;
};

export function initialOrgOnboardingSelectionState(): OrgOnboardingInitialSelectionState {
  return {
    hasSelectedOrganization: false,
    autoContinueResources: false,
  };
}

export type OrgOnboardingPostListStep =
  | { kind: "no-org" }
  | { kind: "auto-select-single-org"; organization: OrgOnboardingSummary }
  | { kind: "choose-org"; defaultOrganization: OrgOnboardingSummary }
  | { kind: "resources"; autoContinue: boolean };

export function resolveOrgOnboardingPostListStep({
  orgs,
  activeOrgId,
  hasSelectedOrganization,
  autoContinueResources,
  autoSelectFailedOrgId,
}: {
  orgs: OrgOnboardingSummary[];
  activeOrgId: string;
  hasSelectedOrganization: boolean;
  autoContinueResources: boolean;
  autoSelectFailedOrgId: string | null;
}): OrgOnboardingPostListStep {
  if (orgs.length === 0) {
    return { kind: "no-org" };
  }

  const singleOrg = orgs.length === 1 ? orgs[0] : null;

  if (!hasSelectedOrganization) {
    if (singleOrg && autoSelectFailedOrgId !== singleOrg.id) {
      return { kind: "auto-select-single-org", organization: singleOrg };
    }

    return {
      kind: "choose-org",
      defaultOrganization: orgs.find((org) => org.id === activeOrgId) ?? orgs[0],
    };
  }

  return {
    kind: "resources",
    autoContinue: autoContinueResources || orgs.length === 1,
  };
}
