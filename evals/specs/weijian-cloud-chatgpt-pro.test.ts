import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { subscriptionCliModelForMember, subscriptionCliPolicySchema, writeSubscriptionCliPolicy } from "../../ee/apps/den-api/src/subscription-cli-policy";

const fakeCodex = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
if (args.includes("app-server")) {
  let buffer = "";
  const send = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
  process.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    let cut;
    while ((cut = buffer.indexOf("\\n")) >= 0) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.method === "initialize") send({ id: message.id, result: {} });
      if (message.method === "account/login/start") {
        send({ id: message.id, result: {
          type: "chatgptDeviceCode", loginId: "login-1",
          verificationUrl: "https://auth.openai.com/codex/device", userCode: "TEST-1234"
        } });
        setTimeout(() => {
          fs.writeFileSync(path.join(process.env.CODEX_HOME, "auth.json"), JSON.stringify({ refresh_token: "fake-refresh-secret" }));
          send({ method: "account/login/completed", params: { loginId: "login-1", success: true } });
        }, 150);
      }
      if (message.method === "account/read") send({ id: message.id, result: {
        account: { type: "chatgpt", planType: "pro", email: "owner@example.com" }
      } });
      if (message.method === "model/list") send({ id: message.id, result: {
        data: [{ id: "gpt-5.6-sol", model: "gpt-5.6-sol" }]
      } });
    }
  });
} else if (args.includes("exec")) {
  if (!fs.existsSync(path.join(process.env.CODEX_HOME, "auth.json"))) process.exit(2);
  process.stdin.resume();
  process.stdin.on("end", () => {
    process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "test-thread" }) + "\\n");
    process.stdout.write(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "云端任务完成" } }) + "\\n");
    process.stdout.write(JSON.stringify({ type: "turn.completed", usage: {
      input_tokens: 100, cached_input_tokens: 20, cache_write_input_tokens: 5,
      output_tokens: 40, reasoning_output_tokens: 10, total_tokens: 140
    } }) + "\\n");
  });
}
`;

async function freePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  await new Promise<void>((done) => listener.close(() => done()));
  return address.port;
}

test("weijian cloud device authorization stores only sealed credentials and reports metered GPT-5.6 usage", async ({ evidence }) => {
  const policy = subscriptionCliPolicySchema.parse({
    enabled: true,
    expiresAt: "2026-10-17T13:00:00.000Z",
    allowedMemberIds: ["member_weijian"],
    models: [{
      sku: "renwork-codex-gpt-5-6-sol", runtime: "codex", upstreamModelId: "gpt-5.6-sol",
      displayName: "GPT-5.6 Sol", multiplierBps: 10_000,
      rates: {
        inputMicroCreditsPerMillion: 1_000_000, outputMicroCreditsPerMillion: 3_000_000,
        reasoningMicroCreditsPerMillion: 3_000_000, cacheReadMicroCreditsPerMillion: 200_000,
        cacheWriteMicroCreditsPerMillion: 1_250_000,
      },
    }],
  });
  const authorized = {
    organizationId: "org_weijian", organizationName: "weijian", pilotOrganizationId: "org_weijian",
    metadata: writeSubscriptionCliPolicy({}, policy), memberId: "member_weijian",
    modelSku: "renwork-codex-gpt-5-6-sol", now: new Date("2026-09-20T00:00:00Z"),
  };
  expect(subscriptionCliModelForMember(authorized)?.model.routes[0]?.upstreamModelId).toBe("gpt-5.6-sol");
  expect(subscriptionCliModelForMember({ ...authorized, organizationId: "org_other" })).toBeNull();
  expect(subscriptionCliModelForMember({ ...authorized, memberId: "member_other" })).toBeNull();
  expect(subscriptionCliModelForMember({ ...authorized, now: new Date("2026-10-18T00:00:00Z") })).toBeNull();
  const root = await mkdtemp(join(tmpdir(), "weijian-cloud-test-"));
  const binary = join(root, "fake-codex.cjs");
  const vault = join(root, "vault", "auth.enc");
  await writeFile(binary, fakeCodex);
  await chmod(binary, 0o755);
  const port = await freePort();
  const token = "test-internal-token";
  const child = spawn(process.execPath, [resolve("..", "ee/apps/weijian-codex-worker/server.mjs")], {
    env: {
      ...process.env,
      PORT: String(port),
      RENWORK_CODEX_WORKER_TOKEN: token,
      RENWORK_CODEX_VAULT_KEY: "test-vault-key-value-1234567890123456789",
      RENWORK_CODEX_VAULT_FILE: vault,
      RENWORK_CODEX_TMP_ROOT: join(root, "sessions"),
      RENWORK_CODEX_BIN: binary,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const base = `http://127.0.0.1:${port}`;
  const request = (path: string, method = "GET", body?: object) => fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch(`${base}/health`)).ok; } catch { /* startup */ }
      if (ready) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    expect(ready).toBe(true);
    expect((await fetch(`${base}/status`)).status).toBe(401);
    const start = await request("/login/start", "POST");
    expect(start.status).toBe(200);
    expect(await start.json()).toMatchObject({
      state: "pending", userCode: "TEST-1234",
      verificationUrl: "https://auth.openai.com/codex/device",
    });
    let state = "pending";
    for (let i = 0; i < 40 && state === "pending"; i++) {
      await new Promise((done) => setTimeout(done, 50));
      const status = await (await request("/login/poll")).json();
      state = status.state;
    }
    expect(state).toBe("connected");
    const sealed = await readFile(vault, "utf8");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed.includes("fake-refresh-secret")).toBe(false);
    const run = await request("/run", "POST", { prompt: "请总结本周工作" });
    expect(run.status).toBe(200);
    expect(await run.json()).toMatchObject({
      text: "云端任务完成", model: "gpt-5.6-sol",
      usage: { inputTokens: 75, outputTokens: 30, reasoningTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 5 },
    });
    expect((await request("/disconnect", "POST")).status).toBe(200);
    expect(await (await request("/status")).json()).toMatchObject({ state: "disconnected" });
    await writeFile(binary, fakeCodex.replace('planType: "pro"', 'planType: "plus"'));
    expect((await request("/login/start", "POST")).status).toBe(200);
    let rejected = false;
    for (let i = 0; i < 40 && !rejected; i++) {
      await new Promise((done) => setTimeout(done, 50));
      rejected = (await (await request("/login/poll")).json()).state === "error";
    }
    expect(rejected).toBe(true);
    expect(await readFile(vault, "utf8").catch(() => null)).toBeNull();
    evidence.fact("OpenAI device authorization requires the owner to finish the external login", "The worker returns a device code and does not ask RenWork for an account password.", true);
    evidence.fact("Cloud subscription credentials remain inside the isolated encrypted worker vault", "The stored vault does not contain the fake refresh token in plaintext and disconnect removes it.", true);
    evidence.fact("GPT-5.6 cloud usage is split into RenCredit token categories", "The final structured CLI event separates cached input, cache writes and reasoning output without double counting.", true);
    evidence.fact("Cloud GPT-5.6 is restricted to the authorized weijian member", "The grant denies a different organization, a different member, and an expired policy.", true);
    evidence.fact("A non-Pro ChatGPT login cannot activate the cloud worker", "A Plus account completes device authorization, but the worker rejects it and saves no credential.", true);
  } finally {
    child.kill("SIGTERM");
    await rm(root, { recursive: true, force: true });
  }
});
