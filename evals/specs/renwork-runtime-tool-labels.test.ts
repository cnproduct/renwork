import { expect } from "vitest";
import { test } from "@openwork/testkit";
import type { DynamicToolUIPart } from "ai";

import { getCapabilityCallSentence } from "../../apps/app/src/lib/capability-call";

function completedTool(toolName: string): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolName,
    toolCallId: `call_${toolName}`,
    state: "output-available",
    input: {},
    output: { ok: true },
  } as DynamicToolUIPart;
}

test("local runtime activity is presented as RenWork", async ({ evidence }) => {
  const labels = [
    getCapabilityCallSentence(completedTool("renwork_context")).past,
    getCapabilityCallSentence(completedTool("renwork_execute")).past,
    getCapabilityCallSentence(completedTool("renwork_query")).past,
  ];

  expect(labels).toEqual([
    "读取 RenWork 上下文",
    "执行 RenWork 操作",
    "查询 RenWork 数据",
  ]);
  expect(labels.join(" ")).not.toMatch(/OpenWork/i);

  evidence.fact(
    "RenWork runtime records do not expose the legacy OpenWork tool brand",
    "The formal renwork_context, renwork_execute, and renwork_query tools render the three approved RenWork labels after the compatibility aliases are retired.",
    true,
  );
});
