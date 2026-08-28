import { describe, expect, test } from "bun:test";

import {
  migrateLegacyRenWorkToolNames,
  migrateLegacyRenWorkToolReferences,
} from "./renwork-tool-name-migration.js";

describe("RenWork tool name migration", () => {
  test("maps saved instructions to formal tool names", () => {
    const stored = "Use openwork_context, openwork_query, then openwork_execute.";
    expect(migrateLegacyRenWorkToolNames(stored)).toBe(
      "Use renwork_context, renwork_query, then renwork_execute.",
    );
    expect(stored).toContain("openwork_context");
  });

  test("maps historical tool parts without mutating the stored snapshot", () => {
    const stored = [{
      role: "assistant",
      parts: [{
        type: "tool",
        tool: "openwork_query",
        state: { status: "completed", output: "Called openwork_execute" },
      }],
    }];

    expect(migrateLegacyRenWorkToolReferences(stored)).toEqual([{
      role: "assistant",
      parts: [{
        type: "tool",
        tool: "renwork_query",
        state: { status: "completed", output: "Called renwork_execute" },
      }],
    }]);
    expect(stored[0]?.parts[0]?.tool).toBe("openwork_query");
  });
});
