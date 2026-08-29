import { describe, expect, test } from "bun:test";

import { executeRenWorkVoiceTool, type RenWorkVoiceControl } from "../src/react-app/domains/session/voice/voice-tools";

function voiceControl() {
  const calls: Array<{ kind: "query" | "command"; request: unknown }> = [];
  const control: RenWorkVoiceControl = {
    context: () => ({ revision: 7, availableAffordances: [{ id: "composer.send" }] }),
    query: async (request) => {
      calls.push({ kind: "query", request });
      return { ok: true, id: request.id };
    },
    command: async (request) => {
      calls.push({ kind: "command", request });
      return { ok: true, id: request.id };
    },
  };
  return { control, calls };
}

describe("RenWork Voice semantic tools", () => {
  test("reads context through renwork_context", async () => {
    const { control } = voiceControl();
    expect(await executeRenWorkVoiceTool(control, "renwork_context", {})).toEqual({
      ok: true,
      context: { revision: 7, availableAffordances: [{ id: "composer.send" }] },
    });
  });

  test("routes queries and commands through their semantic contracts", async () => {
    const { control, calls } = voiceControl();
    await executeRenWorkVoiceTool(control, "renwork_query", {
      id: "session.read",
      args: { sessionId: "ses_1" },
      expectedRevision: 7,
    });
    await executeRenWorkVoiceTool(control, "renwork_execute", {
      id: "composer.send",
      expectedRevision: 8,
    });
    expect(calls).toEqual([
      {
        kind: "query",
        request: {
          id: "session.read",
          args: { sessionId: "ses_1" },
          expectedRevision: 7,
          actor: "renwork-voice",
        },
      },
      {
        kind: "command",
        request: { id: "composer.send", expectedRevision: 8, actor: "renwork-voice" },
      },
    ]);
  });

  test("rejects missing ids and unknown tool names", async () => {
    const { control } = voiceControl();
    expect(await executeRenWorkVoiceTool(control, "renwork_execute", {})).toEqual({
      ok: false,
      error: "Missing affordance id.",
    });
    expect(await executeRenWorkVoiceTool(control, "renwork_unknown", {})).toEqual({
      ok: false,
      error: "Unknown RenWork voice tool: renwork_unknown",
    });
  });
});
