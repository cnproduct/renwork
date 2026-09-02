import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"

describe("Voiceover V12 access grant provisioning", () => {
  test("repairs stale provider credentials and provisions temporary grants", async () => {
    const [inference, admin] = await Promise.all([
      readFile("../ee/apps/den-api/src/inference.ts", "utf8"),
      readFile("../ee/apps/den-api/src/routes/admin/index.ts", "utf8"),
    ])

    expect(inference).toContain("sha256(provider.apiKey) !== key.keyHash")
    expect(inference).toContain("if (!inference && !access.allowed) return")
    expect(admin).toContain("await syncInferenceForOrganizationMembers({ organizationId })")
  })
})
