import { expect } from "vitest";
import { randomUUID } from "node:crypto";
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
 * signs into that tenant and proves the durable reserve -> capture ledger
 * path. Hosted CI invokes the real Den gateway directly because a packaging VM
 * is not a physical desktop acceptance target. Six self-hosted runners exercise
 * the same tenant through installed RenWork binaries and write device evidence.
 * A missing environment input is a skip in the broad stack suite, but the
 * dedicated V49 workflow performs a fail-closed preflight before invoking it.
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
  : "a real Den tenant captures provider-reported Token usage when the model returns no visible result";

const REQUEST_TIMEOUT_MS = 30_000;
const TERMINAL_RECEIPT_TIMEOUT_MS = 180_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConnectTimeout(error: unknown): boolean {
  return error instanceof TypeError
    && isRecord(error.cause)
    && error.cause.code === "UND_ERR_CONNECT_TIMEOUT";
}

function auth(session: DenSession, organizationId: string): Record<string, string> {
  return {
    authorization: `Bearer ${session.token}`,
    "x-openwork-org-id": organizationId,
  };
}

async function readDenWithRetry(
  session: DenSession,
  path: string,
  headers: Record<string, string>,
) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await denFetch(session, path, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (result.response.status < 500 || attempt === 3) return result;
      lastError = new Error(`${path} returned HTTP ${result.response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw lastError instanceof Error ? lastError : new Error(`${path} failed after retries`);
}

async function orgRequest(session: DenSession, organizationId: string, path: string) {
  const result = await readDenWithRetry(session, path, auth(session, organizationId));
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

async function invokeNoResultGateway(input: {
  apiBaseUrl: string;
  inferenceKey: string;
  organizationId: string;
  modelSku: string;
  prompt: string;
}) {
  const idempotencyKey = `v49-real-den:${randomUUID()}`;
  const url = `${input.apiBaseUrl.replace(/\/+$/, "")}/api/v1/chat/completions`;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.inferenceKey}`,
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
          "x-openwork-org-id": input.organizationId,
        },
        body: JSON.stringify({
          model: input.modelSku,
          stream: false,
          max_tokens: 16,
          messages: [{ role: "user", content: input.prompt }],
        }),
        signal: AbortSignal.timeout(TERMINAL_RECEIPT_TIMEOUT_MS),
      });
      break;
    } catch (error) {
      // A connection timeout means no socket was established and no request
      // bytes were sent. Reusing the same idempotency key also keeps a retry
      // fail-safe if a platform ever reports this error ambiguously. Never
      // retry HTTP responses, aborts, or any other write failure here.
      if (!isConnectTimeout(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  if (!response) throw new Error("Real Den gateway call did not return a response");
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Real Den gateway call failed: HTTP ${response.status} ${raw.slice(0, 1_000)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Real Den gateway returned invalid JSON: ${raw.slice(0, 1_000)}`);
  }
  if (!isRecord(payload) || responseHasVisibleResult(payload)) {
    throw new Error(`Dedicated no-result route returned visible content: ${raw.slice(0, 1_000)}`);
  }
  return { payload, status: response.status };
}

function responseHasVisibleResult(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  return choices.some((choice) => isRecord(choice) && isRecord(choice.message)
    && typeof choice.message.content === "string" && choice.message.content.length > 0);
}

async function writeHostedEvidence(input: {
  organizationId: string;
  modelSku: string;
  catalog: JsonRecord;
  receipt: JsonRecord;
  walletBefore: ReturnType<typeof wallet>;
  walletAfter: ReturnType<typeof wallet>;
  gatewayStatus: number;
}) {
  const outputPath = process.env.OPENWORK_EVAL_HOSTED_EVIDENCE_PATH?.trim()
    || "evals/.results/voiceover-v49-real-den-no-result.json";
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    voiceover: "V49",
    observedAt: new Date().toISOString(),
    executionChannel: "real-den-inference-gateway",
    organizationId: input.organizationId,
    modelSku: input.modelSku,
    catalogVersion: input.catalog.version,
    gatewayStatus: input.gatewayStatus,
    receiptId: input.receipt.id,
    receiptStatus: input.receipt.status,
    hasResult: input.receipt.has_result,
    capturedMicroCredits: input.receipt.captured_microcredits,
    releasedMicroCredits: input.receipt.released_microcredits,
    actualUsage: input.receipt.actual_usage,
    walletBefore: input.walletBefore,
    walletAfter: input.walletAfter,
  }, null, 2)}\n`, "utf8");
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
    await signInDesktopAs(surface, den.ref, den.admin, {
      organizationId,
      completeOnboarding: true,
    });
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
  const orgs = await readDenWithRetry(
    den.admin,
    "/v1/me/orgs",
    { authorization: `Bearer ${den.admin.token}` },
  );
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
  const prompt = process.env.OPENWORK_EVAL_DEN_NO_RESULT_PROMPT?.trim()
    || "V49 acceptance: return no visible assistant text through the dedicated test route.";
  const evidenceOutput = process.env.OPENWORK_EVAL_DEVICE_EVIDENCE_PATH?.trim();
  let loginShotHash = "";
  let catalogShotHash = "";
  let receiptShotHash = "";
  let gatewayStatus: number | null = null;

  if (evidenceOutput) {
    await using desktopApp = await launchRealDenDesktop(den, place, organizationId);
    const activeOrgId = await evalIn(desktopApp, "localStorage.getItem('openwork.den.activeOrgId') ?? ''");
    expect(activeOrgId).toBe(organizationId);
    loginShotHash = (await screenshot(desktopApp)).hash;

    const models = await readAvailableModels(desktopApp);
    expect(models.some((model) => model.id === modelSku && model.selectable)).toBe(true);
    const selected = await selectModel(desktopApp, modelSku);
    expect(selected.id).toBe(modelSku);
    expect(selected.selected).toBe(true);
    catalogShotHash = (await screenshot(desktopApp)).hash;

    await sendComposerMessage(desktopApp, prompt);
    await waitFor(desktopApp, "Boolean(document.querySelector('[data-testid=\"admission-outcome-unknown\"]'))", {
      timeoutMs: TERMINAL_RECEIPT_TIMEOUT_MS,
      label: "no-visible-result recovery card",
    });
    receiptShotHash = (await screenshot(desktopApp)).hash;
  } else {
    const inferenceKey = process.env.OPENWORK_EVAL_INFERENCE_KEY?.trim();
    if (!inferenceKey) {
      throw new Error("OPENWORK_EVAL_INFERENCE_KEY is required for the hosted real-Den settlement gate.");
    }
    const gateway = await invokeNoResultGateway({
      apiBaseUrl: den.ref.apiUrl,
      inferenceKey,
      organizationId,
      modelSku,
      prompt,
    });
    gatewayStatus = gateway.status;
  }

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
      loginShotHash,
      catalogShotHash,
      receiptShotHash,
      maxSpend,
    });
  } else {
    await writeHostedEvidence({
      organizationId,
      modelSku,
      catalog,
      receipt,
      walletBefore,
      walletAfter,
      gatewayStatus: gatewayStatus ?? 0,
    });
  }

  evidence.fact(
    evidenceOutput ? "The installed desktop used the real Den tenant" : "Hosted CI used the real Den inference gateway",
    evidenceOutput
      ? `The signed-in organization ${organizationId} loaded and selected authoritative SKU ${modelSku} through an installed binary.`
      : `The signed-in organization ${organizationId} loaded authoritative SKU ${modelSku}, then invoked the production gateway with its revocable member inference key.`,
    true,
  );
  evidence.fact(
    "No-visible-result Token usage was captured",
    `Receipt ${reservationId} reported ${usageTotal(receipt)} Token units, captured ${receipt.captured_microcredits} microcredits within the ${maxSpend} cap, and returned frozen balance to ${walletAfter.reserved}.`,
    true,
  );
});
