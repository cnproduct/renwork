#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args.shift();
const baseUrl = process.env.RENWORK_SERVER_URL?.replace(/\/+$/, "");
const token = process.env.RENWORK_SERVER_TOKEN;
const workspaceId = process.env.RENWORK_WORKSPACE_ID;

function localRuntimeBaseUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
    return url.protocol === "http:" && loopback ? url.origin : null;
  } catch {
    return null;
  }
}

const trustedBaseUrl = localRuntimeBaseUrl(baseUrl);

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function help() {
  process.stdout.write([
    "RenWork CLI unified metering entry",
    "",
    "Usage:",
    "  renwork status",
    "  renwork codex --model <RenWork model SKU> \"task prompt\"",
    "  printf 'task prompt' | renwork codex --model <RenWork model SKU>",
    "",
    "Only tasks started through this command produce RenCredit reservations and receipts.",
    "",
  ].join("\n"));
}

async function request(path, init = {}) {
  if (!trustedBaseUrl || !token) fail("RenWork local runtime is unavailable. Open an integrated RenWork terminal first.");
  // loopback-fetch: the wrapper rejects every non-loopback or non-HTTP runtime URL above.
  const response = await fetch(`${trustedBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.code || `RenWork request failed (${response.status})`;
    fail(message);
  }
  return payload;
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function modelAndPrompt(input) {
  let modelSku = "";
  const promptParts = [];
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index];
    if (value === "--model" || value === "-m") {
      modelSku = input[index + 1] ?? "";
      index += 1;
    } else {
      promptParts.push(value);
    }
  }
  return { modelSku: modelSku.trim(), prompt: promptParts.join(" ").trim() };
}

async function runCodex() {
  if (!workspaceId) fail("No local RenWork workspace is selected.");
  const parsed = modelAndPrompt(args);
  const prompt = parsed.prompt || (await readStdin()).trim();
  if (!parsed.modelSku) fail("Missing --model <RenWork model SKU>.");
  if (!prompt) fail("A task prompt is required.");
  const run = await request(`/workspace/${encodeURIComponent(workspaceId)}/cli-runtimes/codex/runs`, {
    method: "POST",
    body: JSON.stringify({ modelSku: parsed.modelSku, prompt }),
  });
  let cancelled = false;
  process.once("SIGINT", () => {
    cancelled = true;
    void request(`/workspace/${encodeURIComponent(workspaceId)}/cli-runtimes/runs/${encodeURIComponent(run.runId)}`, { method: "DELETE" })
      .finally(() => process.exit(130));
  });
  let current = run;
  while (!cancelled && (current.state === "running" || current.state === "settling")) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    current = await request(`/workspace/${encodeURIComponent(workspaceId)}/cli-runtimes/runs/${encodeURIComponent(run.runId)}`);
  }
  if (current.output) process.stdout.write(`${current.output}\n`);
  const settlement = current.settlement;
  if (settlement) {
    process.stderr.write(
      `[RenCredit] ${current.state}; captured=${settlement.capturedMicroCredits} microcredits; released=${settlement.releasedMicroCredits} microcredits; receipt=${settlement.reservationId}\n`,
    );
  }
  if (current.state !== "succeeded") fail(current.errorCode || `RenWork CLI task ${current.state}.`);
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  help();
} else if (command === "status") {
  const payload = await request("/cli-runtimes");
  for (const runtime of payload.runtimes ?? []) {
    process.stdout.write(`${runtime.runtime}: ${runtime.message}\n`);
  }
} else if (command === "codex") {
  await runCodex();
} else if (command === "antigravity") {
  fail("Antigravity metering is disabled until its CLI exposes verified structured Token usage.");
} else {
  fail(`Unknown RenWork command: ${command}`);
}
