import { readFile } from "node:fs/promises";
import { createPrivateKey, randomUUID, sign } from "node:crypto";

import { canonicalLocalRuntimeReceiptPayload } from "../../packages/rencredit-metering/src/local-runtime-receipt.js";
import { parseCodexExecEvent } from "../../apps/server/src/renwork-cli-runtime.js";

type Reservation = {
  reservationId: string;
  runId: string;
  modelSku: string;
};

const [reservationPath, eventsPath, privateKeyPath, deviceId] = process.argv.slice(2);
if (!reservationPath || !eventsPath || !privateKeyPath || !deviceId) {
  throw new Error("Usage: sign-codex-metering-receipt <reservation.json> <events.jsonl> <private.pem> <device-id>");
}

const reservation = JSON.parse(
  await readFile(reservationPath === "-" ? 0 : reservationPath, "utf8"),
) as Reservation;
const lines = (await readFile(eventsPath, "utf8")).split(/\r?\n/u).filter(Boolean);
let usage = null;
let providerResponseId = "";
let hasResult = false;

for (const line of lines) {
  const event = parseCodexExecEvent(JSON.parse(line) as unknown);
  if (event.usage) usage = event.usage;
  if (event.responseId) providerResponseId = event.responseId;
  if (event.responseText) hasResult = true;
}

if (!usage) throw new Error("Codex did not emit an authoritative turn.completed usage event.");
if (!providerResponseId) throw new Error("Codex did not emit a provider response identifier.");

const payload = {
  version: 1 as const,
  deviceId,
  reservationId: reservation.reservationId,
  runId: reservation.runId,
  modelSku: reservation.modelSku,
  providerResponseId,
  usage,
  accuracy: "reported" as const,
  hasResult,
  measuredAt: new Date().toISOString(),
  nonce: randomUUID(),
};
const privateKey = createPrivateKey(await readFile(privateKeyPath, "utf8"));
const signature = sign(
  null,
  new TextEncoder().encode(canonicalLocalRuntimeReceiptPayload(payload)),
  privateKey,
).toString("base64");

process.stdout.write(`${JSON.stringify({ payload, signature })}\n`);
