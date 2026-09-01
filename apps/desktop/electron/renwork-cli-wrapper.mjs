import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export async function ensureRenworkCliWrapper(options) {
  const directory = path.join(options.userDataPath, "renwork-cli");
  await mkdir(directory, { recursive: true });
  const sourcePath = fileURLToPath(new URL("./renwork-cli-entry.mjs", import.meta.url));
  const runnerPath = path.join(directory, "runner.mjs");
  await writeFile(runnerPath, await readFile(sourcePath));

  if (process.platform === "win32") {
    const launcherPath = path.join(directory, "renwork.cmd");
    await writeFile(launcherPath, [
      "@echo off",
      "setlocal",
      "set ELECTRON_RUN_AS_NODE=1",
      `\"${options.executablePath}\" \"${runnerPath}\" %*`,
      "",
    ].join("\r\n"), "utf8");
    return directory;
  }

  const launcherPath = path.join(directory, "renwork");
  await writeFile(launcherPath, [
    "#!/bin/sh",
    `ELECTRON_RUN_AS_NODE=1 exec ${shellQuote(options.executablePath)} ${shellQuote(runnerPath)} \"$@\"`,
    "",
  ].join("\n"), "utf8");
  await chmod(launcherPath, 0o700);
  return directory;
}
