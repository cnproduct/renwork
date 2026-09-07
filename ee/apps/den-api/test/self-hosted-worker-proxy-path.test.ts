import { describe, expect, test } from "bun:test"

import { resolveSelfHostedWorkerProxyPath } from "../src/workers/self-hosted-proxy-path.js"

describe("self-hosted worker proxy path", () => {
  test("preserves nested worker API paths", () => {
    expect(resolveSelfHostedWorkerProxyPath(
      "https://www.rrenn.com/v1/cloud/workers/wrk_01m1yx7gx1e3nrv9h44hed8vyq/opencode/config?refresh=1",
      "wrk_01m1yx7gx1e3nrv9h44hed8vyq",
    )).toBe("/opencode/config")
  })

  test("rejects a path for a different worker", () => {
    expect(resolveSelfHostedWorkerProxyPath(
      "https://www.rrenn.com/v1/cloud/workers/wrk_other/health",
      "wrk_expected",
    )).toBeNull()
  })
})
