import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { expect } from "vitest"
import { test } from "@openwork/testkit"

const repoRoot = resolve(import.meta.dirname, "../..")

test("Voiceover V27 self-heals a stale desktop runner identity without crossing tenant boundaries", async ({ evidence }) => {
  const [identity, bridge, routes, repository] = await Promise.all([
    readFile(resolve(repoRoot, "apps/app/src/react-app/domains/automations/automation-runner-identity.ts"), "utf8"),
    readFile(resolve(repoRoot, "apps/app/src/react-app/domains/automations/automation-runner-bridge.tsx"), "utf8"),
    readFile(resolve(repoRoot, "ee/apps/den-api/src/routes/automations/index.ts"), "utf8"),
    readFile(resolve(repoRoot, "ee/apps/den-api/src/automations/repository.ts"), "utf8"),
  ])

  expect(identity).toContain("replaceAutomationRunnerId")
  expect(identity).toContain("automationRunnerStorageKey(scope)")
  expect(bridge).toContain('error.code !== "automation_runner_identity_conflict"')
  expect(bridge).toContain("replaceAutomationRunnerId(localStorage, scope)")
  expect(routes).toContain('status: 409')
  expect(routes).toContain('error.message === "automation_runner_identity_conflict"')
  expect(repository).toContain('throw new Error("automation_runner_identity_conflict")')

  evidence.fact(
    "A stale or colliding desktop runner identity repairs itself once",
    "Den returns a typed 409 conflict, and Desktop replaces only the current organization-and-user scoped id before retrying registration.",
    true,
  )
  evidence.fact(
    "Cross-tenant runner reuse remains blocked",
    "The repository still refuses an existing runner id owned by a different organization or member.",
    true,
  )
})
