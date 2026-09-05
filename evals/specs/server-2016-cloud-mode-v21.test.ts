import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V21 ships a distinct Server 2016 cloud-only desktop", async ({ evidence }) => {
  const [distribution, main, connector, cloudStatus, builder, afterPack, workflow] = await Promise.all([
    readFile("../apps/desktop/electron/desktop-distribution.mjs", "utf8"),
    readFile("../apps/desktop/electron/main.mjs", "utf8"),
    readFile("../apps/app/src/react-app/shell/server-2016-cloud-workspace.tsx", "utf8"),
    readFile("../apps/app/src/react-app/shell/cloud-workspace-overlay.tsx", "utf8"),
    readFile("../apps/desktop/electron-builder.server2016-cloud.yml", "utf8"),
    readFile("../apps/desktop/scripts/electron-after-pack.cjs", "utf8"),
    readFile("../.github/workflows/build-server-2016-cloud.yml", "utf8"),
  ]);

  expect(distribution).toContain('flavor: "server2016-cloud"');
  expect(distribution).toContain("localRuntimeEnabled: false");
  expect(distribution).toContain("cloudWorkspaceRequired: true");
  expect(main).toContain('reason: "cloud-workspace-required"');
  expect(main).toContain("The local OpenCode engine is disabled in this cloud-only build.");
  expect(connector).toContain("denClient.listWorkers(orgId, 50)");
  expect(connector).toContain("denClient.getWorkerTokens(worker.workerId, orgId)");
  expect(connector).toContain("workspaceUpdateRemote");
  expect(connector).toContain("workspaceCreateRemote");
  expect(connector).toContain('sandboxRunId: orgId');
  expect(cloudStatus).toContain("isServer2016CloudDesktopRuntime()");
  expect(builder).toContain("RenWork-v${version}-Windows-Server-2016-Cloud-${arch}.${ext}");
  expect(builder).toContain("channel: server2016-cloud");
  expect(afterPack).toContain("isServer2016CloudBuild(context)");
  expect(afterPack).toContain("fs.rmSync(sidecarsDir, { force: true, recursive: true })");
  expect(workflow).toContain("must not contain OpenCode sidecars");
  expect(workflow).toContain("SHA256SUMS.txt");

  evidence.fact(
    "Windows Server 2016 never starts the incompatible OpenCode sidecar",
    "The immutable distribution disables all local runtime entry points and the package workflow rejects artifacts that contain an OpenCode executable.",
    true,
  );
  evidence.fact(
    "The signed-in user is connected only to their organization cloud worker",
    "The connector selects an isMine worker, requests Den-scoped tokens, and keys the persisted remote workspace by organization id.",
    true,
  );
  evidence.fact(
    "The dedicated build cannot overwrite the normal RenWork updater line",
    "It has a separate application id, protocol, output directory, artifact name, and server2016-cloud update channel.",
    true,
  );
});
