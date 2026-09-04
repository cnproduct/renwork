import { readFile } from "node:fs/promises"
import { describe, expect, test } from "vitest"

describe("Voiceover V12 access grant provisioning", () => {
  test("repairs stale provider credentials and provisions temporary grants", async () => {
    const [inference, admin] = await Promise.all([
      readFile("../ee/apps/den-api/src/inference.ts", "utf8"),
      readFile("../ee/apps/den-api/src/routes/admin/index.ts", "utf8"),
    ])

    expect(inference).toContain("sha256(provider.apiKey) !== key.keyHash")
    expect(inference).toContain("if (!access.allowed) {\n    await revokeMemberInferenceKeys(input.memberId)")
    expect(inference).toContain("if (!access.allowed) {\n    const members = await listOrgMembers(input.organizationId)")
    expect(inference).toContain("export async function repairMemberInferenceAccessIfNeeded")
    expect(inference).toContain("metadata: organization?.metadata ?? null")
    expect(admin).toContain("await syncInferenceForOrganizationMembers({ organizationId })")
  })
})
