import { describe, expect, test } from "bun:test";
import type { DynamicToolUIPart } from "ai";

import { getCapabilityCallQuote, getCapabilityCallSentence } from "@/lib/capability-call";

function executeCapability(input: unknown): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolName: "openwork-cloud_execute_capability",
    toolCallId: "call_test",
    state: "output-error",
    input,
    errorText: "boom",
  } as DynamicToolUIPart;
}

function localRenWorkTool(toolName: string): DynamicToolUIPart {
  return {
    type: "dynamic-tool",
    toolName,
    toolCallId: "call_local_renwork",
    state: "output-available",
    input: {},
    output: { ok: true },
  } as DynamicToolUIPart;
}

describe("capability call sentences", () => {
  test("brands local RenWork tool activity without exposing legacy tool ids", () => {
    expect(getCapabilityCallSentence(localRenWorkTool("openwork_context"))).toMatchObject({
      service: "RenWork",
      present: "读取 RenWork 上下文",
      past: "读取 RenWork 上下文",
    });
    expect(getCapabilityCallSentence(localRenWorkTool("openwork_execute"))).toMatchObject({
      service: "RenWork",
      present: "执行 RenWork 操作",
      past: "执行 RenWork 操作",
    });
    expect(getCapabilityCallSentence(localRenWorkTool("openwork_query"))).toMatchObject({
      service: "RenWork",
      present: "查询 RenWork 数据",
      past: "查询 RenWork 数据",
    });
  });

  test("names an org MCP capability instead of falling back to 'a capability'", () => {
    const part = executeCapability({
      name: "mcp:emc_01kx2kfb42f6d94y1s1j992jhf:query_granola_meetings",
      body: '{"query": "action items from recent meetings"}',
    });

    const sentence = getCapabilityCallSentence(part);

    expect(sentence.past).toContain("Queried granola meetings");
    expect(sentence.present).toContain("Querying granola meetings");
    expect(sentence.past).not.toContain("a capability");
    // The opaque connection id never reaches the reader.
    expect(sentence.past).not.toContain("emc_01kx2kfb42f6d94y1s1j992jhf");
  });

  test("reads the ask out of a JSON-string body", () => {
    const part = executeCapability({
      name: "mcp:emc_01kx:query_granola_meetings",
      body: '{"query": "action items from recent meetings"}',
    });

    expect(getCapabilityCallQuote(part)).toBe("action items from recent meetings");
    expect(getCapabilityCallSentence(part).past).toContain("action items from recent meetings");
  });

  test("still reads the ask out of an object body", () => {
    const part = executeCapability({
      name: "mcp:emc_01kx:query_granola_meetings",
      body: { query: "yesterday's notes" },
    });

    expect(getCapabilityCallQuote(part)).toBe("yesterday's notes");
  });

  test("keeps naming dotted capabilities by service", () => {
    const part = executeCapability({ name: "granola.get_meetings" });
    const sentence = getCapabilityCallSentence(part);

    expect(sentence.service).toBe("Granola");
    expect(sentence.past).toContain("Fetched meetings");
  });

  test("falls back to a generic sentence only when the name is unusable", () => {
    expect(getCapabilityCallSentence(executeCapability({})).past).toBe("Ran a capability");
  });
});
