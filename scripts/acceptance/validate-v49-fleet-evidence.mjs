#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_TARGETS = Object.freeze({
  "macos-arm64": { os: "macos", arch: "arm64" },
  "macos-x64": { os: "macos", arch: "x64" },
  "windows-x64": { os: "windows", arch: "x64" },
  "windows-server-2016-x64": { os: "windows-server-2016", arch: "x64" },
  "linux-x64": { os: "linux", arch: "x64" },
  "linux-arm64": { os: "linux", arch: "arm64" },
});

function fail(message) {
  throw new Error(message);
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value.trim();
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail(`${label} must be an integer >= ${minimum}`);
  return value;
}

function truth(value, label) {
  if (value !== true) fail(`${label} must be true`);
}

function parseArgs(argv) {
  const args = { directory: "", commit: "", maxAgeHours: 168 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dir") args.directory = argv[++index] ?? "";
    else if (token === "--commit") args.commit = argv[++index] ?? "";
    else if (token === "--max-age-hours") args.maxAgeHours = Number(argv[++index]);
    else fail(`Unknown argument: ${token}`);
  }
  args.directory = text(args.directory, "--dir");
  args.commit = text(args.commit, "--commit");
  if (!/^[0-9a-f]{40}$/i.test(args.commit)) fail("--commit must be the full 40-character source commit");
  if (!Number.isFinite(args.maxAgeHours) || args.maxAgeHours <= 0) fail("--max-age-hours must be positive");
  return args;
}

function tokenTotal(usage) {
  return ["inputTokens", "outputTokens", "reasoningTokens", "cacheReadTokens", "cacheWriteTokens"]
    .reduce((sum, key) => sum + integer(usage[key], `rencredit.usage.${key}`), 0);
}

export function validateFleetEvidence(entries, options) {
  if (!Array.isArray(entries)) fail("fleet evidence must be an array");
  const expectedIds = Object.keys(REQUIRED_TARGETS);
  if (entries.length !== expectedIds.length) {
    fail(`expected exactly ${expectedIds.length} device records, received ${entries.length}`);
  }

  const seenTargets = new Set();
  const seenDevices = new Set();
  const seenReceipts = new Set();
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeHours * 60 * 60 * 1_000;

  for (const raw of entries) {
    const entry = record(raw, "device evidence");
    if (entry.schemaVersion !== 1 || entry.voiceover !== "V49") fail("schemaVersion=1 and voiceover=V49 are required");
    if (text(entry.sourceCommit, "sourceCommit") !== options.commit) fail("every device must test the exact guarded commit");

    const target = record(entry.target, "target");
    const targetId = text(target.id, "target.id");
    const expected = REQUIRED_TARGETS[targetId];
    if (!expected) fail(`unknown target.id ${targetId}`);
    if (seenTargets.has(targetId)) fail(`duplicate target.id ${targetId}`);
    seenTargets.add(targetId);
    if (target.os !== expected.os || target.arch !== expected.arch) fail(`${targetId} OS/architecture does not match its release target`);
    text(target.osVersion, "target.osVersion");
    const deviceId = text(target.deviceId, "target.deviceId");
    if (seenDevices.has(deviceId)) fail(`deviceId ${deviceId} was reused across targets`);
    seenDevices.add(deviceId);

    const artifact = record(entry.artifact, "artifact");
    text(artifact.name, "artifact.name");
    if (!/^[0-9a-f]{64}$/i.test(text(artifact.sha256, "artifact.sha256"))) fail("artifact.sha256 must be a SHA-256 digest");

    const observedAt = Date.parse(text(entry.observedAt, "observedAt"));
    if (!Number.isFinite(observedAt) || observedAt > now + 5 * 60_000 || now - observedAt > maxAgeMs) {
      fail(`${targetId} evidence is stale or dated in the future`);
    }

    const checks = record(entry.checks, "checks");
    for (const key of ["installed", "launchedInstalledBinary", "organizationLogin", "authoritativeCatalogLoaded", "modelSelected", "modelCallCompleted"]) {
      truth(checks[key], `checks.${key}`);
    }
    if (targetId === "windows-server-2016-x64") truth(checks.cloudOnlyRuntime, "checks.cloudOnlyRuntime");
    if (entry.executionChannel !== "installed-renwork-ui") fail("executionChannel must be installed-renwork-ui");

    const den = record(entry.den, "den");
    text(den.origin, "den.origin");
    text(den.organizationId, "den.organizationId");
    text(den.memberId, "den.memberId");
    text(den.catalogVersion, "den.catalogVersion");
    text(entry.modelSku, "modelSku");

    const billing = record(entry.rencredit, "rencredit");
    const reservationId = text(billing.reservationId, "rencredit.reservationId");
    const receiptId = text(billing.receiptId, "rencredit.receiptId");
    if (receiptId !== reservationId) fail("the public receipt id must correlate to the reservation id");
    if (seenReceipts.has(receiptId)) fail(`receiptId ${receiptId} was reused across devices`);
    seenReceipts.add(receiptId);
    if (billing.status !== "captured") fail("the real-device call must have a captured terminal receipt");
    const reserved = integer(billing.reservedMicroCredits, "rencredit.reservedMicroCredits", 1);
    const captured = integer(billing.capturedMicroCredits, "rencredit.capturedMicroCredits", 1);
    const released = integer(billing.releasedMicroCredits, "rencredit.releasedMicroCredits");
    const approvedMax = integer(billing.approvedMaxMicroCredits, "rencredit.approvedMaxMicroCredits", 1);
    if (captured > approvedMax) fail(`${targetId} captured more than its approved spend cap`);
    if (captured + released < reserved) fail(`${targetId} did not account for the full reservation`);
    if (tokenTotal(record(billing.usage, "rencredit.usage")) <= 0) fail(`${targetId} lacks provider-reported Token consumption`);
    const beforeAvailable = integer(billing.walletBeforeAvailable, "rencredit.walletBeforeAvailable");
    const afterAvailable = integer(billing.walletAfterAvailable, "rencredit.walletAfterAvailable");
    const beforeReserved = integer(billing.walletBeforeReserved, "rencredit.walletBeforeReserved");
    const afterReserved = integer(billing.walletAfterReserved, "rencredit.walletAfterReserved");
    if (afterAvailable !== beforeAvailable - captured) fail(`${targetId} wallet available delta does not equal captured charge`);
    if (afterReserved !== beforeReserved) fail(`${targetId} left an abandoned frozen balance`);
    const ledgerEntryIds = Array.isArray(billing.ledgerEntryIds) ? billing.ledgerEntryIds.map((value, index) => text(value, `rencredit.ledgerEntryIds[${index}]`)) : [];
    if (ledgerEntryIds.length < 2 || new Set(ledgerEntryIds).size !== ledgerEntryIds.length) fail(`${targetId} needs distinct reserve and capture ledger entry ids`);

    const evidence = record(entry.evidence, "evidence");
    text(evidence.install, "evidence.install");
    text(evidence.login, "evidence.login");
    text(evidence.modelCatalog, "evidence.modelCatalog");
    text(evidence.receipt, "evidence.receipt");
  }

  for (const id of expectedIds) if (!seenTargets.has(id)) fail(`missing target ${id}`);
  return { ok: true, commit: options.commit, targets: [...seenTargets].sort() };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const directory = resolve(args.directory);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  const entries = await Promise.all(files.map(async (name) => JSON.parse(await readFile(resolve(directory, name), "utf8"))));
  const result = validateFleetEvidence(entries, { commit: args.commit, maxAgeHours: args.maxAgeHours });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`V49 fleet evidence rejected: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
