import { afterEach, describe, expect, test } from "bun:test";

import { canCreateWorkspaces } from "../src/app/lib/workspace-creation-policy";

const originalWindow = globalThis.window;

function installWindow(options: {
  origin: string;
  gateway?: boolean;
  electronInfo?: {
    baseUrl: string;
    ownerToken: string;
    cloudOnly?: boolean;
  };
}) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { origin: options.origin },
      __OPENWORK_GATEWAY__: options.gateway ? { version: 1 } : undefined,
      __OPENWORK_ELECTRON__: options.electronInfo
        ? {
            meta: {
              distribution: {
                flavor: options.electronInfo.cloudOnly ? "server2016-cloud" : "public",
                appName: options.electronInfo.cloudOnly ? "RenWork Server 2016 Cloud" : "RenWork",
                appIdentifier: options.electronInfo.cloudOnly
                  ? "com.renrenyi.renwork.server2016cloud"
                  : "com.renrenyi.renwork",
                protocolScheme: options.electronInfo.cloudOnly ? "renwork-server2016" : "renwork",
                requireSignin: options.electronInfo.cloudOnly,
                requireActivation: false,
                localRuntimeEnabled: !options.electronInfo.cloudOnly,
                cloudWorkspaceRequired: Boolean(options.electronInfo.cloudOnly),
                updaterManifestChannel: options.electronInfo.cloudOnly ? "server2016-cloud" : "latest",
              },
            },
            invokeDesktop: async () => ({
              running: true,
              baseUrl: options.electronInfo?.baseUrl,
              ownerToken: options.electronInfo?.ownerToken,
            }),
          }
        : undefined,
    },
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("workspace creation policy", () => {
  test("disables workspace creation in gateway runtime", () => {
    installWindow({ origin: "https://web.openworklabs.com", gateway: true });
    expect(canCreateWorkspaces()).toBe(false);
  });

  test("allows workspace creation in plain web runtime", () => {
    installWindow({ origin: "https://self-hosted.example" });
    expect(canCreateWorkspaces()).toBe(true);
  });

  test("allows workspace creation in desktop runtime", () => {
    installWindow({
      origin: "http://localhost:3000",
      electronInfo: { baseUrl: "http://localhost:8787", ownerToken: "owner-token" },
    });
    expect(canCreateWorkspaces()).toBe(true);
  });

  test("disables local workspace creation in the Server 2016 cloud-only desktop", () => {
    installWindow({
      origin: "http://localhost:3000",
      electronInfo: {
        baseUrl: "http://localhost:8787",
        ownerToken: "owner-token",
        cloudOnly: true,
      },
    });
    expect(canCreateWorkspaces()).toBe(false);
  });
});
