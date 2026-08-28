import { describe, expect, test } from "bun:test";

import { MCP_QUICK_CONNECT } from "../src/app/constants";

describe("built-in RenWork MCP visibility", () => {
  test("advertises only the canonical RenWork Cloud MCP while retaining other hidden internals", () => {
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "renwork-cloud")?.defaultHidden).toBe(true);
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "openwork-cloud")).toBeUndefined();
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "openwork-admin")).toBeUndefined();
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "openwork-ui")?.defaultHidden).toBe(true);
  });

  test("keeps directory apps visible by default", () => {
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "notion")?.defaultHidden).toBeUndefined();
    expect(MCP_QUICK_CONNECT.find((entry) => entry.serverName === "linear")?.defaultHidden).toBeUndefined();
  });
});
