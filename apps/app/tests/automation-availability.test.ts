import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (relative: string) =>
  readFileSync(join(import.meta.dir, "..", relative), "utf8")

/**
 * Automations shipped out of preview: there is no per-device feature flag any
 * more. The surface is available on every desktop and its local runner does
 * not depend on the live Den availability probe. These checks pin that
 * contract so a refactor cannot silently reintroduce an opt-in gate or expose
 * the surface on web.
 */
describe("Automations availability", () => {
  test("no preview feature flag remains in the local preferences", () => {
    const source = read("src/react-app/kernel/local-provider.tsx")
    expect(source).not.toContain("automations:")

    const flags = read("src/react-app/domains/settings/state/feature-flags-preferences.ts")
    expect(flags).not.toContain("automations")
  })

  test("the shell gates the route on desktop while keeping local navigation available", () => {
    const source = read("src/react-app/shell/session-route.tsx")
    expect(source).toContain("const automationsEnabled = isDesktopRuntime()")
    expect(source).not.toContain("featureFlags?.automations")
    expect(source).toContain("automationsEnabled && automationsRouteRequested")
    expect(source).toContain("!automationsEnabled || !denAuth.isSignedIn")
    expect(source).toContain("const automationsNavigationAvailable = automationsEnabled")
  })

  test("the runner bridge registers on desktop without an opt-in", () => {
    const providers = read("src/react-app/shell/providers.tsx")
    expect(providers).toContain("<AutomationRunnerBridge enabled={isDesktopRuntime()} />")
    expect(providers).not.toContain("featureFlags")

    const bridge = read("src/react-app/domains/automations/automation-runner-bridge.tsx")
    expect(bridge).toContain("!enabled || status !== \"signed_in\"")
    expect(bridge).toContain("[enabled, status]")
    expect(bridge).toContain('automationRunnerConfigure", null')
  })

  test("the in-chat proposal tool only blocks on sign-in", () => {
    const proposal = read("src/components/tools/openwork-automation-proposal.tsx")
    expect(proposal).not.toContain("automationsEnabled")
    expect(proposal).toContain("请先登录以创建并激活该自动化任务。")
    expect(proposal).toContain("resolveProposalModel")
    expect(proposal).toContain("data-automation-model-resolution")
  })

  test("the automations capability stays desktop-only", () => {
    const controls = read("src/react-app/shell/control/control-provider.tsx")
    expect(controls).toContain("...(isDesktopRuntime()")
  })
})
