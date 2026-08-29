import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

async function reservePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a local test port");
  }
  const { port } = address;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitUntilHealthy(baseUrl: string, process: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`Cloud API server exited before becoming healthy (${process.exitCode})`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The server can refuse connections briefly while Node starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Cloud API server did not become healthy in time");
}

async function stop(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => process.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
  ]);
  if (process.exitCode === null) process.kill("SIGKILL");
}

test("legacy public RenCredit routes are retired without exposing a default workspace", async ({ evidence }) => {
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["deploy/cloud-api-server/server.mjs"], {
    cwd: REPOSITORY_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  try {
    await waitUntilHealthy(baseUrl, child);

    for (const path of [
      "/api/v1/credits",
      "/api/v1/credits/",
      "/api/v1/credits/balance",
      "/api/v1/credits/ledger",
      "/api/v1/credits/unknown",
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      const body = await response.json();
      const serialized = JSON.stringify(body);

      expect(response.status, path).toBe(410);
      expect(response.headers.get("cache-control"), path).toContain("no-store");
      expect(body, path).toMatchObject({
        ok: false,
        error: "LEGACY_RENCREDIT_API_RETIRED",
        replacements: {
          wallet: "/api/den/v1/rencredit/wallet",
          ledger: "/api/den/v1/rencredit/ledger",
        },
      });
      expect(serialized, path).not.toContain("WS-DEFAULT-001");
      expect(serialized, path).not.toContain("remaining_credits");
    }

    const currentWallet = await fetch(`${baseUrl}/v1/rencredit/wallet`);
    expect(currentWallet.status).toBe(200);

    evidence.fact(
      "The unauthenticated legacy RenCredit API is closed",
      "Every /api/v1/credits/* route returns 410 with no-store and points callers to authenticated Den wallet and ledger routes without exposing default workspace data.",
      true,
    );
    evidence.fact(
      "Current RenCredit routing remains unchanged",
      "The existing /v1/rencredit/wallet route still responds, keeping this pull request limited to retiring the legacy public route family.",
      true,
    );
  } finally {
    await stop(child);
  }
});
