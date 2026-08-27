#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import { verifyRendererBundle } from "./verify-renderer-bundle.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}${detail ? `:\n${detail}` : ""}`);
  }
  return result;
}

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function attachDmg(dmgPath) {
  const result = run("hdiutil", ["attach", "-nobrowse", "-readonly", "-plist", dmgPath]);
  const mountPoints = [...result.stdout.matchAll(/<key>mount-point<\/key>\s*<string>(.*?)<\/string>/gs)]
    .map((match) => decodeXml(match[1]));
  const mountPoint = mountPoints.at(-1);
  if (!mountPoint) throw new Error(`Unable to determine mount point for ${dmgPath}`);
  return mountPoint;
}

function findApp(root) {
  const apps = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
    .map((entry) => path.join(root, entry.name));
  if (apps.length !== 1) {
    throw new Error(`Expected exactly one .app in ${root}; found ${apps.length}`);
  }
  return apps[0];
}

function signatureDetails(appPath) {
  const result = run("codesign", ["--display", "--verbose=4", appPath]);
  return `${result.stdout}\n${result.stderr}`;
}

async function verifyApp(appPath, { allowAdhoc }) {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  const details = signatureDetails(appPath);
  const isAdhoc = details.includes("Signature=adhoc");
  const teamMatch = details.match(/^TeamIdentifier=(.+)$/m);
  const teamIdentifier = teamMatch?.[1]?.trim() ?? "";

  if (!allowAdhoc) {
    if (isAdhoc || !details.includes("Authority=Developer ID Application:")) {
      throw new Error("Release app is not signed with a Developer ID Application certificate.");
    }
    if (!teamIdentifier || teamIdentifier === "not set") {
      throw new Error("Release app signature has no Apple TeamIdentifier.");
    }
    run("xcrun", ["stapler", "validate", appPath]);
    run("spctl", ["--assess", "--type", "execute", "--verbose=4", appPath]);
  }

  const resourcesDir = path.join(appPath, "Contents", "Resources");
  const renderer = await verifyRendererBundle(path.join(resourcesDir, "app-dist"));
  const helperPath = path.join(resourcesDir, "helpers", "RenWork Computer Use.app");
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", helperPath]);

  return {
    ok: true,
    appPath,
    signature: isAdhoc ? "adhoc" : "developer-id",
    teamIdentifier: teamIdentifier || null,
    rendererResources: renderer.resources,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const allowAdhoc = args.includes("--allow-adhoc");
  const artifactArg = args.find((arg) => !arg.startsWith("--"));
  if (!artifactArg) {
    throw new Error("Usage: verify-macos-artifact.mjs [--allow-adhoc] <RenWork.app|RenWork.dmg>");
  }

  const artifactPath = path.resolve(artifactArg);
  let mountPoint = null;
  try {
    const appPath = artifactPath.endsWith(".dmg")
      ? findApp((mountPoint = attachDmg(artifactPath)))
      : artifactPath;
    const result = await verifyApp(appPath, { allowAdhoc });
    process.stdout.write(`${JSON.stringify({ ...result, artifactPath }, null, 2)}\n`);
  } finally {
    if (mountPoint) {
      run("hdiutil", ["detach", mountPoint]);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
