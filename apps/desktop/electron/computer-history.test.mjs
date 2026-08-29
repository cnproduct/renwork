import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createComputerHistory } from "./computer-history.mjs";

const roots = [];
const chrome = { name: "Google Chrome", bundleIdentifier: "com.google.Chrome" };

async function fixture(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "renwork-computer-history-"));
  roots.push(root);
  const filePath = path.join(root, "profile", "renwork-computer-history.v1.json");
  return {
    filePath,
    history: createComputerHistory({
      filePath,
      platform: "darwin",
      getPermissions: async () => ({ ok: true, accessibility: true, screenRecording: false }),
      ...options,
    }),
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("computer history", () => {
  it("starts disabled with a local-only empty state", async () => {
    const { history } = await fixture();
    assert.deepEqual(await history.getState(), {
      settings: { enabled: false, paused: false, retentionDays: 30, allowedApps: [] },
      entries: [],
      supported: true,
      permissions: { ok: true, accessibility: true, screenRecording: false },
    });
  });

  it("atomically persists normalized settings with owner-only permissions", async () => {
    const { history, filePath } = await fixture();
    const state = await history.updateSettings({
      enabled: true,
      retentionDays: 90,
      allowedApps: [chrome, chrome, { name: "", bundleIdentifier: "ignored" }],
    });

    assert.deepEqual(state.settings, {
      enabled: true,
      paused: false,
      retentionDays: 90,
      allowedApps: [chrome],
    });
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    assert.deepEqual((await readdir(path.dirname(filePath))).filter((name) => name.endsWith(".tmp")), []);

    const reloaded = createComputerHistory({ filePath, platform: "darwin" });
    assert.deepEqual((await reloaded.getState()).settings, state.settings);
  });

  it("consumes eval observations one at a time and persists only safe allowlisted fields", async () => {
    const secureValue = "hunter-api-key-must-never-be-stored";
    const { history, filePath } = await fixture({
      env: {
        OPENWORK_EVAL_COMPUTER_HISTORY_APPS: JSON.stringify([chrome]),
        OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS: JSON.stringify([
          {
            ...chrome,
            appName: chrome.name,
            windowTitle: "North America buyer research — RenWork",
            capturedAt: "2026-08-27T18:10:00.000Z",
            secureText: secureValue,
            rawScreenshot: "data:image/png;base64,secret",
          },
          {
            ...chrome,
            appName: chrome.name,
            windowTitle: "Incognito — Secret research",
            capturedAt: "2026-08-27T18:11:00.000Z",
          },
        ]),
      },
    });

    assert.deepEqual(await history.listApps(), { ok: true, apps: [chrome] });
    await history.updateSettings({ enabled: true, allowedApps: [chrome] });
    const captured = await history.captureNow();
    assert.equal(captured.entries.length, 1);
    assert.deepEqual(captured.entries[0], {
      id: captured.entries[0].id,
      appName: chrome.name,
      bundleIdentifier: chrome.bundleIdentifier,
      windowTitle: "North America buyer research — RenWork",
      summary: "North America buyer research — RenWork",
      capturedAt: "2026-08-27T18:10:00.000Z",
      lastSeenAt: "2026-08-27T18:10:00.000Z",
      durationSeconds: 0,
    });
    assert.equal((await history.captureNow()).entries.length, 1, "private window is ignored");

    const raw = await readFile(filePath, "utf8");
    assert.doesNotMatch(raw, new RegExp(secureValue));
    assert.doesNotMatch(raw, /rawScreenshot/u);
    assert.doesNotMatch(raw, /secureText/u);
  });

  it("does not consume observations while paused and merges duplicate windows", async () => {
    const env = {
      OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS: JSON.stringify([
        { ...chrome, appName: chrome.name, windowTitle: "Buyer review", capturedAt: "2026-08-27T18:10:00.000Z" },
        { ...chrome, appName: chrome.name, windowTitle: "Buyer review", capturedAt: "2026-08-27T18:12:00.000Z" },
      ]),
    };
    const { history } = await fixture({ env });
    await history.updateSettings({ enabled: true, paused: true, allowedApps: [chrome] });
    assert.equal((await history.captureNow()).entries.length, 0);
    await history.updateSettings({ paused: false });
    assert.equal((await history.captureNow()).entries.length, 1);
    const merged = await history.captureNow();
    assert.equal(merged.entries.length, 1);
    assert.equal(merged.entries[0].capturedAt, "2026-08-27T18:10:00.000Z");
    assert.equal(merged.entries[0].lastSeenAt, "2026-08-27T18:12:00.000Z");
    assert.equal(merged.entries[0].durationSeconds, 120);
  });

  it("captures on the background schedule only while enabled and unpaused", async () => {
    const scheduler = { tick: () => {} };
    let cleared = null;
    let observationCalls = 0;
    const { history } = await fixture({
      env: { OPENWORK_COMPUTER_HISTORY_INTERVAL_MS: "1000" },
      observe: async () => {
        observationCalls += 1;
        return { ...chrome, appName: chrome.name, windowTitle: `Scheduled ${observationCalls}` };
      },
      setIntervalFn: (callback, milliseconds) => {
        assert.equal(milliseconds, 1_000);
        scheduler.tick = callback;
        return { unref() {} };
      },
      clearIntervalFn: (timer) => { cleared = timer; },
    });

    history.start();
    scheduler.tick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observationCalls, 0, "disabled history does not read the helper");

    await history.updateSettings({ enabled: true, allowedApps: [chrome] });
    scheduler.tick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observationCalls, 1);
    assert.equal((await history.getState()).entries.length, 1);

    await history.updateSettings({ paused: true });
    scheduler.tick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(observationCalls, 1, "paused history does not read the helper");
    history.stop();
    assert.ok(cleared);
  });

  it("deletes one entry, clears date ranges, and applies retention", async () => {
    const clock = new Date("2026-08-27T20:00:00.000Z");
    const observations = [
      { ...chrome, appName: chrome.name, windowTitle: "old", capturedAt: "2026-07-01T12:00:00.000Z" },
      { ...chrome, appName: chrome.name, windowTitle: "week", capturedAt: "2026-08-23T12:00:00.000Z" },
      { ...chrome, appName: chrome.name, windowTitle: "today", capturedAt: "2026-08-27T19:00:00.000Z" },
    ];
    const { history } = await fixture({
      now: () => new Date(clock),
      env: { OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS: JSON.stringify(observations) },
    });
    await history.updateSettings({ enabled: true, retentionDays: 0, allowedApps: [chrome] });
    await history.captureNow();
    await history.captureNow();
    let state = await history.captureNow();
    assert.equal(state.entries.length, 3);

    const weekId = state.entries.find((entry) => entry.windowTitle === "week")?.id;
    state = await history.deleteEntry(weekId);
    assert.deepEqual(state.entries.map((entry) => entry.windowTitle).sort(), ["old", "today"]);
    state = await history.clear({ range: "today" });
    assert.deepEqual(state.entries.map((entry) => entry.windowTitle), ["old"]);

    state = await history.updateSettings({ retentionDays: 7 });
    assert.equal(state.entries.length, 0);
    assert.equal((await history.clear({ range: "all" })).entries.length, 0);
    await assert.rejects(history.clear({ range: "invalid" }), /Invalid computer history clear range/u);
  });
});
