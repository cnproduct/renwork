import { readFile } from "node:fs/promises"
import { expect, test } from "bun:test"

test("organization deletion purges H3 assets, jobs and prompts before RenCredit reservations", async () => {
  const source = await readFile(new URL("../src/routes/org/delete-organization.ts", import.meta.url), "utf8")
  const assetDelete = source.indexOf("tx.delete(VideoGenerationAssetTable)")
  const jobDelete = source.indexOf("tx.delete(VideoGenerationJobTable)")
  const quoteDelete = source.indexOf("tx.delete(VideoGenerationQuoteTable)")
  const reservationDelete = source.indexOf("tx.delete(RenCreditReservationTable)")

  expect(assetDelete).toBeGreaterThanOrEqual(0)
  expect(jobDelete).toBeGreaterThan(assetDelete)
  expect(quoteDelete).toBeGreaterThan(jobDelete)
  expect(reservationDelete).toBeGreaterThan(quoteDelete)
})
