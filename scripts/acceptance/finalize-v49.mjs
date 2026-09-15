#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { REQUIRED_TARGETS, validateFleetEvidence } from "./validate-v49-fleet-evidence.mjs";

const REPO = process.env.RENWORK_V49_REPOSITORY?.trim() || "cnproduct/renwork";
const APPLE_SECRETS = [
  "APPLE_CODESIGN_CERT_P12_BASE64",
  "APPLE_CODESIGN_CERT_PASSWORD",
  "APPLE_NOTARY_API_KEY_P8_BASE64",
  "APPLE_NOTARY_API_KEY_ID",
  "APPLE_NOTARY_API_ISSUER_ID",
];
const AZURE_SETTINGS = [
  "AZURE_CLIENT_ID",
  "AZURE_TENANT_ID",
  "AZURE_SUBSCRIPTION_ID",
  "AZURE_ARTIFACT_SIGNING_ENDPOINT",
  "AZURE_ARTIFACT_SIGNING_ACCOUNT",
  "AZURE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE",
];

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
  });
  return typeof output === "string" ? output.trim() : "";
}

function ghJson(path) {
  return JSON.parse(run("gh", ["api", `repos/${REPO}/${path}`]));
}

function parseArgs(argv) {
  const args = { commit: "", realDenRunId: "", fleetRunId: "", tag: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--commit") args.commit = argv[++index] ?? "";
    else if (token === "--real-den-run") args.realDenRunId = argv[++index] ?? "";
    else if (token === "--fleet-run") args.fleetRunId = argv[++index] ?? "";
    else if (token === "--tag") args.tag = argv[++index] ?? "";
    else fail(`Unknown argument: ${token}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(args.commit)) fail("--commit must be a full 40-character SHA");
  if (!/^\d+$/.test(args.realDenRunId)) fail("--real-den-run must be an Actions run ID");
  if (!/^\d+$/.test(args.fleetRunId)) fail("--fleet-run must be an Actions run ID");
  if (!/^v\d+\.\d+\.\d+$/.test(args.tag)) fail("--tag must be vX.Y.Z");
  return args;
}

function verifyRun(runId, expectedPath, commit) {
  const action = ghJson(`actions/runs/${runId}`);
  if (action.conclusion !== "success") fail(`${expectedPath} run ${runId} is not successful`);
  if (action.head_sha !== commit) fail(`${expectedPath} run ${runId} did not execute the guarded commit`);
  if (action.path !== expectedPath) fail(`run ${runId} is ${action.path}, expected ${expectedPath}`);
}

async function jsonFiles(root) {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...await jsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) found.push(path);
  }
  return found;
}

function configuredNames(path) {
  const response = ghJson(path);
  const rows = Array.isArray(response.secrets) ? response.secrets : Array.isArray(response.variables) ? response.variables : [];
  return new Set(rows.map((row) => row?.name).filter((name) => typeof name === "string"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (run("git", ["rev-parse", "HEAD"]) !== args.commit) fail("the local checkout is not the guarded commit");
  if (run("git", ["status", "--porcelain"])) fail("the local checkout is dirty");
  run("node", ["scripts/release/verify-tag.mjs", "--tag", args.tag], { capture: false });

  verifyRun(args.realDenRunId, ".github/workflows/voiceover-v49-real-den-no-result.yml", args.commit);
  verifyRun(args.fleetRunId, ".github/workflows/voiceover-v49-real-device-fleet.yml", args.commit);

  const temp = await mkdtemp(join(tmpdir(), "renwork-v49-finalize-"));
  try {
    run("gh", ["run", "download", args.fleetRunId, "--repo", REPO, "--pattern", "RenWork-V49-device-*", "--dir", temp], { capture: false });
    const allowedNames = new Set(Object.keys(REQUIRED_TARGETS).map((target) => `${target}.json`));
    const files = (await jsonFiles(temp)).filter((file) => allowedNames.has(basename(file)));
    const entries = await Promise.all(files.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
    validateFleetEvidence(entries, { commit: args.commit, maxAgeHours: 168 });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  const secrets = configuredNames("actions/secrets");
  const variables = configuredNames("actions/variables");
  const missingApple = APPLE_SECRETS.filter((name) => !secrets.has(name));
  const missingAzure = AZURE_SETTINGS.filter((name) => !secrets.has(name) && !variables.has(name));
  if (missingApple.length || missingAzure.length) {
    fail(`signing configuration is incomplete: ${[...missingApple, ...missingAzure].join(", ")}`);
  }

  const pr = JSON.parse(run("gh", ["pr", "view", "80", "--repo", REPO, "--json", "state,headRefOid"]));
  if (pr.state !== "OPEN" || pr.headRefOid !== args.commit) fail("PR #80 is not open at the guarded commit");
  if (run("git", ["ls-remote", "--tags", "origin", `refs/tags/${args.tag}`])) fail(`tag ${args.tag} already exists`);

  // No mutation occurs before this line. Every live, fleet, freshness, spend,
  // receipt, source-commit, and signing precondition has now passed.
  run("gh", ["pr", "merge", "80", "--repo", REPO, "--merge"], { capture: false });
  const merged = JSON.parse(run("gh", ["pr", "view", "80", "--repo", REPO, "--json", "state,headRefOid,mergeCommit"]));
  if (merged.state !== "MERGED" || merged.headRefOid !== args.commit || !merged.mergeCommit?.oid) {
    fail("PR #80 did not merge at the guarded commit");
  }

  run("git", ["fetch", "origin", merged.mergeCommit.oid]);
  run("git", ["tag", "-a", args.tag, merged.mergeCommit.oid, "-m", `RenWork ${args.tag} signed prerelease`]);
  run("git", ["push", "origin", args.tag], { capture: false });
  run("gh", [
    "workflow", "run", "release-macos-aarch64.yml", "--repo", REPO, "--ref", args.tag,
    "-f", `tag=${args.tag}`,
    "-f", `release_name=RenWork ${args.tag} prerelease`,
    "-f", "draft=false",
    "-f", "prerelease=true",
    "-f", "notarize=true",
    "-f", "build_electron=true",
    "-f", "sign_windows=true",
    "-f", "publish_npm=false",
    "-f", "publish_daytona_snapshot=false",
  ], { capture: false });
  process.stdout.write(`V49 gates passed. PR #80 merged at ${merged.mergeCommit.oid}; signed prerelease ${args.tag} was dispatched.\n`);
}

main().catch((error) => {
  process.stderr.write(`V49 finalization refused: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
