const RUNNER_ID_KEY_PREFIX = "openwork.automations.desktop-runner-id"

export type AutomationRunnerIdentityScope = {
  organizationId: string
  userId: string
}

export type AutomationRunnerIdentityStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function automationRunnerStorageKey(scope: AutomationRunnerIdentityScope) {
  return `${RUNNER_ID_KEY_PREFIX}:${scope.organizationId.trim()}:${scope.userId.trim()}`
}

export function readOrCreateAutomationRunnerId(
  storage: AutomationRunnerIdentityStorage,
  scope: AutomationRunnerIdentityScope,
  createId: () => string = () => crypto.randomUUID(),
) {
  const key = automationRunnerStorageKey(scope)
  const existing = storage.getItem(key)?.trim()
  if (existing) return existing

  const created = createId()
  storage.setItem(key, created)
  return created
}

export function replaceAutomationRunnerId(
  storage: AutomationRunnerIdentityStorage,
  scope: AutomationRunnerIdentityScope,
  createId: () => string = () => crypto.randomUUID(),
) {
  const created = createId()
  storage.setItem(automationRunnerStorageKey(scope), created)
  return created
}
