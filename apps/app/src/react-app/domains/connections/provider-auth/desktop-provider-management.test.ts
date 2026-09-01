declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
};

import {
  canConnectPersonalSubscriptionOAuth,
  canManageDesktopModelProviders,
} from "./desktop-provider-management";
import { isPersonalSubscriptionOAuthProvider } from "./store";

describe("desktop provider management", () => {
  test("keeps every signed-in organization role read-only in the desktop app", () => {
    expect(canManageDesktopModelProviders({
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      workspaceType: "local",
    })).toBe(false);
  });

  test("allows OAuth-only personal subscriptions on a signed-in local desktop", () => {
    expect(canConnectPersonalSubscriptionOAuth({
      desktopRuntime: true,
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      hasActiveRuntime: true,
      workspaceType: "local",
    })).toBe(true);
  });

  test("does not expose personal subscription OAuth to web, remote, or signed-out contexts", () => {
    expect(canConnectPersonalSubscriptionOAuth({
      desktopRuntime: false,
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      hasActiveRuntime: true,
      workspaceType: "local",
    })).toBe(false);
    expect(canConnectPersonalSubscriptionOAuth({
      desktopRuntime: true,
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      hasActiveRuntime: true,
      workspaceType: "remote",
    })).toBe(false);
    expect(canConnectPersonalSubscriptionOAuth({
      desktopRuntime: true,
      signedIn: false,
      hasAuthToken: false,
      hasActiveOrganization: false,
      hasActiveRuntime: true,
      workspaceType: "local",
    })).toBe(false);
    expect(canConnectPersonalSubscriptionOAuth({
      desktopRuntime: true,
      signedIn: true,
      hasAuthToken: true,
      hasActiveOrganization: true,
      hasActiveRuntime: false,
      workspaceType: "local",
    })).toBe(false);
  });

  test("limits personal subscription OAuth to the approved local adapters", () => {
    expect(isPersonalSubscriptionOAuthProvider("openai")).toBe(true);
    expect(isPersonalSubscriptionOAuthProvider(" Google ")).toBe(true);
    expect(isPersonalSubscriptionOAuthProvider("openrouter")).toBe(false);
    expect(isPersonalSubscriptionOAuthProvider("ollama")).toBe(false);
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
