const LEGACY_RENWORK_TOOL_NAMES = {
  openwork_context: "renwork_context",
  openwork_query: "renwork_query",
  openwork_execute: "renwork_execute",
} as const;

export function migrateLegacyRenWorkToolNames(value: string): string {
  let migrated = value;
  for (const [legacyName, formalName] of Object.entries(LEGACY_RENWORK_TOOL_NAMES)) {
    migrated = migrated.replaceAll(legacyName, formalName);
  }
  return migrated;
}

export function migrateLegacyRenWorkToolReferences(value: unknown): unknown {
  if (typeof value === "string") return migrateLegacyRenWorkToolNames(value);
  if (Array.isArray(value)) return value.map(migrateLegacyRenWorkToolReferences);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, migrateLegacyRenWorkToolReferences(nested)]),
  );
}
