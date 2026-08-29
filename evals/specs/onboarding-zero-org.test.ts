import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { resolveOrgOnboardingPostListStep } from "../../apps/app/src/react-app/domains/cloud/org-onboarding-state";

test("a signed-in account with no organization cannot enter an endless resource-loading state", async ({ evidence }) => {
  const step = resolveOrgOnboardingPostListStep({
    orgs: [],
    activeOrgId: "",
    hasSelectedOrganization: false,
    autoContinueResources: false,
    autoSelectFailedOrgId: null,
  });

  expect(step).toEqual({ kind: "no-org" });
  evidence.fact(
    "A new account with zero organizations receives a recovery step",
    "The onboarding resolver returns no-org instead of entering the resource-loading state without a tenant.",
    true,
  );
});

test("a signed-in account with one organization still selects it before loading resources", async ({ evidence }) => {
  const organization = {
    id: "organization_01",
    name: "RenWork Test",
    slug: "renwork-test",
    role: "owner",
  };
  const step = resolveOrgOnboardingPostListStep({
    orgs: [organization],
    activeOrgId: "",
    hasSelectedOrganization: false,
    autoContinueResources: false,
    autoSelectFailedOrgId: null,
  });

  expect(step).toEqual({ kind: "auto-select-single-org", organization });
  evidence.fact(
    "Existing single-organization onboarding keeps its automatic selection",
    "The zero-organization recovery does not bypass or alter the existing tenant selection contract.",
    true,
  );
});
