import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLOUD_DESKTOP_DISTRIBUTION,
  ENTERPRISE_DESKTOP_DISTRIBUTION,
  PUBLIC_DESKTOP_DISTRIBUTION,
  SERVER_2016_CLOUD_DESKTOP_DISTRIBUTION,
  desktopActivationRequired,
  enterpriseActivationComplete,
  enterprisePreactivationCommandAllowed,
  resolveDesktopDistribution,
} from "./desktop-distribution.mjs";

describe("resolveDesktopDistribution", () => {
  it("defines a Cloud build that requires sign-in without enterprise activation", () => {
    assert.deepEqual(
      resolveDesktopDistribution({
        isPackaged: true,
        packageFlavor: "cloud",
        environmentFlavor: "enterprise",
      }),
      {
        flavor: "cloud",
        appName: "RenWork Cloud",
        appIdentifier: "com.renrenyi.renwork",
        protocolScheme: "renwork",
        requireSignin: true,
        requireActivation: false,
        localRuntimeEnabled: true,
        cloudWorkspaceRequired: false,
        updaterManifestChannel: "cloud",
      },
    );
  });

  it("uses immutable package metadata for packaged enterprise builds", () => {
    const distribution = resolveDesktopDistribution({
      isPackaged: true,
      packageFlavor: "enterprise",
      environmentFlavor: "public",
    });

    assert.deepEqual(distribution, {
      flavor: "enterprise",
      appName: "RenWork Enterprise",
      appIdentifier: "com.renrenyi.renwork",
      protocolScheme: "renwork",
      requireSignin: true,
      requireActivation: true,
      localRuntimeEnabled: true,
      cloudWorkspaceRequired: false,
      updaterManifestChannel: "enterprise",
    });
  });

  it("defines an immutable Server 2016 cloud-only build", () => {
    assert.deepEqual(
      resolveDesktopDistribution({
        isPackaged: true,
        packageFlavor: "server2016-cloud",
        environmentFlavor: "public",
      }),
      SERVER_2016_CLOUD_DESKTOP_DISTRIBUTION,
    );
    assert.equal(SERVER_2016_CLOUD_DESKTOP_DISTRIBUTION.localRuntimeEnabled, false);
    assert.equal(SERVER_2016_CLOUD_DESKTOP_DISTRIBUTION.cloudWorkspaceRequired, true);
    assert.equal(SERVER_2016_CLOUD_DESKTOP_DISTRIBUTION.updaterManifestChannel, "server2016-cloud");
  });

  it("does not let an environment variable turn a packaged public build into enterprise", () => {
    const distribution = resolveDesktopDistribution({
        isPackaged: true,
        packageFlavor: "public",
        environmentFlavor: "enterprise",
      });
    assert.equal(distribution.flavor, "public");
    assert.equal(distribution.requireSignin, true);
  });

  it("allows development runs to exercise the enterprise flavor", () => {
    assert.equal(
      resolveDesktopDistribution({
        isPackaged: false,
        packageFlavor: "public",
        environmentFlavor: "enterprise",
      }).flavor,
      "enterprise",
    );
  });
});

describe("desktopActivationRequired", () => {
  it("uses the distribution default when bootstrap policy is absent", () => {
    assert.equal(desktopActivationRequired(ENTERPRISE_DESKTOP_DISTRIBUTION, {}), true);
    assert.equal(desktopActivationRequired(CLOUD_DESKTOP_DISTRIBUTION, {}), false);
    assert.equal(desktopActivationRequired(PUBLIC_DESKTOP_DISTRIBUTION, {}), false);
  });

  it("keeps the Enterprise artifact authoritative over bootstrap opt-out", () => {
    assert.equal(desktopActivationRequired(
      ENTERPRISE_DESKTOP_DISTRIBUTION,
      { requireActivation: false },
    ), true);
  });

  it("accepts completed activation from the Enterprise bootstrap file", () => {
    assert.equal(desktopActivationRequired(
      ENTERPRISE_DESKTOP_DISTRIBUTION,
      {
        requireActivation: false,
        enterpriseActivation: {
          activatedAt: "2026-07-27T10:00:00.000Z",
          denBaseUrl: "https://enterprise.example.com",
        },
      },
    ), false);
  });

  it("allows desktop-bootstrap.json to enable activation for other distributions", () => {
    assert.equal(desktopActivationRequired(
      PUBLIC_DESKTOP_DISTRIBUTION,
      { requireActivation: true },
    ), true);
  });
});

describe("enterpriseActivationComplete", () => {
  it("requires a persisted activation timestamp and Den URL", () => {
    assert.equal(enterpriseActivationComplete(null), false);
    assert.equal(enterpriseActivationComplete({ enterpriseActivation: {} }), false);
    assert.equal(enterpriseActivationComplete({
      enterpriseActivation: {
        activatedAt: "2026-07-27T10:00:00.000Z",
        denBaseUrl: "https://app.openworklabs.com",
      },
    }), true);
  });
});

describe("enterprisePreactivationCommandAllowed", () => {
  it("allows only activation, bootstrap, build metadata, and the Den exchange fetch bridge", () => {
    assert.equal(enterprisePreactivationCommandAllowed("__fetch"), true);
    assert.equal(enterprisePreactivationCommandAllowed("connectLinkAccept"), true);
    assert.equal(enterprisePreactivationCommandAllowed("connectLinkVerify"), true);
    assert.equal(enterprisePreactivationCommandAllowed("getDesktopBootstrapConfig"), true);
    assert.equal(enterprisePreactivationCommandAllowed("setDesktopBootstrapConfig"), true);
    assert.equal(enterprisePreactivationCommandAllowed("appBuildInfo"), true);
    assert.equal(enterprisePreactivationCommandAllowed("engineInfo"), false);
    assert.equal(enterprisePreactivationCommandAllowed("runtimeBootstrap"), false);
    assert.equal(enterprisePreactivationCommandAllowed("terminalCreate"), false);
  });
});
