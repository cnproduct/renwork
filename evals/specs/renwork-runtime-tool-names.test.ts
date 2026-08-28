import { expect } from "vitest";
import { test } from "@openwork/testkit";

import { OpenWorkExtensionsPreview } from "../../apps/server/src/opencode-plugins/openwork-extensions-preview";

test("RenWork semantic tools use formal names with staged aliases", async ({ evidence }) => {
  const plugin = await OpenWorkExtensionsPreview();
  const toolNames = Object.keys(plugin.tool).sort();

  expect(toolNames).toEqual([
    "openwork_context",
    "openwork_execute",
    "openwork_query",
    "renwork_context",
    "renwork_execute",
    "renwork_query",
  ]);

  const system: string[] = [];
  await plugin["experimental.chat.system.transform"](undefined, { system });
  const instructions = system.join("\n");
  expect(instructions).toContain("Use renwork_context");
  expect(instructions).toContain("renwork_query");
  expect(instructions).toContain("renwork_execute");
  expect(instructions).not.toContain("Use openwork_context");

  evidence.fact(
    "RenWork is the primary semantic tool namespace",
    "The runtime registers renwork_context, renwork_query, and renwork_execute and steers new agent calls to them. The three OpenWork names remain compatibility aliases for saved sessions during the staged migration.",
    true,
  );
});
