import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import {
  RENWORK_SEMANTIC_TOOL_NAMES,
  RENWORK_VOICE_REALTIME_TOOLS,
  renworkVoiceRealtimeInstructions,
} from "../../packages/types/src/renwork-semantic-tools";

import { OpenWorkExtensionsPreview } from "../../apps/server/src/opencode-plugins/openwork-extensions-preview";
import { renderOpenWorkAutomationInstruction } from "../../apps/server/src/connect-automation-catalog";

test("RenWork semantic tool migration is complete", async ({ evidence }) => {
  const plugin = await OpenWorkExtensionsPreview();
  const toolNames = Object.keys(plugin.tool).sort();

  expect(toolNames).toEqual([
    "renwork_context",
    "renwork_execute",
    "renwork_query",
  ]);
  expect([...RENWORK_SEMANTIC_TOOL_NAMES].sort()).toEqual(toolNames);

  const system: string[] = [];
  await plugin["experimental.chat.system.transform"](undefined, { system });
  const instructions = system.join("\n");
  expect(instructions).toContain("Use renwork_context");
  expect(instructions).toContain("renwork_query");
  expect(instructions).toContain("renwork_execute");
  expect(instructions).toContain("renwork_execute id browser.open_url");

  const automationInstructions = renderOpenWorkAutomationInstruction({
    fetchedAt: Date.now(),
    total: 0,
    omitted: 0,
    automations: [],
  });
  expect(automationInstructions).toContain("renwork_execute id automation.propose");

  const voiceToolNames = RENWORK_VOICE_REALTIME_TOOLS.map((tool) => tool.name);
  const voiceInstructions = renworkVoiceRealtimeInstructions("User: Continue the current task.");
  expect(voiceToolNames).toEqual([
    "renwork_context",
    "renwork_query",
    "renwork_execute",
  ]);
  expect(voiceInstructions).toContain("RenWork Voice Mode");
  expect(voiceInstructions).toContain("renwork_execute with browser.open_url");

  const retiredToolNames = ["context", "query", "execute"].map((suffix) => ["openwork", suffix].join("_"));
  const runtimeFiles = [
    "../../apps/server/src/opencode-plugins/openwork-extensions-preview.ts",
    "../../apps/server/src/local-automations-scheduler.ts",
    "../../apps/desktop/electron/automation-runner.mjs",
    "../../apps/app/src/lib/capability-call.ts",
    "../../apps/app/src/components/tools/openwork-automation-proposal.tsx",
    "../../apps/app/src/react-app/domains/session/voice/voice-panel.tsx",
    "../../packages/types/src/renwork-semantic-tools.ts",
  ];
  for (const path of runtimeFiles) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    for (const retiredToolName of retiredToolNames) {
      expect(source).not.toContain(retiredToolName);
    }
  }

  evidence.fact(
    "RenWork is the only semantic tool namespace",
    "System prompts, plugins, Voice, browser control, Automations, and tests use renwork_context, renwork_query, and renwork_execute. The retired semantic aliases are no longer registered or migrated at runtime.",
    true,
  );
});
