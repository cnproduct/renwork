import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const dirname = path.dirname(fileURLToPath(import.meta.url));

async function readConfig(name) {
  return YAML.parse(await readFile(path.resolve(dirname, "..", name), "utf8"));
}

describe("Electron distribution configs", () => {
  it("uses a stable Linux desktop identity and ships integration icons", async () => {
    const packageMetadata = JSON.parse(
      await readFile(path.resolve(dirname, "..", "package.json"), "utf8"),
    );
    const config = await readConfig("electron-builder.base.yml");
    assert.equal(packageMetadata.desktopName, "com.renrenyi.renwork");
    assert.equal(config.npmRebuild, false);
    assert.deepEqual(config.files.at(-1), {
      from: ".electron-runtime/node_modules",
      to: "node_modules",
    });
    assert.equal(config.linux.syncDesktopName, true);
    assert.equal(config.linux.icon, "resources/icons/linux");
    assert.deepEqual(config.linux.extraResources[0], {
      from: "resources/icons/linux",
      to: "icons/linux",
      filter: ["*.png"],
    });
  });

  it("uses the RenWork public identity, protocol, and release target", async () => {
    const config = await readConfig("electron-builder.yml");
    assert.equal(config.extends, "./electron-builder.base.yml");
    assert.equal(config.appId, "com.renrenyi.renwork");
    assert.equal(config.productName, "RenWork");
    assert.equal(config.protocols[0].schemes[0], "renwork");
    assert.equal(config.artifactName, "renwork-${os}-${arch}-${version}.${ext}");
    assert.equal(config.publish.owner, "cnproduct");
    assert.equal(config.publish.repo, "renwork");
  });

  it("defines a RenWork-branded enterprise flavor with the compatibility protocol and release provider", async () => {
    const config = await readConfig("electron-builder.enterprise.yml");
    assert.equal(config.extends, "./electron-builder.base.yml");
    assert.equal(config.appId, "com.differentai.openwork");
    assert.equal(config.productName, "RenWork Enterprise");
    assert.equal(config.extraMetadata.openworkDistribution, "enterprise");
    assert.equal(config.protocols[0].schemes[0], "openwork");
    assert.equal(config.publish[0].provider, "github");
    assert.equal(config.publish[0].owner, "different-ai");
    assert.equal(config.publish[0].repo, "openwork");
    assert.equal(config.publish[0].channel, "enterprise");
    assert.equal(
      config.artifactName,
      "renwork-enterprise-${os}-${arch}-${version}.${ext}",
    );
  });

  it("defines a Cloud flavor with its own artifacts and updater channel", async () => {
    const config = await readConfig("electron-builder.cloud.yml");
    assert.equal(config.extends, "./electron-builder.base.yml");
    assert.equal(config.appId, "com.differentai.openwork");
    assert.equal(config.productName, "RenWork Cloud");
    assert.equal(config.extraMetadata.openworkDistribution, "cloud");
    assert.equal(config.protocols[0].schemes[0], "openwork");
    assert.equal(config.publish[0].channel, "cloud");
    assert.equal(
      config.artifactName,
      "renwork-cloud-${os}-${arch}-${version}.${ext}",
    );
  });

  it("defines a sidecar-free Windows Server 2016 cloud-only flavor", async () => {
    const config = await readConfig("electron-builder.server2016-cloud.yml");
    assert.equal(config.extends, "./electron-builder.base.yml");
    assert.equal(config.appId, "com.renrenyi.renwork.server2016cloud");
    assert.equal(config.productName, "RenWork Server 2016 Cloud");
    assert.equal(config.extraMetadata.version, "0.18.58");
    assert.equal(config.extraMetadata.openworkDistribution, "server2016-cloud");
    assert.equal(config.protocols[0].schemes[0], "renwork-server2016");
    assert.equal(config.publish[0].owner, "cnproduct");
    assert.equal(config.publish[0].repo, "renwork");
    assert.equal(config.publish[0].channel, "server2016-cloud");
    assert.equal(config.directories.output, "dist-electron-server2016-cloud");
    assert.deepEqual(config.win.extraResources, [
      { from: "resources/icons/icon.png", to: "icons/icon.png" },
    ]);
    assert.equal(
      config.artifactName,
      "RenWork-v${version}-Windows-Server-2016-Cloud-${arch}.${ext}",
    );
  });
});
