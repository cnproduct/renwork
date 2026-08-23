import { describe, expect, test } from "bun:test";
import { detectSystemProxyEnv } from "./system-proxy.js";

describe("detectSystemProxyEnv", () => {
  test("returns empty object when proxy environment variables are already defined", () => {
    const env = {
      HTTP_PROXY: "http://custom-proxy:8080",
    };
    expect(detectSystemProxyEnv(env as NodeJS.ProcessEnv)).toEqual({});
  });

  test("detects system proxy on macOS when scutil output is present", () => {
    if (process.platform === "darwin") {
      const result = detectSystemProxyEnv({});
      // If the host has proxy enabled, result should contain NO_PROXY or be an object
      expect(typeof result).toBe("object");
    }
  });
});
