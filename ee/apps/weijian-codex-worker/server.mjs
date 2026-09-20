import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const token = required("RENWORK_CODEX_WORKER_TOKEN");
const vaultSecret = required("RENWORK_CODEX_VAULT_KEY");
if (vaultSecret.length < 32) throw new Error("RENWORK_CODEX_VAULT_KEY must have at least 32 characters");
const vaultFile = process.env.RENWORK_CODEX_VAULT_FILE || "/data/auth.enc";
const temporaryRoot = process.env.RENWORK_CODEX_TMP_ROOT || "/run/codex";
const codexBin = process.env.RENWORK_CODEX_BIN || "/app/node_modules/.bin/codex";
const key = scryptSync(vaultSecret, "renwork-weijian-codex-v1", 32);
const port = Number(process.env.PORT || "8795");
const model = "gpt-5.6-sol";
let pending = null;
let running = false;
let statusCache = null;

export function sealAuth(plaintext, secretKey = key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function openAuth(sealed, secretKey = key) {
  const [version, iv, tag, ciphertext, extra] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Invalid credential vault");
  const decipher = createDecipheriv("aes-256-gcm", secretKey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function saveAuth(home) {
  const value = await readFile(join(home, "auth.json"), "utf8");
  if (!value || !JSON.parse(value)) throw new Error("Codex did not save an account");
  await mkdir(dirname(vaultFile), { recursive: true, mode: 0o700 });
  const candidate = `${vaultFile}.${randomBytes(8).toString("hex")}`;
  await writeFile(candidate, sealAuth(value), { mode: 0o600 });
  await rename(candidate, vaultFile);
}

async function createHome(restore = false) {
  await mkdir(temporaryRoot, { recursive: true, mode: 0o700 });
  const home = await mkdtemp(join(temporaryRoot, "session-"));
  if (restore) {
    const saved = await readFile(vaultFile, "utf8");
    await writeFile(join(home, "auth.json"), openAuth(saved), { mode: 0o600 });
  }
  return home;
}

function codexEnvironment(home) {
  return {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: home,
    CODEX_HOME: home,
    TMPDIR: temporaryRoot,
    LANG: "C.UTF-8",
    TERM: "dumb",
  };
}

class AppServer {
  constructor(home) {
    this.child = spawn(codexBin, ["-c", 'cli_auth_credentials_store="file"', "app-server"], {
      env: codexEnvironment(home),
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.buffer = "";
    this.nextId = 1;
    this.waiting = new Map();
    this.notifications = new Set();
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk;
      let cut;
      while ((cut = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, cut);
        this.buffer = this.buffer.slice(cut + 1);
        try { this.accept(JSON.parse(line)); } catch { /* Codex logs are not protocol messages. */ }
      }
    });
    this.child.stderr.resume();
    this.child.on("error", () => {
      for (const waiter of this.waiting.values()) waiter.reject(new Error("Codex app server could not start"));
      this.waiting.clear();
    });
    this.child.on("exit", () => {
      for (const waiter of this.waiting.values()) waiter.reject(new Error("Codex app server stopped"));
      this.waiting.clear();
    });
  }

  accept(message) {
    if (typeof message.id === "number" && this.waiting.has(message.id)) {
      const waiter = this.waiting.get(message.id);
      this.waiting.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new Error("Codex app server request failed"));
      else waiter.resolve(message.result);
      return;
    }
    if (typeof message.method === "string") {
      for (const listener of this.notifications) listener(message);
    }
  }

  request(method, params = {}, timeoutMs = 15000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error("Codex app server request timed out"));
      }, timeoutMs);
      this.waiting.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(JSON.stringify({ method, params }) + "\n");
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "renwork_cloud", title: "RenWork Cloud", version: "1.0.0" },
      capabilities: {},
    });
    this.notify("initialized");
  }

  close() {
    this.child.kill("SIGTERM");
  }
}

async function connectedStatus() {
  if (statusCache && statusCache.expiresAt > Date.now()) return statusCache.value;
  let home;
  let server;
  try {
    home = await createHome(true);
    server = new AppServer(home);
    await server.initialize();
    const account = await server.request("account/read", { refreshToken: true });
    const models = await server.request("model/list", { limit: 100, includeHidden: false });
    const valid = account?.account?.type === "chatgpt" && account.account.planType === "pro"
      && models?.data?.some((item) => item.model === model || item.id === model);
    const value = valid
      ? { state: "connected", planType: "pro", model, email: account.account.email || null }
      : { state: "disconnected" };
    statusCache = { value, expiresAt: Date.now() + 60_000 };
    return value;
  } catch {
    return { state: "disconnected" };
  } finally {
    server?.close();
    if (home) await rm(home, { recursive: true, force: true });
  }
}

async function startLogin() {
  if (pending?.state === "pending") return pending.public;
  if ((await connectedStatus()).state === "connected") return await connectedStatus();
  const home = await createHome();
  const server = new AppServer(home);
  try {
    await server.initialize();
    const result = await server.request("account/login/start", { type: "chatgptDeviceCode" });
    if (result?.type !== "chatgptDeviceCode" || !result.loginId || !result.verificationUrl || !result.userCode) {
      throw new Error("Codex did not return a device code");
    }
    const publicStatus = {
      state: "pending", loginId: result.loginId,
      verificationUrl: result.verificationUrl, userCode: result.userCode,
    };
    pending = { state: "pending", public: publicStatus, server, home };
    const timeout = setTimeout(() => {
      if (pending?.server === server) pending = { state: "expired" };
      server.close();
      void rm(home, { recursive: true, force: true });
    }, 10 * 60_000);
    server.notifications.add((message) => {
      if (message.method !== "account/login/completed" || message.params?.loginId !== result.loginId) return;
      clearTimeout(timeout);
      void (async () => {
        try {
          if (message.params?.success !== true) throw new Error("OpenAI authorization did not complete");
          const account = await server.request("account/read", { refreshToken: false });
          if (account?.account?.type !== "chatgpt" || account.account.planType !== "pro") {
            throw new Error("The connected ChatGPT account is not Pro");
          }
          const models = await server.request("model/list", { limit: 100, includeHidden: false });
          if (!models?.data?.some((item) => item.model === model || item.id === model)) {
            throw new Error("GPT-5.6 Sol is unavailable for this account");
          }
          await saveAuth(home);
          statusCache = { value: { state: "connected", planType: "pro", model, email: account.account.email || null }, expiresAt: Date.now() + 60_000 };
          pending = {
            state: "connected",
            email: typeof account.account.email === "string" ? account.account.email : null,
          };
        } catch (error) {
          pending = { state: "error", message: error instanceof Error ? error.message : "Authorization failed" };
        } finally {
          server.close();
          await rm(home, { recursive: true, force: true });
        }
      })();
    });
    return publicStatus;
  } catch (error) {
    server.close();
    await rm(home, { recursive: true, force: true });
    throw error;
  }
}

function normalizeUsage(raw) {
  if (!raw || !["input_tokens", "output_tokens", "cached_input_tokens", "reasoning_output_tokens"]
    .every((name) => Number.isSafeInteger(raw[name]) && raw[name] >= 0)) return null;
  const cacheWrite = raw.cache_write_input_tokens ?? 0;
  if (!Number.isSafeInteger(cacheWrite) || cacheWrite < 0
    || raw.cached_input_tokens + cacheWrite > raw.input_tokens
    || raw.reasoning_output_tokens > raw.output_tokens
    || (raw.total_tokens !== undefined && raw.total_tokens !== raw.input_tokens + raw.output_tokens)) return null;
  return {
    inputTokens: raw.input_tokens - raw.cached_input_tokens - cacheWrite,
    outputTokens: raw.output_tokens - raw.reasoning_output_tokens,
    reasoningTokens: raw.reasoning_output_tokens,
    cacheReadTokens: raw.cached_input_tokens,
    cacheWriteTokens: cacheWrite,
  };
}

export { normalizeUsage };

async function runTask(prompt) {
  if (running) throw new Error("A Codex task is already running");
  running = true;
  let home;
  let child;
  try {
    home = await createHome(true);
    child = spawn(codexBin, [
      "-c", 'cli_auth_credentials_store="file"', "exec", "--json", "--ephemeral",
      "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
      "--sandbox", "read-only", "--model", model, "--cd", home, "-",
    ], { env: codexEnvironment(home), stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    let responseText = "";
    let usage = null;
    let threadId = null;
    let failed = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), 10 * 60_000);
    const completion = new Promise((resolve, reject) => {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        buffer += chunk;
        let cut;
        while ((cut = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 1);
          let event;
          try { event = JSON.parse(line); } catch { continue; }
          if (event.type === "thread.started" && typeof event.thread_id === "string") threadId = event.thread_id;
          if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") responseText = event.item.text;
          if (event.type === "turn.completed") usage = normalizeUsage(event.usage);
          if (event.type === "turn.failed" || event.type === "error") failed = true;
        }
      });
      child.stderr.resume();
      child.on("error", reject);
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0 || failed || !responseText || !usage || !threadId) reject(new Error("Codex task failed or did not report complete usage"));
        else resolve({ text: responseText, usage, threadId, model });
      });
    });
    child.stdin.end(prompt);
    const result = await completion;
    await saveAuth(home);
    statusCache = null;
    return result;
  } finally {
    if (child && child.exitCode === null) child.kill("SIGTERM");
    if (home) await rm(home, { recursive: true, force: true });
    running = false;
  }
}

async function bodyJson(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk.toString();
    if (text.length > 65536) throw new Error("Request body too large");
  }
  return text ? JSON.parse(text) : {};
}

function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  if (request.url === "/health") return json(response, 200, { ok: true });
  const authorization = request.headers.authorization?.replace(/^Bearer /, "") || "";
  const received = Buffer.from(authorization);
  const expected = Buffer.from(token);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return json(response, 401, { error: "unauthorized" });
  }
  try {
    if (request.method === "GET" && request.url === "/status") {
      const status = await connectedStatus();
      return json(response, 200, pending?.state === "pending" ? pending.public : { ...status, email: pending?.email || null });
    }
    if (request.method === "POST" && request.url === "/login/start") return json(response, 200, await startLogin());
    if (request.method === "GET" && request.url === "/login/poll") {
      return json(response, 200, pending?.state === "pending" ? pending.public : pending || await connectedStatus());
    }
    if (request.method === "POST" && request.url === "/disconnect") {
      pending?.server?.close();
      pending = null;
      statusCache = null;
      await rm(vaultFile, { force: true });
      return json(response, 200, { state: "disconnected" });
    }
    if (request.method === "POST" && request.url === "/run") {
      if ((await connectedStatus()).state !== "connected") return json(response, 409, { error: "not_connected" });
      const body = await bodyJson(request);
      if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 50000) {
        return json(response, 400, { error: "invalid_prompt" });
      }
      return json(response, 200, await runTask(body.prompt));
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    return json(response, 503, { error: "worker_failed", message });
  }
});

server.listen(port, "0.0.0.0");
