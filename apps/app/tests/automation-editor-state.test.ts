import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (relative: string) =>
  readFileSync(join(import.meta.dir, "..", relative), "utf8")

describe("Automation editor state", () => {
  test("editing copies a task into local form state so background refetches do not replace unsaved edits", () => {
    const page = read("src/react-app/domains/automations/automations-page.tsx")
    expect(page).toContain("const openEditModal = (task: LocalAutomationTask) =>")
    expect(page).toContain("setEditingTask(task)")
    expect(page).toContain("setFormName(task.name)")
    expect(page).toContain("setFormInstructions(task.instructions)")
    expect(page).toContain("id: editingTask?.id")
  })
})
