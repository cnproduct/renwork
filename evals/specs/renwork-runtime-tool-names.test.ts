import { expect } from "vitest";
import { test } from "@openwork/testkit";
import {
  RENWORK_SEMANTIC_TOOL_NAMES,
  RENWORK_VOICE_REALTIME_TOOLS,
  renworkVoiceRealtimeInstructions,
} from "../../packages/types/src/renwork-semantic-tools";

import { OpenWorkExtensionsPreview } from "../../apps/server/src/opencode-plugins/openwork-extensions-preview";
import { renderOpenWorkAutomationInstruction } from "../../apps/server/src/connect-automation-catalog";

test("RenWork semantic tools hide legacy names behind migration", async ({ evidence }) => {
  const plugin = await OpenWorkExtensionsPreview();
  const toolNames = Object.keys(plugin.tool).sort();

  expect(toolNames).toEqual([
    "renwork_context",
    "renwork_execute",
    "renwork_query",
  ]);
  expect([...RENWORK_SEMANTIC_TOOL_NAMES].sort()).toEqual(toolNames);

  const messages = [{
    role: "user",
    parts: [{ type: "text", text: "Call openwork_context then openwork_execute." }],
  }];
  await plugin["experimental.chat.messages.transform"](undefined, { messages });
  expect(messages).toEqual([{
    role: "user",
    parts: [{ type: "text", text: "Call renwork_context then renwork_execute." }],
  }]);

  const system: string[] = [];
  await plugin["experimental.chat.system.transform"](undefined, { system });
  const instructions = system.join("\n");
  expect(instructions).toContain("Use renwork_context");
  expect(instructions).toContain("renwork_query");
  expect(instructions).toContain("renwork_execute");
  expect(instructions).toContain("renwork_execute id browser.open_url");
  expect(instructions).not.toContain("Use openwork_context");

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

  evidence.fact(
    "RenWork is the primary semantic tool namespace",
    "System prompts, plugins, Voice, browser control, and Automations all use renwork_context, renwork_query, and renwork_execute. Historical messages and saved instructions are migrated in memory from the three prior names without exposing them in the new tool catalog.",
    true,
  );
});
