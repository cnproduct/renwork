import { expect } from "vitest";
import { createAndSelectWorkspace, evalIn, go, waitFor } from "@openwork/behaviors";
import { photoRoll, screenshot, validate } from "@openwork/fraimz";
import { desktop } from "@openwork/hosts";
import { needs, test } from "@openwork/testkit";

const appSpecsEnabled = process.env.OPENWORK_EVAL_APP_SPECS === "1";
const title = appSpecsEnabled
  ? "RenWork computer history is local-first, allowlisted, reviewable, and deletable"
  : "computer history skipped — needs: set OPENWORK_EVAL_APP_SPECS=1";

const observations = [
  {
    appName: "Google Chrome",
    bundleIdentifier: "com.google.Chrome",
    windowTitle: "North America buyer research — RenWork",
    capturedAt: "2026-08-27T18:10:00.000Z",
    secureText: "hunter-api-key-must-never-be-stored",
  },
  {
    appName: "Google Chrome",
    bundleIdentifier: "com.google.Chrome",
    windowTitle: "Follow-up evidence review — RenWork",
    capturedAt: "2026-08-27T18:12:00.000Z",
    secureText: "second-secret-must-never-be-stored",
  },
];

test.skipIf(!appSpecsEnabled)(title, async ({ evidence }) => {
  needs({ optIn: ["OPENWORK_EVAL_APP_SPECS"] });

  await using app = await desktop({
    name: "computer-history",
    env: {
      OPENWORK_EVAL_COMPUTER_HISTORY_APPS: JSON.stringify([
        { name: "Google Chrome", bundleIdentifier: "com.google.Chrome" },
        { name: "WPS Office", bundleIdentifier: "com.kingsoft.wpsoffice.mac" },
      ]),
      OPENWORK_EVAL_COMPUTER_HISTORY_OBSERVATIONS: JSON.stringify(observations),
      OPENWORK_COMPUTER_HISTORY_INTERVAL_MS: "60000",
    },
  });
  await using roll = photoRoll("computer-history");
  const workspace = await createAndSelectWorkspace(app, {
    path: `/tmp/renwork-computer-history-${Date.now()}`,
  });

  await go(app, `/workspace/${workspace.workspaceId}/settings/computer-history`);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-view"]') !== null`, {
    timeoutMs: 60_000,
    label: "computer history settings view",
  });

  const initial = await evalIn(app, `(() => ({
    enabled: document.querySelector('[data-testid="computer-history-enabled"]')?.getAttribute('aria-checked'),
    text: document.body.innerText,
    entryCount: document.querySelectorAll('[data-testid="computer-history-entry"]').length,
  }))()`);
  expect(initial).toMatchObject({ enabled: "false", entryCount: 0 });
  expect(JSON.stringify(initial)).toContain("默认保存在本机");
  expect(JSON.stringify(initial)).toContain("原始屏幕不会保存");
  evidence.fact(
    "Computer history starts off and explains its local boundary",
    `Initial observable state: ${JSON.stringify(initial)}`,
    JSON.stringify(initial).includes('"enabled":"false"')
      && JSON.stringify(initial).includes("默认保存在本机")
      && JSON.stringify(initial).includes("原始屏幕不会保存"),
  );

  await evalIn(app, `(() => {
    const button = document.querySelector('[data-testid="computer-history-select-apps"]');
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  })()`);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-app-dialog"]') !== null`, {
    timeoutMs: 15_000,
    label: "computer history app allowlist dialog",
  });
  const selected = await evalIn(app, `(() => {
    const checkbox = document.querySelector('[data-testid="computer-history-app-com.google.Chrome"]');
    if (!(checkbox instanceof HTMLElement)) return false;
    checkbox.click();
    const save = document.querySelector('[data-testid="computer-history-save-apps"]');
    if (!(save instanceof HTMLElement)) return false;
    save.click();
    return true;
  })()`);
  expect(selected).toBe(true);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-app-dialog"]') === null
    && document.querySelector('[data-testid="computer-history-enabled"]')?.hasAttribute('disabled') === false`, {
    timeoutMs: 15_000,
    label: "computer history allowlist saved",
  });

  const enabled = await evalIn(app, `(() => {
    const toggle = document.querySelector('[data-testid="computer-history-enabled"]');
    if (!(toggle instanceof HTMLElement)) return false;
    toggle.click();
    return true;
  })()`);
  expect(enabled).toBe(true);
  await waitFor(
    app,
    `document.querySelectorAll('[data-testid="computer-history-entry"]').length === 1
      && document.body.innerText.includes("North America buyer research")`,
    { timeoutMs: 20_000, label: "first allowlisted work-history entry" },
  );

  const stored = await evalIn(app, `(async () => {
    const state = await window.__OPENWORK_ELECTRON__?.invokeDesktop?.("computerHistoryGetState");
    return state;
  })()`, { awaitPromise: true });
  const serialized = JSON.stringify(stored);
  expect(serialized).toContain("North America buyer research");
  expect(serialized).not.toContain("hunter-api-key-must-never-be-stored");
  expect(serialized).not.toContain("rawScreenshot");
  evidence.fact(
    "Only an allowlisted text summary is persisted",
    `The local state contains the allowed window summary and excludes secure text and screenshot payloads: ${serialized}`,
    serialized.includes("North America buyer research")
      && !serialized.includes("hunter-api-key-must-never-be-stored")
      && !serialized.includes("rawScreenshot"),
  );

  {
    const shot = await screenshot(app);
    if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
      const seen = await validate(shot, [
        "A RenWork 工作记忆 settings page is visible with an enabled recording control",
        "The page states that history is stored locally and raw screens are not saved",
        "A timeline entry shows Google Chrome, a time, and the North America buyer research summary",
        "Pause, choose apps, clear history, and 询问工作记忆 controls are visible",
        "No API key or password-like secret is visible",
      ]);
      expect(seen.ok, seen.why).toBe(true);
      await roll.add(shot, seen);
    } else {
      await roll.add(shot);
    }
  }

  const paused = await evalIn(app, `(() => {
    const button = document.querySelector('[data-testid="computer-history-pause"]');
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  })()`);
  expect(paused).toBe(true);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-status"]')?.textContent?.includes("已暂停") === true`, {
    timeoutMs: 10_000,
    label: "computer history paused state",
  });

  const countBeforePausedCapture = await evalIn(
    app,
    `document.querySelectorAll('[data-testid="computer-history-entry"]').length`,
  );
  await evalIn(app, `(async () => {
    return window.__OPENWORK_ELECTRON__?.invokeDesktop?.("computerHistoryCaptureNow");
  })()`, { awaitPromise: true });
  const countAfterPausedCapture = await evalIn(
    app,
    `document.querySelectorAll('[data-testid="computer-history-entry"]').length`,
  );
  expect(countAfterPausedCapture).toBe(countBeforePausedCapture);
  evidence.fact(
    "Pausing prevents new history",
    `Visible entries remained ${String(countBeforePausedCapture)} after an observation while paused.`,
    countAfterPausedCapture === countBeforePausedCapture,
  );

  const askOpened = await evalIn(app, `(() => {
    const button = document.querySelector('[data-testid="computer-history-ask"]');
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  })()`);
  expect(askOpened).toBe(true);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-share-confirm"]') !== null`, {
    timeoutMs: 10_000,
    label: "computer history share confirmation",
  });
  expect(await evalIn(app, `document.body.innerText.includes("发送前确认")
    && document.body.innerText.includes("仅发送所选文字摘要")`)).toBe(true);
  await waitFor(app, `(() => {
    const dialog = document.querySelector('[data-testid="computer-history-share-confirm"]');
    return dialog instanceof HTMLElement
      && dialog.getAnimations({ subtree: true }).every((animation) => animation.playState === "finished");
  })()`, {
    timeoutMs: 2_000,
    label: "settled computer history confirmation",
  });
  await roll.add(await screenshot(app));
  evidence.fact(
    "Asking from history requires a clear disclosure before cloud use",
    "The ask flow stops on a confirmation that says only selected text summaries will be sent.",
    true,
  );
  const confirmed = await evalIn(app, `(() => {
    const confirm = document.querySelector('[data-testid="computer-history-share-confirm-cta"]');
    if (!(confirm instanceof HTMLElement)) return false;
    confirm.click();
    return true;
  })()`);
  expect(confirmed).toBe(true);
  await waitFor(app, `(() => {
    const editor = document.querySelector('[contenteditable="true"][data-lexical-editor="true"]')
      ?? document.querySelector('[contenteditable="true"]');
    return location.hash.includes("/session/")
      && (editor?.innerText ?? "").includes("North America buyer research")
      && !(editor?.innerText ?? "").includes("hunter-api-key-must-never-be-stored");
  })()`, {
    timeoutMs: 30_000,
    label: "bounded work-history draft",
  });
  evidence.fact(
    "Confirmed history opens a bounded draft instead of sending automatically",
    "A new task opens with the selected text summary prefilled and no secure text.",
    true,
  );

  await go(app, `/workspace/${workspace.workspaceId}/settings/computer-history`);
  await waitFor(app, `document.querySelector('[data-testid="computer-history-view"]') !== null`, {
    timeoutMs: 15_000,
    label: "return to computer history settings",
  });

  const deleted = await evalIn(app, `(() => {
    const button = document.querySelector('[data-testid="computer-history-delete-entry"]');
    if (!(button instanceof HTMLElement)) return false;
    button.click();
    return true;
  })()`);
  expect(deleted).toBe(true);
  await waitFor(app, `document.querySelectorAll('[data-testid="computer-history-entry"]').length === 0`, {
    timeoutMs: 10_000,
    label: "computer history entry deleted",
  });
  const afterDelete = await evalIn(app, `(async () => {
    return window.__OPENWORK_ELECTRON__?.invokeDesktop?.("computerHistoryGetState");
  })()`, { awaitPromise: true });
  expect(JSON.stringify(afterDelete)).not.toContain("North America buyer research");
  evidence.fact(
    "Deleting a history item removes it from local state",
    `After deletion, the visible timeline is empty and local state is ${JSON.stringify(afterDelete)}.`,
    !JSON.stringify(afterDelete).includes("North America buyer research"),
  );
});
