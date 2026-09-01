import { platform } from "node:os";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { openworkEnvStorePath } from "@openwork/paths";

import { ensureDir, exists } from "./utils.js";

// User-level environment variables, persisted so the desktop shell can inject
// them into every spawned child (OpenCode and OpenWork server).
// Motivation: Linux GUI launches don't inherit shell env, so users set
// ANTHROPIC_API_KEY / GCLOUD_* / GCP_* in .bashrc and hit silent auth failures.
// Scope: user/machine, not workspace. Not synced to the cloud.

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Keys reserved for internal wiring by the desktop shell and server. This UI
// is for service credentials, not OpenWork/OpenCode runtime knobs; users who
// need OPENCODE_* process settings should set them from the launching shell.
// We refuse writes to these and strip them when reading for injection, so a
// tampered file cannot shadow auth credentials, token paths, or process
// identity.
const RESERVED_PREFIXES = ["OPENWORK_", "OPENCODE_"] as const;
const PERSISTABLE_INTERNAL_KEYS = new Set([
  "OPENWORK_API_KEY",
  "OPENWORK_MODELS_API_KEY",
  "OPENWORK_INFERENCE_BASE_URL",
  "OPENWORK_MODELS_BASE_URL",
]);

export type EnvRecord = {
  key: string;
  value: string;
  updatedAt: number;
};

type EnvVaultKeyProvider = () => Promise<Uint8Array>;

type EnvVaultEnvelope = {
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  data: string;
};

type StoredEnvRecord = {
  key: string;
  value?: string;
  encryptedValue?: EnvVaultEnvelope;
  updatedAt: number;
};

type EnvStoreFile = {
  schemaVersion: number;
  updatedAt: number;
  variables: StoredEnvRecord[];
};

const ENV_VAULT_AAD = Buffer.from("renwork-user-env-v2", "utf8");

export function isValidEnvKey(key: string): boolean {
  return ENV_KEY_PATTERN.test(key);
}

export function isReservedEnvKey(key: string): boolean {
  return isInternalEnvKey(key) && !PERSISTABLE_INTERNAL_KEYS.has(key);
}

function isInternalEnvKey(key: string): boolean {
  return RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function resolveDefaultEnvStorePath(): string {
  return openworkEnvStorePath();
}

function isVaultEnvelope(raw: unknown): raw is EnvVaultEnvelope {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const record = raw as Partial<EnvVaultEnvelope>;
  return record.algorithm === "aes-256-gcm"
    && typeof record.iv === "string"
    && typeof record.tag === "string"
    && typeof record.data === "string";
}

function parseStoredRecord(raw: unknown): StoredEnvRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Partial<StoredEnvRecord>;
  const key = typeof record.key === "string" ? record.key : "";
  if (!isValidEnvKey(key)) return null;
  const value = typeof record.value === "string" ? record.value : undefined;
  const encryptedValue = isVaultEnvelope(record.encryptedValue) ? record.encryptedValue : undefined;
  if (value === undefined && encryptedValue === undefined) return null;
  return {
    key,
    ...(value !== undefined ? { value } : {}),
    ...(encryptedValue ? { encryptedValue } : {}),
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  };
}

function emptyStore(): EnvStoreFile {
  return { schemaVersion: 1, updatedAt: Date.now(), variables: [] };
}

async function readStore(
  path: string,
  options: { tolerateInvalid?: boolean; vaultKey?: Buffer | null } = {},
): Promise<{ store: EnvStoreFile; variables: EnvRecord[]; hasLegacyPlaintext: boolean }> {
  if (!(await exists(path))) {
    return { store: emptyStore(), variables: [], hasLegacyPlaintext: false };
  }
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return { store: emptyStore(), variables: [], hasLegacyPlaintext: false };
    }
    if (options.tolerateInvalid) return { store: emptyStore(), variables: [], hasLegacyPlaintext: false };
    throw new EnvStoreReadError("Environment variable store could not be read");
  }

  let parsed: Partial<EnvStoreFile>;
  try {
    parsed = JSON.parse(raw) as Partial<EnvStoreFile>;
  } catch {
    if (options.tolerateInvalid) return { store: emptyStore(), variables: [], hasLegacyPlaintext: false };
    throw new EnvStoreReadError("Environment variable store is invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.variables)) {
    if (options.tolerateInvalid) return { store: emptyStore(), variables: [], hasLegacyPlaintext: false };
    throw new EnvStoreReadError("Environment variable store has an invalid format");
  }

  const storedVariables = parsed.variables
    .map(parseStoredRecord)
    .filter((entry): entry is StoredEnvRecord => Boolean(entry));
  const variables: EnvRecord[] = [];
  let hasLegacyPlaintext = false;
  for (const entry of storedVariables) {
    if (typeof entry.value === "string") {
      hasLegacyPlaintext = true;
      variables.push({ key: entry.key, value: entry.value, updatedAt: entry.updatedAt });
      continue;
    }
    if (!entry.encryptedValue || !options.vaultKey) {
      if (options.tolerateInvalid) continue;
      throw new EnvStoreReadError("Secure environment variable storage is unavailable");
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        options.vaultKey,
        Buffer.from(entry.encryptedValue.iv, "base64"),
      );
      decipher.setAAD(ENV_VAULT_AAD);
      decipher.setAuthTag(Buffer.from(entry.encryptedValue.tag, "base64"));
      const value = Buffer.concat([
        decipher.update(Buffer.from(entry.encryptedValue.data, "base64")),
        decipher.final(),
      ]).toString("utf8");
      variables.push({ key: entry.key, value, updatedAt: entry.updatedAt });
    } catch {
      if (options.tolerateInvalid) continue;
      throw new EnvStoreReadError("Environment variable store could not be decrypted");
    }
  }
  const store: EnvStoreFile = {
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 1,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    variables: storedVariables,
  };
  return { store, variables, hasLegacyPlaintext };
}

function encryptValue(value: string, key: Buffer): EnvVaultEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENV_VAULT_AAD);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

async function writeStore(path: string, variables: EnvRecord[], vaultKey?: Buffer | null): Promise<void> {
  const dir = dirname(path);
  await ensureDir(dir);
  const payload: EnvStoreFile = {
    schemaVersion: vaultKey ? 2 : 1,
    updatedAt: Date.now(),
    variables: variables.map((entry) => ({
      key: entry.key,
      updatedAt: entry.updatedAt,
      ...(vaultKey
        ? { encryptedValue: encryptValue(entry.value, vaultKey) }
        : { value: entry.value }),
    })),
  };
  const tempPath = join(
    dir,
    `.env.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  await writeFile(tempPath, JSON.stringify(payload, null, 2) + "\n", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  try {
    await chmod(tempPath, 0o600);
  } catch (error) {
    // chmod is a no-op on Windows; values may still contain secrets.
    if (platform() !== "win32") {
      await rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }
  try {
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
  try {
    await chmod(path, 0o600);
  } catch (error) {
    // chmod is a no-op on Windows; values may still contain secrets.
    if (platform() !== "win32") throw error;
  }
}

export type EnvEntry = { key: string; value: string };

export class EnvService {
  private readonly path: string;
  private readonly vaultKeyProvider?: EnvVaultKeyProvider;
  private resolvedVaultKey: Promise<Buffer | null> | null = null;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();
  private variables: EnvRecord[] = [];

  constructor(options?: { path?: string; vaultKey?: EnvVaultKeyProvider }) {
    this.path = options?.path ? resolve(options.path) : resolveDefaultEnvStorePath();
    this.vaultKeyProvider = options?.vaultKey;
  }

  private vaultKey(): Promise<Buffer | null> {
    if (!this.resolvedVaultKey) {
      this.resolvedVaultKey = (async () => {
        if (this.vaultKeyProvider) {
          const key = Buffer.from(await this.vaultKeyProvider());
          if (key.byteLength !== 32) throw new EnvStoreReadError("Secure environment variable key is invalid");
          return key;
        }
        const configured = process.env.OPENWORK_ENCRYPTION_KEY?.trim();
        return configured ? createHash("sha256").update(configured).digest() : null;
      })();
    }
    return this.resolvedVaultKey;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = this.vaultKey()
        .then(async (vaultKey) => {
          const result = await readStore(this.path, { vaultKey });
          this.variables = result.variables;
          if (vaultKey && result.hasLegacyPlaintext) {
            await writeStore(this.path, this.variables, vaultKey);
          }
          this.loaded = true;
        })
        .finally(() => {
          this.loadPromise = null;
        });
    }
    await this.loadPromise;
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.catch(() => {}).then(operation);
    this.mutationQueue = run.then(
      () => {},
      () => {},
    );
    return run;
  }

  async list(): Promise<EnvRecord[]> {
    await this.ensureLoaded();
    return this.variables.slice();
  }

  async upsertMany(entries: EnvEntry[]): Promise<void> {
    return this.enqueueMutation(async () => {
      await this.ensureLoaded();
      const now = Date.now();
      const next = new Map(this.variables.map((entry) => [entry.key, entry] as const));
      for (const entry of entries) {
        if (!isValidEnvKey(entry.key)) {
          throw new InvalidEnvKeyError(entry.key, "invalid_env_key");
        }
        if (isReservedEnvKey(entry.key)) {
          throw new InvalidEnvKeyError(entry.key, "reserved_env_key");
        }
        next.set(entry.key, { key: entry.key, value: entry.value, updatedAt: now });
      }
      const nextVariables = Array.from(next.values()).sort((a, b) => a.key.localeCompare(b.key));
      await writeStore(this.path, nextVariables, await this.vaultKey());
      this.variables = nextVariables;
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.enqueueMutation(async () => {
      await this.ensureLoaded();
      const before = this.variables.length;
      const nextVariables = this.variables.filter((entry) => entry.key !== key);
      if (nextVariables.length === before) return false;
      await writeStore(this.path, nextVariables, await this.vaultKey());
      this.variables = nextVariables;
      return true;
    });
  }

  // Used by the Electron shell at spawn time. Keep desktop runtime injection
  // in sync on path resolution and reserved-keys policy.
  static async readForInjection(
    overridePath?: string,
    vaultKeyProvider?: EnvVaultKeyProvider,
  ): Promise<Record<string, string>> {
    const path = overridePath?.trim() ? resolve(overridePath.trim()) : resolveDefaultEnvStorePath();
    let vaultKey: Buffer | null = null;
    try {
      if (vaultKeyProvider) {
        vaultKey = Buffer.from(await vaultKeyProvider());
      } else if (process.env.OPENWORK_ENCRYPTION_KEY?.trim()) {
        vaultKey = createHash("sha256").update(process.env.OPENWORK_ENCRYPTION_KEY.trim()).digest();
      }
    } catch {
      return {};
    }
    const { variables } = await readStore(path, { tolerateInvalid: true, vaultKey });
    const out: Record<string, string> = {};
    for (const entry of variables) {
      if (isInternalEnvKey(entry.key)) continue;
      out[entry.key] = entry.value;
    }
    return out;
  }
}

export class EnvStoreReadError extends Error {
  readonly code = "invalid_env_store";
}

export class InvalidEnvKeyError extends Error {
  readonly code: "invalid_env_key" | "reserved_env_key";
  constructor(key: string, code: "invalid_env_key" | "reserved_env_key") {
    super(
      code === "reserved_env_key"
        ? `Environment variable name is reserved for RenWork internals: ${key}`
        : `Invalid environment variable name: ${key}`,
    );
    this.code = code;
  }
}
