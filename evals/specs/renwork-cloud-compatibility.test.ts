import { expect } from "vitest";
import { test } from "@openwork/testkit";

import { MCP_QUICK_CONNECT } from "../../apps/app/src/app/constants.js";
import {
  LEGACY_OPENWORK_CLOUD_MCP_NAME,
  RENWORK_CLOUD_EXPECTED_TOOLS,
  RENWORK_CLOUD_MCP_NAME,
  readRenworkCloudMcpEntry,
  writeRenworkCloudMcpEntry,
} from "../../apps/server/src/renwork-cloud-identity.js";

test("RenWork Cloud is canonical while one-release legacy state remains readable", async ({ evidence }) => {
  const cloudEntry = MCP_QUICK_CONNECT.find((entry) => entry.serverName === RENWORK_CLOUD_MCP_NAME);
  expect(cloudEntry?.managedBy).toBe("openwork-connect");
  expect(MCP_QUICK_CONNECT.some((entry) => entry.serverName === LEGACY_OPENWORK_CLOUD_MCP_NAME)).toBe(false);
  expect(RENWORK_CLOUD_EXPECTED_TOOLS).toEqual([
    "renwork-cloud_search_capabilities",
    "renwork-cloud_execute_capability",
  ]);

  const legacyConfig = { type: "remote", url: "https://legacy.example/mcp/agent" };
  expect(readRenworkCloudMcpEntry({ [LEGACY_OPENWORK_CLOUD_MCP_NAME]: legacyConfig })?.legacy).toBe(true);

  const migrated = writeRenworkCloudMcpEntry({
    [LEGACY_OPENWORK_CLOUD_MCP_NAME]: legacyConfig,
    github: { type: "remote", url: "https://github.example/mcp" },
  }, { type: "remote", url: "https://www.rrenn.com/api/den/mcp/agent" });
  expect(migrated[LEGACY_OPENWORK_CLOUD_MCP_NAME]).toBeUndefined();
  expect(migrated[RENWORK_CLOUD_MCP_NAME]).toBeDefined();
  expect(migrated.github).toBeDefined();

  evidence.fact(
    "RenWork Cloud owns all new MCP identity writes",
    "The catalog and projected tools use renwork-cloud, legacy openwork-cloud state is readable for one release, and migration removes only the legacy key while preserving unrelated MCP entries.",
    true,
  );
});
