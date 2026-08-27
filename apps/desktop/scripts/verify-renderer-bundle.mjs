#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRendererDir = path.resolve(scriptDir, "..", "..", "app", "dist");

function collectBrowserResources(html) {
  const resources = [];
  const tagPattern = /<(script|link)\b[^>]*?\b(src|href)=(['"])(.*?)\3[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    resources.push({ tag: match[1].toLowerCase(), attribute: match[2].toLowerCase(), value: match[4] });
  }
  return resources;
}

function localResourcePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    return null;
  }
  const withoutQuery = trimmed.split(/[?#]/, 1)[0];
  return decodeURIComponent(withoutQuery);
}

export async function verifyRendererBundle(rendererDir = defaultRendererDir) {
  const indexPath = path.join(rendererDir, "index.html");
  const html = await readFile(indexPath, "utf8");
  const resources = collectBrowserResources(html);
  const localResources = resources
    .map((resource) => ({ ...resource, localPath: localResourcePath(resource.value) }))
    .filter((resource) => resource.localPath !== null);

  if (!localResources.some((resource) => resource.tag === "script")) {
    throw new Error(`Packaged renderer has no local script entry: ${indexPath}`);
  }

  const absoluteResources = localResources.filter((resource) => resource.localPath.startsWith("/"));
  if (absoluteResources.length > 0) {
    throw new Error(
      `Packaged renderer contains file://-unsafe absolute resources: ${absoluteResources
        .map((resource) => resource.value)
        .join(", ")}`,
    );
  }

  for (const resource of localResources) {
    const resourcePath = path.resolve(rendererDir, resource.localPath);
    const relative = path.relative(rendererDir, resourcePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Packaged renderer resource escapes app-dist: ${resource.value}`);
    }
    await access(resourcePath);
  }

  return {
    ok: true,
    rendererDir,
    indexPath,
    resources: localResources.map((resource) => resource.value),
  };
}

async function main() {
  const rendererDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultRendererDir;
  const result = await verifyRendererBundle(rendererDir);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
