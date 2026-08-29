import { describe, expect, test } from "bun:test";

import {
  LEGACY_OPENWORK_CLOUD_MCP_NAME,
  RENWORK_CLOUD_EXPECTED_TOOLS,
  RENWORK_CLOUD_MCP_NAME,
  readRenworkCloudMcpEntry,
  writeRenworkCloudMcpEntry,
} from "./renwork-cloud-identity.js";

describe("RenWork Cloud identity migration", () => {
  test("prefers the canonical entry and reads the legacy entry for one release", () => {
    const legacyConfig = { type: "remote", url: "https://legacy.example/mcp/agent" };
    const currentConfig = { type: "remote", url: "https://rrenn.com/api/den/mcp/agent" };

    expect(readRenworkCloudMcpEntry({ [LEGACY_OPENWORK_CLOUD_MCP_NAME]: legacyConfig })).toEqual({
      name: LEGACY_OPENWORK_CLOUD_MCP_NAME,
      config: legacyConfig,
      legacy: true,
    });
    expect(readRenworkCloudMcpEntry({
      [LEGACY_OPENWORK_CLOUD_MCP_NAME]: legacyConfig,
      [RENWORK_CLOUD_MCP_NAME]: currentConfig,
    })).toEqual({
      name: RENWORK_CLOUD_MCP_NAME,
      config: currentConfig,
      legacy: false,
    });
  });

  test("new writes remove the legacy key and expose only RenWork tool IDs", () => {
    const config = { type: "remote", url: "https://rrenn.com/api/den/mcp/agent" };
    const migrated = writeRenworkCloudMcpEntry({
      [LEGACY_OPENWORK_CLOUD_MCP_NAME]: { type: "remote", url: "https://legacy.example/mcp/agent" },
      github: { type: "remote", url: "https://github.example/mcp" },
    }, config);

    expect(migrated[LEGACY_OPENWORK_CLOUD_MCP_NAME]).toBeUndefined();
    expect(migrated[RENWORK_CLOUD_MCP_NAME]).toBe(config);
    expect(migrated.github).toBeDefined();
    expect(RENWORK_CLOUD_EXPECTED_TOOLS).toEqual([
      "renwork-cloud_search_capabilities",
      "renwork-cloud_execute_capability",
    ]);
  });
});
