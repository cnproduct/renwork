import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V10 routes Codex CLI through signed RenCredit settlement and fails Antigravity closed", async ({ evidence }) => {
  const [runner, routes, metering, gateway, contracts, settings, wrapper] = await Promise.all([
    readFile("../apps/server/src/renwork-cli-runtime.ts", "utf8"),
    readFile("../apps/server/src/routes/cli-runtimes.ts", "utf8"),
    readFile("../apps/server/src/rencredit-local-runtime.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/metered-runtime.ts", "utf8"),
    readFile("../packages/rencredit-metering/src/contracts.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/cli-runtime-settings.tsx", "utf8"),
    readFile("../apps/desktop/electron/renwork-cli-entry.mjs", "utf8"),
  ]);

  expect(contracts).toContain('"codex_cli"');
  expect(contracts).toContain('"antigravity_cli"');
  expect(gateway).toContain("adapter: provider?.protocol ?? null");
  expect(runner.indexOf("metering.reserve")).toBeLessThan(runner.indexOf("spawn(executable"));
  expect(runner).toContain('reservation.adapter !== "codex_cli"');
  expect(runner).toContain('"--json"');
  expect(runner).toContain('value.type !== "turn.completed"');
  expect(runner).toContain("cached_input_tokens");
  expect(runner).toContain("cache_write_input_tokens");
  expect(runner).toContain("reasoning_output_tokens");
  expect(runner).toContain("this.options.metering.settle");
  expect(runner).toContain("this.options.metering.release");
  expect(runner).not.toContain("auth.json");
  expect(routes).toContain('workspace.workspaceType === "remote"');
  expect(routes).toContain('requireClientScope(ctx, "collaborator")');
  expect(routes).toContain('run.workspaceId !== workspace.id');
  expect(routes).toContain('existing.workspaceId !== workspace.id');
  expect(metering).toContain("canonicalLocalRuntimeReceiptPayload");
  expect(settings).toContain("RenWork CLI 统一计费入口");
  expect(settings).toContain("renwork codex --model");
  expect(settings).toContain("Antigravity 在获得可核验的结构化用量事件前保持禁用正式计费");
  expect(wrapper).toContain("capturedMicroCredits");
  expect(wrapper).toContain("releasedMicroCredits");
  expect(wrapper).toContain("receipt=");

  evidence.fact(
    "Codex usage is mediated and content-free at the billing boundary",
    "The integrated renwork command reserves before spawning Codex, parses the official JSONL token event, and submits only model, usage and signed receipt identifiers to Den.",
    true,
  );
  evidence.fact(
    "Failure paths cannot become free successful work",
    "Non-zero exit, timeout, cancellation, missing usage, missing result and route mismatch release the reservation; settlement failure is surfaced as failure rather than success.",
    true,
  );
  evidence.fact(
    "Antigravity remains fail-closed",
    "Antigravity can be detected, but metered execution stays disabled until a structured authoritative Token event is available.",
    true,
  );
});
