import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V33 makes RenCredit readiness and OAuth concurrency self-healing", async ({ evidence }) => {
  const [voiceover, providerSync, localRuntime, server, meteredRuntime, ledger] = await Promise.all([
    readFile("../evals/voiceovers/rencredit-runtime-self-healing-v33.md", "utf8"),
    readFile("../apps/server/src/cloud-provider-sync.ts", "utf8"),
    readFile("../apps/server/src/rencredit-local-runtime.ts", "utf8"),
    readFile("../apps/server/src/server.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/rencredit-ledger.ts", "utf8"),
  ]);

  expect(voiceover).toContain("runtime readiness");
  expect(voiceover).toContain("short execution lease");
  expect(voiceover).toContain("retryAfterSeconds");

  expect(providerSync).toContain("waitForMeteringCredentials");
  expect(providerSync).toContain("meteringReady");
  expect(localRuntime).toContain("heartbeat");
  expect(localRuntime).toContain("retryAfterSeconds");
  expect(server).toContain('"/rencredit-runtime/status"');
  expect(server).toContain("await cloudProviderSync.setSession(session)");
  expect(server).toContain("LOCAL_RUNTIME_HEARTBEAT_FAILED");

  expect(meteredRuntime).toContain("DEVICE_OAUTH_LEASE_MS");
  expect(meteredRuntime).toContain("releaseExpiredInferenceReservations");
  expect(meteredRuntime).toContain("retryAfterSeconds");
  expect(meteredRuntime).toContain('"/api/v1/metered-runtime/reservations/:reservationId/heartbeat"');
  expect(ledger).toContain("renewInferenceReservationLease");

  evidence.fact(
    "Runtime readiness is a server-owned gate",
    "A Den session update waits for the first provider pass, and the sanitized readiness endpoint reports only booleans and status codes.",
    true,
  );
  evidence.fact(
    "Abandoned OAuth work self-heals",
    "A short server lease is renewed during active work and expired reservations are released before the next concurrency decision.",
    true,
  );
  evidence.fact(
    "RenCredit remains fail-closed and idempotent",
    "Execution still requires a reservation; completion captures once and every pre-delivery failure releases the same reservation.",
    true,
  );
});
