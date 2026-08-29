declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
};

import { canManageDesktopModelProviders } from "./desktop-provider-management";

describe("desktop provider management", () => {
  test("keeps every signed-in organization role read-only in the desktop app", () => {
    expect(canManageDesktopModelProviders({
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      workspaceType: "local",
    })).toBe(false);
  });

  test("does not flash provider controls while a cached cloud session restores", () => {
    expect(canManageDesktopModelProviders({
      signedIn: false,
      hasAuthToken: true,
      hasActiveOrganization: true,
      workspaceType: "local",
    })).toBe(false);
  });

  test("does not allow an independent local profile to bypass subscription model policy", () => {
    expect(canManageDesktopModelProviders({
      signedIn: false,
      hasAuthToken: false,
      hasActiveOrganization: false,
      workspaceType: "local",
    })).toBe(false);
    expect(canManageDesktopModelProviders({
      signedIn: false,
      hasAuthToken: false,
      hasActiveOrganization: false,
      workspaceType: "remote",
    })).toBe(false);
  });
});
