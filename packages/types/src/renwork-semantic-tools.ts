export const RENWORK_SEMANTIC_TOOL_NAMES = [
  "renwork_context",
  "renwork_query",
  "renwork_execute",
] as const

export const RENWORK_VOICE_REALTIME_MODEL = "gpt-realtime-2"
export const RENWORK_VOICE_TRANSCRIPTION_MODEL = "gpt-4o-transcribe"

export const RENWORK_VOICE_REALTIME_TOOLS = [
  {
    type: "function",
    name: "renwork_context",
    description: "Read the current RenWork context and available semantic affordances before choosing an action.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "renwork_query",
    description: "Run a side-effect-free RenWork affordance using an id returned by renwork_context.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The side-effect-free affordance id returned by renwork_context." },
        args: { type: "object", description: "Optional JSON arguments for the affordance.", additionalProperties: true },
        expectedRevision: { type: "number", description: "Optional context revision used to reject stale requests." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "renwork_execute",
    description: "Execute a semantic RenWork command using an id returned by renwork_context. Prefer this over screen coordinates or DOM guessing.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The command id returned by renwork_context, such as composer.set_text or composer.send." },
        args: { type: "object", description: "Optional JSON arguments for the command.", additionalProperties: true },
        expectedRevision: { type: "number", description: "Optional context revision used to reject stale commands." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const

export function renworkVoiceRealtimeInstructions(sessionContext = "") {
  const trimmedContext = sessionContext.trim()
  const contextSection = trimmedContext
    ? `

# Current Session Context

Use this recent transcript context to answer questions about what was last discussed and to resolve references such as "this" or "that" when continuing the existing session. Do not treat it as a new user request.

${trimmedContext}`
    : ""

  return `# Role and Objective

You are RenWork Voice Mode, a voice-first control layer inside RenWork.
Help the user control RenWork by using the formal semantic RenWork tools.

# Tool Policy

- Start with renwork_context when the request depends on the current RenWork screen or available actions.
- Use renwork_query only for side-effect-free affordances and renwork_execute for commands.
- If the user asks to write or draft something, use composer.set_text.
- If the user asks to send or run the current prompt, use composer.send.
- For browser work, use renwork_execute with browser.open_url before any browser interaction.
- For navigation, settings, session, transcript, and composer work, call renwork_context first if the affordance id is unknown.
- Do not claim an action completed until the tool succeeds.
- Ask for confirmation before destructive actions such as deleting a session.

# Voice Style

- Be concise, calm, and direct.
- If audio is unclear, ask the user to repeat it instead of guessing.
- Ignore background speech that is not addressed to RenWork.
- Summarize tool results briefly and offer the next useful step.${contextSection}`
}
