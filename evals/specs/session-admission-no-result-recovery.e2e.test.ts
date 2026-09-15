import { expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  denFetch,
  evalIn,
  readAvailableModels,
  selectModel,
  sendComposerMessage,
  signInDesktopAs,
  waitFor,
} from "@openwork/behaviors";
import type { DenSession } from "@openwork/behaviors";
import { screenshot } from "@openwork/fraimz";
import { desktop } from "@openwork/hosts";
import { needs, server, test, unmetNeeds } from "@openwork/testkit";
import type { Den } from "@openwork/testkit";
import type { Place } from "@openwork/testkit";
import type { NeedsSpec } from "@openwork/testkit";

/**
 * LIVE RELEASE GATE — no local provider, no mock Den, no BYOK fallback.
 *
 * The configured Den test tenant owns a dedicated model route that returns no
 * visible assistant text while still reporting provider Token usage. This spec
 * signs a fresh packaged/source desktop into that tenant, runs the model, and
 * proves the durable reserve -> capture ledger path. A missing environment
 * input is a skip in the broad stack suite, but the dedicated V49 workflow
 * performs a fail-closed preflight before it invokes this file.
 */

const requirements: NeedsSpec = {
  env: [
    "OPENWORK_EVAL_DEN_API_URL",
    "OPENWORK_EVAL_DEN_WEB_URL",
    "OPENWORK_EVAL_DEMO_EMAIL",
    "OPENWORK_EVAL_DEMO_PASSWORD",
    "OPENWORK_EVAL_DEN_ORG_ID",
    "OPENWORK_EVAL_DEN_NO_RESULT_MODEL_SKU",
    "OPENWORK_EVAL_MAX_RENCREDIT_MICROCREDITS",
  ],
  optIn: ["OPENWORK_EVAL_E2E_TESTS"],
};
const missingRequirements = unmetNeeds(requirements, process.env);
const title = missingRequirements.length > 0
  ? `real Den no-result settlement skipped — needs: ${missingRequirements.join(", ")}`
  : "a real Den tenant captures provider-reported Token usage when the installed desktop receives no visible result";

const REQUEST_TIMEOUT_MS = 30_000;
const TERMINAL_RECEIPT_TIMEOUT_MS = 180_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function auth(session: DenSession, organizationId: string): Record<string, string> {
  return {
    authorization: `Bearer ${session.token}`,
    "x-openwork-org-id": organizationId,
  };
}

async function orgRequest(session: DenSession, organizationId: string, path: string) {
  const result = await denFetch(session, path, {
    headers: auth(session, organizationId),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!result.response.ok) {
    throw new Error(`${path} failed: HTTP ${result.response.status} ${result.text.slice(0, 500)}`);
  }
  return result.body;
}

function wallet(value: unknown) {
  const row = isRecord(value) && isRecord(value.wallet) ? value.wallet : null;
  const available = row?.available_microcredits;
  const reserved = row?.reserved_microcredits;
  const version = row?.version;
  if (!row || typeof row.organization_id !== "string"
    || typeof available !== "number" || !Number.isSafeInteger(available)
    || typeof reserved !== "number" || !Number.isSafeInteger(reserved)
    || typeof version !== "number" || !Number.isSafeInteger(version)) {
    throw new Error(`Invalid RenCredit wallet payload: ${JSON.stringify(value).slice(0, 500)}`);
  }
  return { organizationId: row.organization_id, available, reserved, version };
}

function receipts(value: unknown): JsonRecord[] {
  if (!isRecord(value) || !Array.isArray(value.receipts)) {
    throw new Error(`Invalid RenCredit receipts payload: ${JSON.stringify(value).slice(0, 500)}`);
  }
  return value.receipts.filter(isRecord);
}

function ledger(value: unknown): JsonRecord[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error(`Invalid RenCredit ledger payload: ${JSON.stringify(value).slice(0, 500)}`);
  }
  return value.entries.filter(isRecord);
}

function usageTotal(receipt: JsonRecord): number {
  const usage = isRecord(receipt.actual_usage) ? receipt.actual_usage : null;
  if (!usage) return 0;
  return ["inputTokens", "outputTokens", "reasoningTokens", "cacheReadTokens", "cacheWriteTokens"]
    .reduce((sum, key) => sum + (typeof usage[key] === "number" ? usage[key] : 0), 0);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when writing V49 real-device evidence.`);
  return value;
}

function integerField(row: JsonRecord, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`Expected integer ${key} in ${JSON.stringify(row).slice(0, 500)}`);
  }
  return value;
}

async function writeDeviceEvidence(input: {
  outputPath: string;
  organizationId: string;
  membership: JsonRecord;
  modelSku: string;
  catalog: JsonRecord;
  receipt: JsonRecord;
  ledgerRows: JsonRecord[];
  walletBefore: ReturnType<typeof wallet>;
  walletAfter: ReturnType<typeof wallet>;
  loginShotHash: string;
  catalogShotHash: string;
  receiptShotHash: string;
  maxSpend: number;
}) {
  const usage = isRecord(input.receipt.actual_usage) ? input.receipt.actual_usage : {};
  const correlated = input.ledgerRows.filter((entry) => entry.reservation_id === input.receipt.id);
  const payload = {
    schemaVersion: 1,
    voiceover: "V49",
    sourceCommit: requiredEnv("OPENWORK_EVAL_SOURCE_COMMIT"),
    observedAt: new Date().toISOString(),
    target: {
      id: requiredEnv("OPENWORK_EVAL_DEVICE_TARGET_ID"),
      os: requiredEnv("OPENWORK_EVAL_DEVICE_OS"),
      osVersion: requiredEnv("OPENWORK_EVAL_DEVICE_OS_VERSION"),
      arch: requiredEnv("OPENWORK_EVAL_DEVICE_ARCH"),
      deviceId: requiredEnv("OPENWORK_EVAL_DEVICE_ID"),
    },
    artifact: {
      name: requiredEnv("OPENWORK_EVAL_ARTIFACT_NAME"),
      sha256: requiredEnv("OPENWORK_EVAL_ARTIFACT_SHA256"),
    },
    executionChannel: "installed-renwork-ui",
    checks: {
      installed: true,
      launchedInstalledBinary: true,
      organizationLogin: true,
      authoritativeCatalogLoaded: true,
      modelSelected: true,
      modelCallCompleted: true,
      cloudOnlyRuntime: process.env.OPENWORK_EVAL_CLOUD_ONLY_FLEET === "1",
    },
    den: {
      origin: requiredEnv("OPENWORK_EVAL_DEN_API_URL"),
      organizationId: input.organizationId,
      memberId: String(input.membership.orgMemberId ?? input.membership.membershipId ?? ""),
      catalogVersion: String(input.catalog.version ?? ""),
    },
    modelSku: input.modelSku,
    rencredit: {
      reservationId: String(input.receipt.id ?? ""),
      receiptId: String(input.receipt.id ?? ""),
      status: input.receipt.status,
      reservedMicroCredits: integerField(input.receipt, "reserved_microcredits"),
      capturedMicroCredits: integerField(input.receipt, "captured_microcredits"),
      releasedMicroCredits: integerField(input.receipt, "released_microcredits"),
      approvedMaxMicroCredits: input.maxSpend,
      walletBeforeAvailable: input.walletBefore.available,
      walletAfterAvailable: input.walletAfter.available,
      walletBeforeReserved: input.walletBefore.reserved,
      walletAfterReserved: input.walletAfter.reserved,
      usage: {
        inputTokens: Number(usage.inputTokens ?? 0),
        outputTokens: Number(usage.outputTokens ?? 0),
        reasoningTokens: Number(usage.reasoningTokens ?? 0),
        cacheReadTokens: Number(usage.cacheReadTokens ?? 0),
        cacheWriteTokens: Number(usage.cacheWriteTokens ?? 0),
      },
      ledgerEntryIds: correlated.map((entry) => String(entry.id ?? "")).filter(Boolean),
    },
    evidence: {
      install: `sha256:${requiredEnv("OPENWORK_EVAL_ARTIFACT_SHA256")}`,
      login: `sha256:${input.loginShotHash}`,
      modelCatalog: `sha256:${input.catalogShotHash}`,
      receipt: `sha256:${input.receiptShotHash}`,
    },
  };
  await mkdir(dirname(input.outputPath), { recursive: true });
  await writeFile(input.outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function waitForNewTerminalReceipt(input: {
  session: DenSession;
  organizationId: string;
  beforeIds: Set<string>;
  modelSku: string;
}): Promise<JsonRecord> {
  const deadline = Date.now() + TERMINAL_RECEIPT_TIMEOUT_MS;
  let last: JsonRecord[] = [];
  while (Date.now() < deadline) {
    last = receipts(await orgRequest(input.session, input.organizationId, "/v1/rencredit/receipts?limit=50"));
    const match = last.find((receipt) => {
      const id = typeof receipt.id === "string" ? receipt.id : "";
      return id && !input.beforeIds.has(id)
        && receipt.model_sku === input.modelSku
        && (receipt.status === "captured" || receipt.status === "released");
    });
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`No new terminal receipt for ${input.modelSku}; last receipts: ${JSON.stringify(last).slice(0, 2_000)}`);
}

async function launchRealDenDesktop(den: Den, place: Place, organizationId: string) {
  const activate = await denFetch(den.admin, "/v1/me/active-organization", {
    method: "POST",
    headers: { authorization: `Bearer ${den.admin.token}`, "content-type": "application/json" },
    body: JSON.stringify({ organizationId }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!activate.response.ok) {
    throw new Error(`Could not activate ${organizationId}: HTTP ${activate.response.status} ${activate.text.slice(0, 500)}`);
  }

  const surface = await desktop({
    name: `v49-real-den-${process.env.OPENWORK_EVAL_DEVICE_TARGET_ID?.trim() || "functional"}`,
    host: place.host(),
    bootstrap: {
      baseUrl: den.ref.webUrl,
      apiBaseUrl: den.ref.apiUrl,
      requireSignin: true,
    },
  });
  try {
    await signInDesktopAs(surface, den.ref, den.admin);
    await waitFor(surface, `(() => {
      const text = document.body.innerText;
      const runTask = [...document.querySelectorAll("button")]
        .some((button) => ["Run task", "运行任务"].includes((button.textContent ?? "").trim()));
      return window.location.hash.includes("/session") && (runTask
        || text.includes("What do you need done?")
        || text.includes("今天需要为您完成什么外贸任务？"));
    })()`, {
      timeoutMs: 120_000,
      label: "Den-only cloud session task UI",
    });
    return surface;
  } catch (error) {
    await surface[Symbol.asyncDispose]();
    throw error;
  }
}

test.skipIf(missingRequirements.length > 0)(title, { timeout: 600_000 }, async ({ evidence, place }) => {
  needs(requirements);

  const organizationId = process.env.OPENWORK_EVAL_DEN_ORG_ID!.trim();
  const modelSku = process.env.OPENWORK_EVAL_DEN_NO_RESULT_MODEL_SKU!.trim();
  const maxSpend = Number(process.env.OPENWORK_EVAL_MAX_RENCREDIT_MICROCREDITS);
  if (!organizationId || !modelSku || !Number.isSafeInteger(maxSpend) || maxSpend <= 0) {
    throw new Error("The organization, model SKU, and positive integer RenCredit spend cap must be explicit.");
  }

  await using den = await server({ place });
  const orgs = await denFetch(den.admin, "/v1/me/orgs", {
    headers: { authorization: `Bearer ${den.admin.token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const memberships = isRecord(orgs.body) && Array.isArray(orgs.body.orgs) ? orgs.body.orgs.filter(isRecord) : [];
  const membership = memberships.find((entry) => entry.id === organizationId);
  if (!orgs.response.ok || !membership) {
    throw new Error(`The test account is not a member of the required organization ${organizationId}.`);
  }

  const catalog = await orgRequest(den.admin, organizationId, "/v1/models/catalog");
  if (!isRecord(catalog) || typeof catalog.version !== "string" || !Array.isArray(catalog.models)) {
    throw new Error(`Invalid authoritative model catalog: ${JSON.stringify(catalog).slice(0, 500)}`);
  }
  if (!catalog.models.filter(isRecord).some((model) => model.sku === modelSku)) {
    throw new Error(`The authoritative catalog does not grant ${modelSku} to ${organizationId}.`);
  }

  const walletBefore = wallet(await orgRequest(den.admin, organizationId, "/v1/rencredit/wallet"));
  expect(walletBefore.organizationId).toBe(organizationId);
  const receiptRowsBefore = receipts(await orgRequest(den.admin, organizationId, "/v1/rencredit/receipts?limit=50"));
  const receiptIdsBefore = new Set(receiptRowsBefore.map((row) => typeof row.id === "string" ? row.id : "").filter(Boolean));

  await using desktopApp = await launchRealDenDesktop(den, place, organizationId);
  const activeOrgId = await evalIn(desktopApp, "localStorage.getItem('openwork.den.activeOrgId') ?? ''");
  expect(activeOrgId).toBe(organizationId);
  const loginShot = await screenshot(desktopApp);

  const models = await readAvailableModels(desktopApp);
  expect(models.some((model) => model.id === modelSku && model.selectable)).toBe(true);
  const selected = await selectModel(desktopApp, modelSku);
  expect(selected.id).toBe(modelSku);
  expect(selected.selected).toBe(true);
  const catalogShot = await screenshot(desktopApp);

  const prompt = process.env.OPENWORK_EVAL_DEN_NO_RESULT_PROMPT?.trim()
    || "V49 acceptance: return no visible assistant text through the dedicated test route.";
  await sendComposerMessage(desktopApp, prompt);
  await waitFor(desktopApp, "Boolean(document.querySelector('[data-testid=\"admission-outcome-unknown\"]'))", {
    timeoutMs: TERMINAL_RECEIPT_TIMEOUT_MS,
    label: "no-visible-result recovery card",
  });

  const receipt = await waitForNewTerminalReceipt({
    session: den.admin,
    organizationId,
    beforeIds: receiptIdsBefore,
    modelSku,
  });
  expect(receipt.status).toBe("captured");
  expect(receipt.has_result).toBe(false);
  expect(usageTotal(receipt)).toBeGreaterThan(0);
  expect(receipt.reserved_microcredits).toEqual(expect.any(Number));
  expect(Number(receipt.reserved_microcredits)).toBeGreaterThan(0);
  expect(Number(receipt.captured_microcredits)).toBeGreaterThan(0);
  expect(Number(receipt.captured_microcredits)).toBeLessThanOrEqual(maxSpend);

  const reservationId = String(receipt.id ?? "");
  const ledgerAfter = ledger(await orgRequest(den.admin, organizationId, "/v1/rencredit/ledger?limit=100"));
  const correlated = ledgerAfter.filter((entry) => entry.reservation_id === reservationId);
  expect(correlated.some((entry) => entry.entry_type === "reserve")).toBe(true);
  expect(correlated.some((entry) => entry.entry_type === "capture")).toBe(true);

  const walletAfter = wallet(await orgRequest(den.admin, organizationId, "/v1/rencredit/wallet"));
  expect(walletAfter.reserved).toBe(walletBefore.reserved);
  expect(walletAfter.available).toBe(walletBefore.available - Number(receipt.captured_microcredits));
  expect(walletAfter.version).toBeGreaterThan(walletBefore.version);
  const receiptShot = await screenshot(desktopApp);

  const evidenceOutput = process.env.OPENWORK_EVAL_DEVICE_EVIDENCE_PATH?.trim();
  if (evidenceOutput) {
    await writeDeviceEvidence({
      outputPath: evidenceOutput,
      organizationId,
      membership,
      modelSku,
      catalog,
      receipt,
      ledgerRows: ledgerAfter,
      walletBefore,
      walletAfter,
      loginShotHash: loginShot.hash,
      catalogShotHash: catalogShot.hash,
      receiptShotHash: receiptShot.hash,
      maxSpend,
    });
  }

  evidence.fact(
    "The installed desktop used the real Den tenant",
    `The signed-in organization ${organizationId} loaded and selected authoritative SKU ${modelSku}; no local provider or mock server exists in this spec.`,
    true,
  );
  evidence.fact(
    "No-visible-result Token usage was captured",
    `Receipt ${reservationId} reported ${usageTotal(receipt)} Token units, captured ${receipt.captured_microcredits} microcredits within the ${maxSpend} cap, and returned frozen balance to ${walletAfter.reserved}.`,
    true,
  );
});
