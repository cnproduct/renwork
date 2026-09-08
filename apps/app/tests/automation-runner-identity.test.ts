import { describe, expect, test } from "bun:test"

import {
  automationRunnerStorageKey,
  readOrCreateAutomationRunnerId,
  replaceAutomationRunnerId,
} from "@/react-app/domains/automations/automation-runner-identity"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe("automation runner identity", () => {
  test("keeps a stable runner id for the same user and organization", () => {
    const storage = memoryStorage()
    const scope = { organizationId: "org-1", userId: "user-1" }

    expect(readOrCreateAutomationRunnerId(storage, scope, () => "runner-1")).toBe("runner-1")
    expect(readOrCreateAutomationRunnerId(storage, scope, () => "runner-2")).toBe("runner-1")
  })

  test("does not reuse a runner id across users or organizations", () => {
    const storage = memoryStorage()

    expect(readOrCreateAutomationRunnerId(storage, { organizationId: "org-1", userId: "user-1" }, () => "runner-1")).toBe("runner-1")
    expect(readOrCreateAutomationRunnerId(storage, { organizationId: "org-1", userId: "user-2" }, () => "runner-2")).toBe("runner-2")
    expect(readOrCreateAutomationRunnerId(storage, { organizationId: "org-2", userId: "user-1" }, () => "runner-3")).toBe("runner-3")
  })

  test("trims identity fields before building the storage key", () => {
    expect(automationRunnerStorageKey({ organizationId: " org-1 ", userId: " user-1 " })).toBe(
      "openwork.automations.desktop-runner-id:org-1:user-1",
    )
  })

  test("replaces only the conflicted user and organization runner id", () => {
    const storage = memoryStorage()
    const scope = { organizationId: "org-1", userId: "user-1" }
    readOrCreateAutomationRunnerId(storage, scope, () => "runner-old")
    readOrCreateAutomationRunnerId(storage, { organizationId: "org-2", userId: "user-1" }, () => "runner-other")

    expect(replaceAutomationRunnerId(storage, scope, () => "runner-new")).toBe("runner-new")
    expect(readOrCreateAutomationRunnerId(storage, scope)).toBe("runner-new")
    expect(readOrCreateAutomationRunnerId(storage, { organizationId: "org-2", userId: "user-1" })).toBe("runner-other")
  })
})
