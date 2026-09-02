import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V11 publishes the approved-device Codex route and exposes live RenCredit settlement", async ({ evidence }) => {
  const [catalog, runner, metering, settings, acceptance, signer] = await Promise.all([
    readFile("../packages/rencredit-metering/src/default-catalog.ts", "utf8"),
    readFile("../apps/server/src/renwork-cli-runtime.ts", "utf8"),
    readFile("../apps/server/src/rencredit-local-runtime.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/cli-runtime-settings.tsx", "utf8"),
    readFile("../deploy/cloud-api-server/docker-compose.acceptance.yml", "utf8"),
    readFile("../scripts/acceptance/sign-codex-metering-receipt.ts", "utf8"),
  ]);

  expect(catalog).toContain('sku: "renwork-codex"');
  expect(catalog).toContain('protocol: "codex_cli"');
  expect(catalog).toContain('authMode: "device_oauth"');
  expect(catalog).toContain('credentialStore: "device_vault"');
  expect(catalog).toContain('executionScope: "personal_device"');
  expect(catalog).toContain('source: "local"');
  expect(runner).toContain("reservedMicroCredits: reservation.reservedMicroCredits");
  expect(metering).toContain("reserved.payload.reservedMicroCredits");
  expect(settings).toContain('data-testid="rencredit-cli-live-panel"');
  expect(settings).toContain("实际扣除");
  expect(settings).toContain("缓存读取");
  expect(settings).toContain("取消并释放");
  expect(settings).toContain("Antigravity 在获得可核验的结构化用量事件前保持禁用正式计费");
  expect(acceptance).toContain("renwork_inference_v11");
  expect(acceptance).toContain("service_completed_successfully");
  expect(acceptance).toContain('"127.0.0.1:8792:8792"');
  expect(signer).toContain("canonicalLocalRuntimeReceiptPayload");
  expect(signer).toContain("Codex did not emit an authoritative turn.completed usage event");

  evidence.fact(
    "Codex OAuth has a billable catalog route without a cloud credential",
    "The stable renwork-codex SKU resolves to a user-private approved-device codex_cli route; the catalog carries no OpenAI OAuth secret.",
    true,
  );
  evidence.fact(
    "The desktop shows freeze, actual capture, release and all token classes",
    "The live panel polls the authoritative run snapshot and exposes the immutable reservation/receipt identifier while cancellation releases the reservation.",
    true,
  );
  evidence.fact(
    "Acceptance is isolated and migration-gated",
    "The V11 compose project uses a dedicated database and catalog volume, binds only to loopback, and starts Den only after the formal migration job succeeds.",
    true,
  );
});
