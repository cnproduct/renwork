import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const gateway = readFileSync(join(root, "src", "routes", "inference-gateway.ts"), "utf8")
const ledger = readFileSync(join(root, "src", "rencredit-ledger.ts"), "utf8")
const orgInferenceRoute = readFileSync(join(root, "src", "routes", "org", "inference.ts"), "utf8")
const schema = readFileSync(join(root, "..", "..", "packages", "den-db", "src", "schema", "inference.ts"), "utf8")
const migration = readFileSync(join(root, "..", "..", "packages", "den-db", "drizzle", "0068_adorable_leper_queen.sql"), "utf8")

describe("RenWork production inference gateway", () => {
  test("derives tenant identity from a hashed RenWork key and requires idempotency", () => {
    expect(gateway).toContain("authenticateInferenceKey(apiKey)")
    expect(gateway).toContain('c.req.header("Idempotency-Key")')
    expect(ledger).toContain("eq(InferenceKeyTable.key_hash, hashInferenceKey(key))")
    expect(gateway).not.toContain('c.req.header("X-Organization-Id")')
  })

  test("lets the signed desktop provider supply an automatic per-run idempotency key", () => {
    expect(gateway).toContain('c.req.header("X-RenWork-Client")')
    expect(gateway).toContain('`desktop:${principal.inferenceKeyId}:${runId}`')
  })

  test("reserves before egress and releases every failed or empty result", () => {
    expect(gateway.indexOf("reserveInferenceCredits({")).toBeLessThan(gateway.indexOf("await fetch(chatCompletionsUrl"))
    expect(gateway).toContain("UPSTREAM_NETWORK_ERROR")
    expect(gateway).toContain("UPSTREAM_EMPTY_STREAM")
    expect(ledger).toContain('reason_code: input.hasResult ? "INFERENCE_TOKEN_CAPTURE" : "INFERENCE_NO_RESULT_RELEASE"')
  })

  test("requests stream usage and hides the upstream model id", () => {
    expect(gateway).toContain("include_usage: true")
    expect(gateway).toContain("delete upstreamBody.usage")
    expect(gateway).toContain("sanitizeStreamEvent(event, model.sku)")
    expect(gateway).toContain("JSON.stringify({ ...payload, model: model.sku })")
    expect(gateway).toContain("while (true)")
    expect(gateway).toContain('releaseOnce("CLIENT_ABORTED")')
    expect(gateway).not.toContain("async pull(controller)")
  })

  test("logs only sanitized upstream rejection structure before releasing credits", () => {
    expect(gateway).toContain("safeUpstreamErrorDetails(upstreamError)")
    expect(gateway).toContain("summarizeToolSchemas(upstreamBody)")
    expect(gateway).toContain('request_keys: Object.keys(upstreamBody).sort()')
    expect(gateway.indexOf('logger.warn("RenWork upstream inference rejected request"')).toBeLessThan(
      gateway.indexOf('releaseInferenceCredits({ reservationId: reservation.id, failureCode: `UPSTREAM_HTTP_${upstream.status}` })'),
    )
    expect(gateway).not.toContain("upstreamBody.messages")
  })
})

describe("RenCredit persistent multi-tenant ledger", () => {
  test("persists wallet, reservation, usage and append-only ledger tables", () => {
    for (const table of ["rencredit_wallets", "rencredit_reservations", "rencredit_usage_events", "rencredit_ledger_entries"]) {
      expect(schema).toContain(`\"${table}\"`)
      expect(migration).toContain(`CREATE TABLE \`${table}\``)
    }
  })

  test("scopes idempotency and usage uniqueness by organization", () => {
    expect(migration).toContain("UNIQUE(`organization_id`,`idempotency_key`)")
    expect(migration).toContain("UNIQUE(`organization_id`,`provider_response_id`)")
    expect(ledger).toContain('.for("update")')
  })

  test("serves member-scoped receipts and admin-only sanitized ledger records", () => {
    expect(orgInferenceRoute).toContain('"/v1/rencredit/receipts"')
    expect(orgInferenceRoute).toContain("memberId: payload.currentMember.id")
    expect(orgInferenceRoute).toContain('"/v1/rencredit/ledger"')
    expect(orgInferenceRoute).toContain('orgRoleRoute(["admin"])')
    expect(ledger).toContain("eq(RenCreditReservationTable.org_membership_id, input.memberId)")

    const publicLedgerSelector = ledger.slice(
      ledger.indexOf("export async function listRenCreditLedger"),
      ledger.indexOf("export async function listMemberRenCreditTaskReceipts"),
    )
    expect(publicLedgerSelector).not.toContain("idempotency_key")
    expect(publicLedgerSelector).not.toContain("metadata:")

    const receiptSelector = ledger.slice(
      ledger.indexOf("export async function listMemberRenCreditTaskReceipts"),
      ledger.indexOf("export async function grantRenCredit"),
    )
    for (const secretField of ["provider_id", "upstream_model_id", "inference_key_id", "idempotency_key", "pricing_snapshot", "provider_response_id"]) {
      expect(receiptSelector).not.toContain(secretField)
    }
  })
})
