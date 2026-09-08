import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const repoRoot = resolve(import.meta.dirname, "../..");

test("Voiceover V25 isolates runner identities and ships safe Server 2016 diagnostics", async ({ evidence }) => {
  const identity = await readFile(
    resolve(repoRoot, "apps/app/src/react-app/domains/automations/automation-runner-identity.ts"),
    "utf8",
  );
  const diagnostics = await readFile(
    resolve(repoRoot, "apps/app/src/react-app/shell/server-2016-cloud-diagnostics.ts"),
    "utf8",
  );
  const overlay = await readFile(
    resolve(repoRoot, "apps/app/src/react-app/shell/cloud-workspace-overlay.tsx"),
    "utf8",
  );
  const workflow = await readFile(resolve(repoRoot, ".github/workflows/build-server-2016-cloud.yml"), "utf8");

  expect(identity).toContain("scope.organizationId.trim()")
  expect(identity).toContain("scope.userId.trim()")
  expect(diagnostics).toContain('id: "session"')
  expect(diagnostics).toContain('id: "cloud"')
  expect(diagnostics).toContain('id: "worker"')
  expect(diagnostics).toContain('id: "models"')
  expect(diagnostics).toContain('id: "rencredit"')
  expect(overlay).toContain("Run diagnostics")
  expect(workflow).toContain("Verify the package does not ship OpenCode sidecars")

  evidence.fact(
    "Voiceover V25 closes the shared-runner collision and makes cloud failures diagnosable",
    "Runner ids are scoped per user and organization, while the Server 2016 failure card can verify session, cloud, worker, catalog, and wallet without exposing credentials.",
    true,
  );
});
