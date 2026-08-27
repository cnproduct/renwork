import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "../..");

const codeRoots = [
  "apps/app/src",
  "apps/desktop/electron",
  "apps/server/src",
  "ee/apps/den-api/src",
  "ee/apps/den-web/app",
  "ee/apps/den-web/components",
  "ee/apps/diagnostics/app",
  "ee/apps/diagnostics/src",
  "ee/apps/inference/src",
  "ee/apps/landing/app",
  "ee/apps/landing/components",
  "ee/apps/landing/lib",
  "packages/email",
  "packages/headless-threads/src",
  "packages/ui/src",
];

const textRoots = [
  "apps/app/src/app/data",
  "packages/docs",
  "ee/apps/landing/public",
];

const textFiles = [
  "apps/app/index.html",
  "apps/app/overlay.html",
  "apps/ui-demo/index.html",
  "apps/desktop/electron-builder.yml",
  "apps/desktop/electron-builder.base.yml",
  "apps/desktop/electron-builder.cloud.yml",
  "apps/desktop/electron-builder.enterprise.yml",
  "apps/desktop/electron-builder.demo-a.yml",
  "apps/desktop/electron-builder.demo-b.yml",
];

const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const textExtensions = new Set([".html", ".md", ".mdx", ".json", ".txt", ".yaml", ".yml"]);

const compatibilityMarkers = [
  "X-OpenWork-",
  "OpenWork Cloud import:",
];

function isCompatibilityText(value) {
  return compatibilityMarkers.some((marker) => value.includes(marker));
}

async function collectFiles(root, acceptedExtensions) {
  const absoluteRoot = path.join(repoRoot, root);
  const entries = await readdir(absoluteRoot, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        acceptedExtensions.has(path.extname(entry.name)) &&
        !/\.(?:test|spec)\.[^.]+$/.test(entry.name),
    )
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function lineFor(source, position) {
  return source.slice(0, position).split("\n").length;
}

function inspectCode(file, source) {
  const findings = [];
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);

  function visit(node) {
    const isPublicTextNode =
      ts.isStringLiteralLike(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node);

    if (isPublicTextNode) {
      const value = node.text ?? node.getText(sourceFile);
      if (value.includes("OpenWork") && !isCompatibilityText(value)) {
        findings.push({ file, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1, value });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function inspectText(file, source) {
  const findings = [];
  for (const match of source.matchAll(/OpenWork/g)) {
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const lineEnd = source.indexOf("\n", match.index);
    const value = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim();
    if (!isCompatibilityText(value)) {
      findings.push({ file, line: lineFor(source, match.index), value });
    }
  }
  return findings;
}

const codeFiles = (await Promise.all(codeRoots.map((root) => collectFiles(root, codeExtensions)))).flat();
const scannedTextFiles = (await Promise.all(textRoots.map((root) => collectFiles(root, textExtensions)))).flat();
const allTextFiles = [...new Set([...scannedTextFiles, ...textFiles.map((file) => path.join(repoRoot, file))])];
const findings = [];

for (const file of codeFiles) {
  findings.push(...inspectCode(file, await readFile(file, "utf8")));
}
for (const file of allTextFiles) {
  findings.push(...inspectText(file, await readFile(file, "utf8")));
}

if (findings.length > 0) {
  console.error("Public RenWork brand check failed. User-visible OpenWork references remain:");
  for (const finding of findings) {
    console.error(`${path.relative(repoRoot, finding.file)}:${finding.line}: ${finding.value}`);
  }
  process.exitCode = 1;
} else {
  console.log(`RenWork public brand check passed (${codeFiles.length + allTextFiles.length} files scanned).`);
}
