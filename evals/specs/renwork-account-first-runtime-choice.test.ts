import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import {
  CLOUD_DESKTOP_DISTRIBUTION,
  ENTERPRISE_DESKTOP_DISTRIBUTION,
  PUBLIC_DESKTOP_DISTRIBUTION,
  STANDALONE_DESKTOP_DISTRIBUTION,
} from "../../apps/desktop/electron/desktop-distribution.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const signinSurfacePath = join(repositoryRoot, "apps/app/src/react-app/domains/cloud/den-signin-surface.tsx");
const forcedSigninPath = join(repositoryRoot, "apps/app/src/react-app/domains/cloud/forced-signin-page.tsx");
const welcomePagePath = join(repositoryRoot, "apps/app/src/react-app/domains/onboarding/welcome-page.tsx");
const welcomeRoutePath = join(repositoryRoot, "apps/app/src/react-app/shell/welcome-route.tsx");
const routeStatePath = join(repositoryRoot, "apps/app/src/react-app/shell/use-workspace-route-state.ts");
const builderPath = join(repositoryRoot, "apps/desktop/electron-builder.yml");

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry === "dist" || entry === "build") continue;
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) result.push(...sourceFiles(path));
    else if ([".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml"].includes(extname(path))) result.push(path);
  }
  return result;
}

test("production RenWork builds require identity before runtime selection", async ({ evidence }) => {
  expect(STANDALONE_DESKTOP_DISTRIBUTION.requireSignin).toBe(false);
  for (const distribution of [
    PUBLIC_DESKTOP_DISTRIBUTION,
    CLOUD_DESKTOP_DISTRIBUTION,
    ENTERPRISE_DESKTOP_DISTRIBUTION,
  ]) {
    expect(distribution.requireSignin, distribution.flavor).toBe(true);
  }
  expect(source(builderPath)).toMatch(/extraMetadata:\s*\n\s*openworkDistribution:\s*public/);

  const signin = source(signinSurfacePath);
  const forcedSignin = source(forcedSigninPath);
  expect(signin).toContain('data-testid="renwork-signup"');
  expect(signin).toContain('data-testid="renwork-signin"');
  expect(signin).not.toMatch(/免登录|无需注册云端账号|直接进入本地数字员工工作台/);
  expect(forcedSignin).not.toMatch(/handleUseLocalMode|onUseLocalMode/);

  evidence.fact(
    "Production first install is account-first",
    "The packaged public, cloud, and enterprise distributions all force sign-in, and the forced sign-in surface exposes no local or workspace bypass.",
    true,
  );
});

test("authenticated users explicitly choose cloud or a local free-core path", async ({ evidence }) => {
  const welcome = source(welcomePagePath);
  const route = source(welcomeRoutePath);
  const routeState = source(routeStatePath);

  for (const testId of [
    "verified-account",
    "runtime-managed",
    "runtime-local",
    "runtime-local-agent",
    "runtime-byok",
    "runtime-continue",
  ]) {
    expect(welcome).toContain(`data-testid="${testId}"`);
  }
  expect(welcome).toMatch(/RenWork 云端|RenWork Cloud/);
  expect(welcome).toMatch(/本地运行|本地 Agent/);
  expect(welcome).toMatch(/Ollama|CLI/);
  expect(welcome).toMatch(/BYOK|自己的.*Key|自有.*Key/);
  expect(welcome).toMatch(/不.*自动上传|不会.*自动上传|保留在本机/);
  expect(welcome).not.toMatch(/OpenDesign|Naike|耐克/i);
  expect(route).not.toMatch(/isSignedIn[\s\S]{0,120}navigate\(["']\/onboarding["']/);
  expect(routeState).not.toMatch(/if\s*\(denAuth\.isSignedIn\)\s*return/);

  evidence.fact(
    "Identity and execution location are separate decisions",
    "The verified account unlocks peer cloud/local choices; local expands to Agent/Ollama/CLI and BYOK while the copy preserves local file sovereignty.",
    true,
  );
});

test("Naike remains absent from RenWork product defaults and fixtures", async ({ evidence }) => {
  const roots = [
    join(repositoryRoot, "apps/app/src"),
    join(repositoryRoot, "apps/desktop"),
    join(repositoryRoot, "packages"),
    join(repositoryRoot, "evals/fixtures"),
  ];
  const matches = roots
    .flatMap(sourceFiles)
    .filter((path) => /naike|耐克/i.test(source(path)))
    .map((path) => path.slice(repositoryRoot.length + 1));

  expect(matches).toEqual([]);
  evidence.fact(
    "Naike is not a product default",
    "Application sources, desktop packaging, shared packages, and default eval fixtures contain no Naike customer data.",
    true,
  );
});
