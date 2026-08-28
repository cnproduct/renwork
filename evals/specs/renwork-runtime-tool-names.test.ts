import { expect } from "vitest";
import { test } from "@openwork/testkit";

import { OpenWorkExtensionsPreview } from "../../apps/server/src/opencode-plugins/openwork-extensions-preview";

test("RenWork semantic tools hide legacy names behind migration", async ({ evidence }) => {
  const plugin = await OpenWorkExtensionsPreview();
  const toolNames = Object.keys(plugin.tool).sort();

  expect(toolNames).toEqual([
    "renwork_context",
    "renwork_execute",
    "renwork_query",
  ]);

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
  expect(instructions).not.toContain("Use openwork_context");

  evidence.fact(
    "RenWork is the primary semantic tool namespace",
    "The runtime exposes only renwork_context, renwork_query, and renwork_execute. Historical messages and saved instructions are migrated in memory from the three prior names before execution, without exposing those names in the new tool catalog.",
    true,
  );
});
