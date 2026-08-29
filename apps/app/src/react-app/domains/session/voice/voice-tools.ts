import type { OpenworkAffordanceRequest } from "@openwork/types/openwork-affordance";

export type RenWorkVoiceControl = {
  context: () => unknown;
  query: (request: OpenworkAffordanceRequest) => Promise<unknown>;
  command: (request: OpenworkAffordanceRequest) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function voiceAffordanceRequest(args: Record<string, unknown>): OpenworkAffordanceRequest | null {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!id) return null;
  return {
    id,
    ...(isRecord(args.args) ? { args: args.args } : {}),
    ...(typeof args.expectedRevision === "number" ? { expectedRevision: args.expectedRevision } : {}),
    actor: "renwork-voice",
  };
}

export async function executeRenWorkVoiceTool(
  control: RenWorkVoiceControl | undefined,
  name: string,
  args: Record<string, unknown>,
) {
  if (!control) return { ok: false, error: "RenWork control surface is not available." };
  if (name === "renwork_context") return { ok: true, context: control.context() };
  if (name === "renwork_query" || name === "renwork_execute") {
    const request = voiceAffordanceRequest(args);
    if (!request) return { ok: false, error: "Missing affordance id." };
    return name === "renwork_query" ? control.query(request) : control.command(request);
  }
  return { ok: false, error: `Unknown RenWork voice tool: ${name}` };
}
