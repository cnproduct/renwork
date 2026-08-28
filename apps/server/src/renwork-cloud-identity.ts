export const RENWORK_CLOUD_MCP_NAME = "renwork-cloud" as const;
export const LEGACY_OPENWORK_CLOUD_MCP_NAME = "openwork-cloud" as const;

export const RENWORK_CLOUD_EXPECTED_TOOLS = [
  `${RENWORK_CLOUD_MCP_NAME}_search_capabilities`,
  `${RENWORK_CLOUD_MCP_NAME}_execute_capability`,
] satisfies string[];

export const LEGACY_OPENWORK_CLOUD_EXPECTED_TOOLS = [
  `${LEGACY_OPENWORK_CLOUD_MCP_NAME}_search_capabilities`,
  `${LEGACY_OPENWORK_CLOUD_MCP_NAME}_execute_capability`,
] satisfies string[];

export type RenworkCloudMcpName =
  | typeof RENWORK_CLOUD_MCP_NAME
  | typeof LEGACY_OPENWORK_CLOUD_MCP_NAME;

export function isRenworkCloudMcpName(value: unknown): value is RenworkCloudMcpName {
  return value === RENWORK_CLOUD_MCP_NAME || value === LEGACY_OPENWORK_CLOUD_MCP_NAME;
}

/**
 * One-release compatibility read. New writes must always use
 * `RENWORK_CLOUD_MCP_NAME`; the legacy name is only accepted while restoring
 * pre-migration runtime state and sessions.
 */
export function readRenworkCloudMcpEntry(
  mcp: Record<string, Record<string, unknown>>,
): { name: RenworkCloudMcpName; config: Record<string, unknown>; legacy: boolean } | null {
  const current = mcp[RENWORK_CLOUD_MCP_NAME];
  if (current) return { name: RENWORK_CLOUD_MCP_NAME, config: current, legacy: false };
  const legacy = mcp[LEGACY_OPENWORK_CLOUD_MCP_NAME];
  return legacy
    ? { name: LEGACY_OPENWORK_CLOUD_MCP_NAME, config: legacy, legacy: true }
    : null;
}

export function withoutLegacyOpenworkCloudMcp(
  mcp: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const next = { ...mcp };
  delete next[LEGACY_OPENWORK_CLOUD_MCP_NAME];
  return next;
}

export function writeRenworkCloudMcpEntry(
  mcp: Record<string, Record<string, unknown>>,
  config: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  return {
    ...withoutLegacyOpenworkCloudMcp(mcp),
    [RENWORK_CLOUD_MCP_NAME]: config,
  };
}
