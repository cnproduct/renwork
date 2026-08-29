import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);
const FILE_VERSION = 1;
const VALID_RETENTION_DAYS = new Set([0, 7, 30, 90]);
const PRIVATE_WINDOW_PATTERN = /(?:incognito|inprivate|private browsing|private window|guest mode|隐身|无痕|隐私浏览|访客模式)/iu;
const MAX_TEXT_LENGTH = 500;

/** @typedef {import("@openwork/types/desktop-ipc").ComputerHistoryApp} ComputerHistoryApp */
/** @typedef {import("@openwork/types/desktop-ipc").ComputerHistoryAppsResult} ComputerHistoryAppsResult */
/** @typedef {import("@openwork/types/desktop-ipc").ComputerHistoryEntry} ComputerHistoryEntry */
/** @typedef {import("@openwork/types/desktop-ipc").ComputerHistorySettings} ComputerHistorySettings */
/** @typedef {import("@openwork/types/desktop-ipc").ComputerHistoryState} ComputerHistoryState */
/** @typedef {import("@openwork/types/desktop-ipc").ComputerUsePermissions} ComputerUsePermissions */

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  paused: false,
  retentionDays: 30,
  allowedApps: [],
});

/** @returns {0 | 7 | 30 | 90} */
function normalizeRetentionDays(value) {
  switch (Number(value)) {
    case 0: return 0;
    case 7: return 7;
    case 90: return 90;
    default: return 30;
  }
}

function text(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeApp(value) {
  const name = text(value?.name, 160);
  const bundleIdentifier = text(value?.bundleIdentifier, 240);
  if (!name || !bundleIdentifier) return null;
  return { name, bundleIdentifier };
}

function normalizeApps(value) {
  if (!Array.isArray(value)) return [];
  const apps = [];
  const seen = new Set();
  for (const candidate of value) {
    const app = normalizeApp(candidate);
    if (!app || seen.has(app.bundleIdentifier)) continue;
    seen.add(app.bundleIdentifier);
    apps.push(app);
  }
  return apps;
}

/** @returns {ComputerHistorySettings} */
function normalizeSettings(value) {
  return {
    enabled: value?.enabled === true,
    paused: value?.paused === true,
    retentionDays: normalizeRetentionDays(value?.retentionDays),
    allowedApps: normalizeApps(value?.allowedApps),
  };
}

function normalizeTimestamp(value) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0;
}

/** @returns {ComputerHistoryEntry | null} */
function normalizeEntry(value) {
  const id = text(value?.id, 120);
  const appName = text(value?.appName, 160);
  const bundleIdentifier = text(value?.bundleIdentifier, 240);
  const windowTitle = text(value?.windowTitle);
  const summary = text(value?.summary);
  const capturedAt = normalizeTimestamp(value?.capturedAt);
  const lastSeenAt = normalizeTimestamp(value?.lastSeenAt) ?? capturedAt;
  if (!id || !appName || !bundleIdentifier || !windowTitle || !summary || !capturedAt || !lastSeenAt) return null;
  if (PRIVATE_WINDOW_PATTERN.test(windowTitle)) return null;
  return {
    id,
    appName,
    bundleIdentifier,
    windowTitle,
    summary,
    capturedAt,
    lastSeenAt,
    durationSeconds: normalizeDuration(value?.durationSeconds),
  };
}

function normalizeEntries(value) {
  if (!Array.isArray(value)) return [];
  const entries = [];
  for (const candidate of value) {
    const entry = normalizeEntry(candidate);
    if (entry) entries.push(entry);
  }
  return entries;
}

function parseJsonArray(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function startOfLocalDay(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function clearCutoff(range, now) {
  if (range === "today") return startOfLocalDay(now);
  if (range === "7d") return now.getTime() - 7 * 24 * 60 * 60 * 1_000;
  if (range === "30d") return now.getTime() - 30 * 24 * 60 * 60 * 1_000;
  return Number.NEGATIVE_INFINITY;
}

function withinRetention(entry, retentionDays, now) {
  if (retentionDays === 0) return true;
  return new Date(entry.lastSeenAt).getTime() >= now.getTime() - retentionDays * 24 * 60 * 60 * 1_000;
}

function appIsAllowed(observation, allowedApps) {
  return allowedApps.some((allowed) => allowed.bundleIdentifier === observation.bundleIdentifier);
}

function observationToSafeEntry(value, now) {
  const appName = text(value?.appName, 160);
  const bundleIdentifier = text(value?.bundleIdentifier, 240);
  const windowTitle = text(value?.windowTitle);
  const summary = text(value?.summary) || windowTitle;
  const capturedAt = normalizeTimestamp(value?.capturedAt) ?? now.toISOString();
  if (!appName || !bundleIdentifier || !windowTitle || !summary) return null;
  if (PRIVATE_WINDOW_PATTERN.test(windowTitle)) return null;
  return {
    id: randomUUID(),
    appName,
    bundleIdentifier,
    windowTitle,
    summary,
    capturedAt,
    lastSeenAt: capturedAt,
    durationSeconds: normalizeDuration(value?.durationSeconds),
  };
}

function mergeEntry(entries, incoming) {
  const duplicate = entries.find((entry) =>
    entry.bundleIdentifier === incoming.bundleIdentifier
      && entry.windowTitle === incoming.windowTitle
      && entry.summary === incoming.summary,
  );
  if (!duplicate) return [incoming, ...entries];

  const previousSeen = new Date(duplicate.lastSeenAt).getTime();
  const nextSeen = new Date(incoming.lastSeenAt).getTime();
  const elapsed = Math.max(0, Math.round((nextSeen - previousSeen) / 1_000));
  duplicate.lastSeenAt = nextSeen >= previousSeen ? incoming.lastSeenAt : duplicate.lastSeenAt;
  duplicate.durationSeconds += incoming.durationSeconds || elapsed;
  return entries;
}

async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, filePath);
    await chmod(filePath, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function helperInvocation(getHelperCommand, subcommand) {
  try {
    const command = getHelperCommand();
    if (!Array.isArray(command) || command.length === 0) return null;
    const [executable, ...originalArgs] = command;
    const args = originalArgs.at(-1) === "mcp" ? originalArgs.slice(0, -1) : originalArgs;
    return { executable, args: [...args, subcommand] };
  } catch {
    return null;
  }
}

async function runHelperJson(getHelperCommand, subcommand) {
  const invocation = helperInvocation(getHelperCommand, subcommand);
  if (!invocation) return null;
  try {
    const { stdout } = await execFileAsync(invocation.executable, invocation.args, {
      timeout: 5_000,
      maxBuffer: 128 * 1_024,
    });
    return JSON.parse(stdout.trim());
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   filePath: string;
 *   env?: NodeJS.ProcessEnv;
 *   platform?: NodeJS.Platform;
 *   now?: () => Date;
 *   getPermissions?: () => Promise<ComputerUsePermissions>;
 *   getHelperCommand?: () => string[];
 *   observe?: () => Promise<object | null>;
 *   listApps?: () => Promise<ComputerHistoryAppsResult>;
 *   setIntervalFn?: (callback: () => void, milliseconds: number) => unknown;
 *   clearIntervalFn?: (timer: unknown) => void;
 * }} options
 */
export function createComputerHistory({
  filePath,
  env = process.env,
  platform = process.platform,
  now = () => new Date(),
  getPermissions = undefined,
  getHelperCommand = undefined,
  observe = undefined,
  listApps = undefined,
  setIntervalFn = (callback, milliseconds) => setInterval(callback, milliseconds),
  clearIntervalFn = (timer) => clearInterval(/** @type {ReturnType<typeof setInterval>} */ (timer)),
}) {
  if (!filePath) throw new Error("Computer history file path is required.");
  const supported = platform === "darwin" || Boolean(env.OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS);
  const evalApps = normalizeApps(parseJsonArray(env.OPENWORK_EVAL_COMPUTER_HISTORY_APPS));
  const evalObservations = parseJsonArray(env.OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS);
  const requestedInterval = Number(env.OPENWORK_COMPUTER_HISTORY_INTERVAL_MS);
  const intervalMs = Number.isFinite(requestedInterval) && requestedInterval >= 1_000 ? requestedInterval : 60_000;
  let observationIndex = 0;
  /** @type {unknown | null} */
  let interval = null;
  let loaded = false;
  /** @type {{version: number; settings: ComputerHistorySettings; entries: ComputerHistoryEntry[]}} */
  let store = { version: FILE_VERSION, settings: normalizeSettings(DEFAULT_SETTINGS), entries: [] };
  let mutation = Promise.resolve();

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8"));
      store = {
        version: FILE_VERSION,
        settings: normalizeSettings(parsed?.settings),
        entries: normalizeEntries(parsed?.entries),
      };
      await chmod(filePath, 0o600);
    } catch {
      store = { version: FILE_VERSION, settings: normalizeSettings(DEFAULT_SETTINGS), entries: [] };
    }
  }

  async function persist() {
    store.entries = store.entries.filter((entry) => withinRetention(entry, store.settings.retentionDays, now()));
    await atomicWriteJson(filePath, store);
  }

  function serialize(task) {
    const next = mutation.then(async () => {
      await load();
      return task();
    });
    mutation = next.then(() => undefined, () => undefined);
    return next;
  }

  /** @returns {Promise<ComputerHistoryState>} */
  async function buildState() {
    const currentTime = now();
    const entries = store.entries.filter((entry) => withinRetention(entry, store.settings.retentionDays, currentTime));
    const permissions = typeof getPermissions === "function" ? await getPermissions() : undefined;
    return {
      settings: {
        ...store.settings,
        allowedApps: store.settings.allowedApps.map((app) => ({ ...app })),
      },
      entries: entries.map((entry) => ({ ...entry })),
      supported,
      ...(permissions ? { permissions } : {}),
    };
  }

  async function state() {
    return serialize(async () => {
      const retained = store.entries.filter((entry) => withinRetention(entry, store.settings.retentionDays, now()));
      if (retained.length !== store.entries.length) {
        store.entries = retained;
        await persist();
      }
      return buildState();
    });
  }

  async function captureIntoStore() {
    if (!supported || !store.settings.enabled || store.settings.paused) return false;
    let observation;
    if (evalObservations.length > 0) {
      observation = evalObservations[observationIndex] ?? null;
      observationIndex += observation ? 1 : 0;
    } else if (typeof observe === "function") {
      observation = await observe();
    } else if (typeof getHelperCommand === "function") {
      const payload = await runHelperJson(getHelperCommand, "--history-snapshot");
      observation = payload?.ok === true ? payload : null;
    } else {
      observation = null;
    }
    const safeEntry = observationToSafeEntry(observation, now());
    if (!safeEntry || !appIsAllowed(safeEntry, store.settings.allowedApps)) return false;
    store.entries = mergeEntry(store.entries, safeEntry);
    await persist();
    return true;
  }

  return {
    start() {
      if (interval !== null) return;
      interval = setIntervalFn(() => {
        void serialize(() => captureIntoStore()).catch(() => undefined);
      }, intervalMs);
    },
    stop() {
      if (interval === null) return;
      clearIntervalFn(interval);
      interval = null;
    },
    getState: state,
    updateSettings(input = {}) {
      return serialize(async () => {
        const candidate = {
          ...store.settings,
          ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
          ...(typeof input.paused === "boolean" ? { paused: input.paused } : {}),
          ...(VALID_RETENTION_DAYS.has(Number(input.retentionDays)) ? { retentionDays: Number(input.retentionDays) } : {}),
          ...(Array.isArray(input.allowedApps) ? { allowedApps: input.allowedApps } : {}),
        };
        store.settings = normalizeSettings(candidate);
        await persist();
        return buildState();
      });
    },
    async listApps() {
      if (evalApps.length > 0) return { ok: true, apps: evalApps.map((app) => ({ ...app })) };
      if (!supported) return { ok: false, apps: [] };
      if (typeof listApps === "function") return listApps();
      if (typeof getHelperCommand !== "function") return { ok: false, apps: [] };
      const payload = await runHelperJson(getHelperCommand, "--list-apps");
      const apps = normalizeApps(payload?.appDetails);
      return { ok: payload?.ok === true, apps };
    },
    captureNow() {
      return serialize(async () => {
        await captureIntoStore();
        return buildState();
      });
    },
    deleteEntry(id) {
      return serialize(async () => {
        store.entries = store.entries.filter((entry) => entry.id !== text(id, 120));
        await persist();
        return buildState();
      });
    },
    clear(input = {}) {
      return serialize(async () => {
        const range = input.range;
        if (range !== "today" && range !== "7d" && range !== "30d" && range !== "all") {
          throw new Error("Invalid computer history clear range.");
        }
        if (range === "all") {
          store.entries = [];
        } else {
          const cutoff = clearCutoff(range, now());
          store.entries = store.entries.filter((entry) => new Date(entry.lastSeenAt).getTime() < cutoff);
        }
        await persist();
        return buildState();
      });
    },
  };
}

export const computerHistoryInternals = {
  PRIVATE_WINDOW_PATTERN,
  normalizeApps,
  normalizeEntry,
};
