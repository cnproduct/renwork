import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (relative: string) =>
  readFileSync(join(import.meta.dir, "..", relative), "utf8")

describe("Automation editor state", () => {
  test("background detail refetches do not replace unsaved edits", () => {
    const page = read("src/react-app/domains/automations/automations-page.tsx")
    expect(page).toContain('const [formName, setFormName] = useState("")')
    expect(page).toContain("refetchInterval: 10_000")
    expect(page).toContain("const openEditModal = (task: LocalAutomationTask) => {")
    expect(page).toContain("setFormName(task.name)")
    expect(page).toContain("onChange={(e) => setFormName(e.target.value)}")
    expect(page).not.toContain("useEffect")
  })
})
