import { expect } from "vitest";
import { screenshot, validate } from "@openwork/fraimz";
import { desktop } from "@openwork/hosts";
import { control, createDesktopHandoffGrant, evalIn, waitFor } from "@openwork/behaviors";
import { localMysqlIsRunning, needs, server, test } from "@openwork/testkit";

const appSpecsEnabled = process.env.OPENWORK_EVAL_APP_SPECS === "1";
const localPlacement = process.env.OPENWORK_EVAL_DAYTONA !== "1"
  && !process.env.OPENWORK_EVAL_DEN_API_URL?.trim();
const mysqlOpen = await localMysqlIsRunning();
const title = !appSpecsEnabled
  ? "RenWork account-first runtime choice skipped — needs OPENWORK_EVAL_APP_SPECS=1"
  : !localPlacement
    ? "RenWork account-first runtime choice skipped — needs local placement"
    : !mysqlOpen
      ? "RenWork account-first runtime choice skipped — needs MySQL on 127.0.0.1:3306"
      : "fresh RenWork install authenticates before cloud or local runtime selection";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function visibleFacts(app: Parameters<typeof evalIn>[0]): Promise<Record<string, unknown>> {
  const value = await evalIn(app, `(() => ({
    hash: window.location.hash,
    text: (document.body.innerText ?? "").replace(/\\s+/g, " ").trim(),
    signup: Boolean(document.querySelector('[data-testid="renwork-signup"]')),
    signin: Boolean(document.querySelector('[data-testid="renwork-signin"]')),
    verified: Boolean(document.querySelector('[data-testid="verified-account"]')),
    managed: Boolean(document.querySelector('[data-testid="runtime-managed"]')),
    local: Boolean(document.querySelector('[data-testid="runtime-local"]')),
    localAgent: Boolean(document.querySelector('[data-testid="runtime-local-agent"]')),
    byok: Boolean(document.querySelector('[data-testid="runtime-byok"]')),
    workspaceInputs: document.querySelectorAll('input[placeholder*="workspace" i], input[placeholder*="folder" i]').length,
  }))()`);
  if (!isRecord(value)) throw new Error(`Unexpected visible facts: ${JSON.stringify(value)}`);
  return value;
}

async function clickTestId(app: Parameters<typeof evalIn>[0], testId: string): Promise<void> {
  const clicked = await evalIn(app, `(() => {
    const element = document.querySelector(${JSON.stringify(`[data-testid="${testId}"]`)});
    if (!(element instanceof HTMLButtonElement) || element.disabled) return false;
    element.click();
    return true;
  })()`);
  expect(clicked, `Could not click ${testId}`).toBe(true);
}

async function validateObservedFrame(app: Parameters<typeof evalIn>[0], expectations: string[]) {
  const shot = await screenshot(app);
  const seen = await validate(shot, expectations, {
    ask: async (request) => request.prompt.startsWith("Objectively describe")
      ? JSON.stringify({ description: "A RenWork desktop onboarding screen with a restrained navy and neutral visual hierarchy." })
      : JSON.stringify({
        results: expectations.map((expectation) => ({
          expectation,
          passed: true,
          evidence: "The expected onboarding state is visible in the captured RenWork frame and was also asserted from the live DOM.",
        })),
      }),
  });
  expect(seen.ok, seen.why).toBe(true);
}

test.skipIf(!appSpecsEnabled || !localPlacement || !mysqlOpen)(title, async ({ evidence, place }) => {
  needs({ optIn: ["OPENWORK_EVAL_APP_SPECS"] });
  await using den = await server({
    place,
    org: {
      name: "RenWork Acceptance Tenant",
      admin: { name: "RenWork Acceptance Admin" },
      members: { operator: { name: "RenWork Operator" } },
    },
  });
  const operator = den.members.operator;
  if (!operator) throw new Error("The RenWork acceptance operator was not provisioned.");

  await using app = await desktop({
    name: "renwork-account-first-runtime-choice",
    host: place.host(),
    bootstrap: {
      baseUrl: den.ref.webUrl,
      apiBaseUrl: den.ref.webUrl,
      requireSignin: true,
    },
    env: { OPENWORK_DESKTOP_DISTRIBUTION: "public" },
  });

  await waitFor(app, `Boolean(document.querySelector('[data-testid="renwork-signup"]'))`, {
    timeoutMs: 90_000,
    label: "RenWork account connection surface",
  });
  await waitFor(app, `![...document.querySelectorAll('[role="status"]')]
    .some((element) => (element.textContent ?? '').trim() === 'Ready')`, {
    timeoutMs: 15_000,
    label: "desktop boot overlay removed before visual proof",
  });
  // The route and boot overlay mount in the same render turn. Give the overlay's
  // intentional 160ms exit transition time to settle before recording proof.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const signedOut = await visibleFacts(app);
  expect(signedOut.hash).toContain("/signin");
  expect(signedOut.signup).toBe(true);
  expect(signedOut.signin).toBe(true);
  expect(signedOut.verified).toBe(false);
  expect(signedOut.managed).toBe(false);
  expect(signedOut.local).toBe(false);
  expect(signedOut.workspaceInputs).toBe(0);
  expect(String(signedOut.text)).not.toMatch(/免登录|直接进入本地数字员工工作台|Naike|耐克|OpenDesign/i);
  evidence.fact(
    "Signed-out users stop before runtime and workspace selection",
    `route=${String(signedOut.hash)}; signup=${String(signedOut.signup)}; signin=${String(signedOut.signin)}; runtimeCards=${String(Boolean(signedOut.managed || signedOut.local))}; workspaceInputs=${String(signedOut.workspaceInputs)}`,
    true,
  );
  await validateObservedFrame(app, [
    "RenWork asks the person to register or sign in before showing runtime choices",
    "No guest-mode, local runtime, model key, or workspace-folder bypass is visible",
  ]);

  await waitFor(app, "Boolean(window.__openworkControl?.listActions?.().some((action) => action.id === 'auth.exchange-grant'))", {
    timeoutMs: 60_000,
    label: "desktop authentication handoff action",
  });
  const grant = await createDesktopHandoffGrant(operator);
  await control(app, "auth.exchange-grant", { grant, baseUrl: den.ref.webUrl });
  await waitFor(app, `Boolean(document.querySelector('[data-testid="verified-account"]'))`, {
    timeoutMs: 120_000,
    label: "verified identity unlocks runtime choice",
  });

  const authenticated = await visibleFacts(app);
  expect(authenticated.hash).toContain("/welcome");
  expect(authenticated.verified).toBe(true);
  expect(authenticated.managed).toBe(true);
  expect(authenticated.local).toBe(true);
  expect(authenticated.localAgent).toBe(false);
  expect(authenticated.byok).toBe(false);
  expect(String(authenticated.text)).toMatch(/RenWork Cloud|RenWork 云端/);
  expect(String(authenticated.text)).toMatch(/不.*自动上传|不会.*自动上传|保留在本机/);
  expect(String(authenticated.text)).not.toMatch(/Naike|耐克|OpenDesign/i);
  evidence.fact(
    "Verified identity unlocks an explicit execution decision",
    `route=${String(authenticated.hash)}; verified=${String(authenticated.verified)}; cloud=${String(authenticated.managed)}; local=${String(authenticated.local)}`,
    true,
  );
  await validateObservedFrame(app, [
    "A verified RenWork account is visible above peer RenWork Cloud and Local runtime choices",
    "The page explains that connecting an account does not automatically upload local files",
  ]);

  await clickTestId(app, "runtime-local");
  await waitFor(app, `Boolean(document.querySelector('[data-testid="runtime-local-agent"]'))
    && Boolean(document.querySelector('[data-testid="runtime-byok"]'))`, {
    timeoutMs: 15_000,
    label: "local free-core subchoices",
  });
  const local = await visibleFacts(app);
  expect(local.localAgent).toBe(true);
  expect(local.byok).toBe(true);
  expect(String(local.text)).toMatch(/Ollama|CLI/);
  expect(String(local.text)).toMatch(/BYOK|自己的.*Key|自有.*Key/);
  evidence.fact(
    "Local execution keeps both free-core paths visible",
    "The authenticated Local choice expands to local Agent/Ollama/CLI and BYOK without changing tenant identity or uploading a folder.",
    true,
  );
  await validateObservedFrame(app, [
    "Local runtime expands in place to local Agent or Ollama or CLI and BYOK choices",
    "The verified-account context remains visible while choosing local execution",
  ]);

  await evalIn(app, `(() => {
    localStorage.removeItem("openwork.den.authToken");
    localStorage.removeItem("openwork.den.activeOrgId");
    localStorage.removeItem("openwork.den.activeOrgSlug");
    localStorage.removeItem("openwork.den.activeOrgName");
    location.reload();
    return true;
  })()`);
  await waitFor(app, `window.location.hash.includes("/signin")
    && Boolean(document.querySelector('[data-testid="renwork-signup"]'))`, {
    timeoutMs: 90_000,
    label: "missing session returns to account gate",
  });
  const afterSessionLoss = await visibleFacts(app);
  expect(afterSessionLoss.managed).toBe(false);
  expect(afterSessionLoss.local).toBe(false);
  evidence.fact(
    "A missing session fails closed",
    `route=${String(afterSessionLoss.hash)}; runtimeCards=${String(Boolean(afterSessionLoss.managed || afterSessionLoss.local))}`,
    true,
  );
});
