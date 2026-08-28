import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";
import * as ts from "typescript";

import { resolveOpenWorkConnectStatus } from "../../apps/app/src/react-app/domains/connections/openwork-connect-status";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_ROOTS = [
  "apps/app/src",
  "apps/desktop/electron",
  "apps/server/src",
  "packages/email",
  "packages/install-config",
  "packages/ui",
  "packages/handsfree",
  "packages/openwork-bootstrap",
  "packages/headless-threads",
];
const PUBLIC_TEXT_ROOTS = [
  "apps/app/src/app/data",
  "packages/docs",
  "packages/handsfree",
  "packages/headless-threads",
  "packages/openwork-bootstrap",
  "packages/openwork-ui-mcp",
  "packages/ui",
  "translated_readmes",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PUBLIC_TEXT_EXTENSIONS = new Set([".md", ".mdx", ".json", ".yml", ".yaml"]);

async function filesUnder(relativeRoot: string, extensions: Set<string>): Promise<string[]> {
  const root = join(REPOSITORY_ROOT, relativeRoot);
  const files: string[] = [];
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "testdata") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (extensions.has(extname(entry.name)) && !/\.(?:test|spec|flow)\./.test(entry.name)) {
        files.push(path);
      }
    }
  };
  await visit(root);
  return files;
}

function publicBrandLeaks(path: string, source: string): string[] {
  const scriptKind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind);
  const leaks: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)
      || ts.isJsxText(node)
    ) {
      const text = source.slice(node.getStart(sourceFile), node.end);
      const isProtocolIdentifier = text.includes("X-OpenWork");
      const isLegacyBackupPath = text.includes("OpenWork.app.migrate-bak");
      if (/\bOpenWork\b/.test(text) && !isProtocolIdentifier && !isLegacyBackupPath) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        leaks.push(`${path}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return leaks;
}

test("RenWork Connect avoids skipped-state false alarms and public copy is RenWork branded", async ({ evidence }) => {
  const skipped = resolveOpenWorkConnectStatus(true, {
    status: "skipped",
    issue: null,
    skipReason: "disabled",
    attempt: 1,
    maxAttempts: 3,
  });
  expect(skipped).toEqual({
    state: "ready",
    label: "Ready",
    description: "RenWork Cloud is connected. Connected service tools are not enabled for this workspace.",
  });

  const failed = resolveOpenWorkConnectStatus(true, {
    status: "failed",
    issue: {
      code: "cloud_mcp_unavailable",
      stage: "engine_delivery",
      retryable: true,
      recommendedAction: "Retry",
      message: "Connected service tools could not be verified.",
    },
    skipReason: null,
    attempt: 3,
    maxAttempts: 3,
  });
  expect(failed?.state).toBe("needs_attention");

  const sourceFiles = (await Promise.all(SOURCE_ROOTS.map((root) => filesUnder(root, SOURCE_EXTENSIONS)))).flat();
  const sourceLeaks = (
    await Promise.all(sourceFiles.map(async (path) => publicBrandLeaks(path, await readFile(path, "utf8"))))
  ).flat();
  expect(sourceLeaks).toEqual([]);

  const publicTextFiles = (await Promise.all(PUBLIC_TEXT_ROOTS.map((root) => filesUnder(root, PUBLIC_TEXT_EXTENSIONS)))).flat();
  const publicTextLeaks: string[] = [];
  for (const path of publicTextFiles) {
    const source = await readFile(path, "utf8");
    if (/\bOpenWork\b/.test(source)) publicTextLeaks.push(path);
  }
  expect(publicTextLeaks).toEqual([]);

  evidence.fact(
    "RenWork Connect only warns on real failures",
    "A normal skipped maintenance pass remains ready, while a failed pass still produces a Needs attention state.",
    true,
  );
  evidence.fact(
    "Public product copy is RenWork branded",
    "Runtime string and JSX surfaces, email/install defaults, and published documentation contain no legacy standalone product name outside approved internal protocol and migration identifiers.",
    true,
  );
});
