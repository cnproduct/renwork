import type { Hono } from "hono"
import { z } from "zod"
import { adminRoute, jsonValidator } from "../../middleware/index.js"
import type { AuthContextVariables } from "../../session.js"
import { denTypeIdSchema } from "../../openapi.js"
import { grantRenCredit } from "../../rencredit-ledger.js"
import { and, desc, eq } from "@openwork-ee/den-db/drizzle"
import {
  OrganizationTable,
  RenCreditLedgerEntryTable,
  RenCreditReservationTable,
  RenCreditWalletTable,
} from "@openwork-ee/den-db/schema"
import { db } from "../../db.js"

const grantSchema = z.object({
  organizationId: denTypeIdSchema("organization"),
  amountMicroCredits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.string().trim().min(8).max(255),
  reasonCode: z.string().trim().min(1).max(128),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const settlementQuerySchema = z.object({
  organizationId: denTypeIdSchema("organization").optional(),
  status: z.enum(["reserved", "captured", "released"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

function isoDate(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function registerAdminRenCreditRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get(
    "/v1/admin/rencredit/settlements",
    adminRoute(),
    async (c) => {
      const parsed = settlementQuerySchema.safeParse(c.req.query())
      if (!parsed.success) return c.json({ error: "invalid_query", details: parsed.error.flatten() }, 400)

      const { organizationId, status, limit } = parsed.data
      const reservationFilters = [
        ...(organizationId ? [eq(RenCreditReservationTable.organization_id, organizationId)] : []),
        ...(status ? [eq(RenCreditReservationTable.status, status)] : []),
      ]

      const wallets = organizationId
        ? await db.select({
            organizationId: RenCreditWalletTable.organization_id,
            organizationName: OrganizationTable.name,
            availableMicroCredits: RenCreditWalletTable.available_microcredits,
            reservedMicroCredits: RenCreditWalletTable.reserved_microcredits,
            status: RenCreditWalletTable.status,
            version: RenCreditWalletTable.version,
            updatedAt: RenCreditWalletTable.updated_at,
          }).from(RenCreditWalletTable)
            .leftJoin(OrganizationTable, eq(RenCreditWalletTable.organization_id, OrganizationTable.id))
            .where(eq(RenCreditWalletTable.organization_id, organizationId))
        : await db.select({
            organizationId: RenCreditWalletTable.organization_id,
            organizationName: OrganizationTable.name,
            availableMicroCredits: RenCreditWalletTable.available_microcredits,
            reservedMicroCredits: RenCreditWalletTable.reserved_microcredits,
            status: RenCreditWalletTable.status,
            version: RenCreditWalletTable.version,
            updatedAt: RenCreditWalletTable.updated_at,
          }).from(RenCreditWalletTable)
            .leftJoin(OrganizationTable, eq(RenCreditWalletTable.organization_id, OrganizationTable.id))
            .orderBy(desc(RenCreditWalletTable.updated_at))
            .limit(limit)

      const reservationSelection = {
        id: RenCreditReservationTable.id,
        organizationId: RenCreditReservationTable.organization_id,
        organizationName: OrganizationTable.name,
        memberId: RenCreditReservationTable.org_membership_id,
        runId: RenCreditReservationTable.run_id,
        modelSku: RenCreditReservationTable.model_sku,
        routeId: RenCreditReservationTable.route_id,
        providerId: RenCreditReservationTable.provider_id,
        upstreamModelId: RenCreditReservationTable.upstream_model_id,
        billingMode: RenCreditReservationTable.billing_mode,
        status: RenCreditReservationTable.status,
        reservedMicroCredits: RenCreditReservationTable.reserved_microcredits,
        capturedMicroCredits: RenCreditReservationTable.captured_microcredits,
        releasedMicroCredits: RenCreditReservationTable.released_microcredits,
        actualUsage: RenCreditReservationTable.actual_usage,
        failureCode: RenCreditReservationTable.failure_code,
        hasResult: RenCreditReservationTable.has_result,
        createdAt: RenCreditReservationTable.created_at,
        settledAt: RenCreditReservationTable.settled_at,
      }
      const reservations = reservationFilters.length > 0
        ? await db.select(reservationSelection).from(RenCreditReservationTable)
            .leftJoin(OrganizationTable, eq(RenCreditReservationTable.organization_id, OrganizationTable.id))
            .where(and(...reservationFilters))
            .orderBy(desc(RenCreditReservationTable.created_at))
            .limit(limit)
        : await db.select(reservationSelection).from(RenCreditReservationTable)
            .leftJoin(OrganizationTable, eq(RenCreditReservationTable.organization_id, OrganizationTable.id))
            .orderBy(desc(RenCreditReservationTable.created_at))
            .limit(limit)

      const ledger = organizationId
        ? await db.select({
            id: RenCreditLedgerEntryTable.id,
            organizationId: RenCreditLedgerEntryTable.organization_id,
            organizationName: OrganizationTable.name,
            reservationId: RenCreditLedgerEntryTable.reservation_id,
            entryType: RenCreditLedgerEntryTable.entry_type,
            amountMicroCredits: RenCreditLedgerEntryTable.amount_microcredits,
            availableDeltaMicroCredits: RenCreditLedgerEntryTable.available_delta_microcredits,
            reservedDeltaMicroCredits: RenCreditLedgerEntryTable.reserved_delta_microcredits,
            availableBalanceAfter: RenCreditLedgerEntryTable.available_balance_after,
            reservedBalanceAfter: RenCreditLedgerEntryTable.reserved_balance_after,
            reasonCode: RenCreditLedgerEntryTable.reason_code,
            createdAt: RenCreditLedgerEntryTable.created_at,
          }).from(RenCreditLedgerEntryTable)
            .leftJoin(OrganizationTable, eq(RenCreditLedgerEntryTable.organization_id, OrganizationTable.id))
            .where(eq(RenCreditLedgerEntryTable.organization_id, organizationId))
            .orderBy(desc(RenCreditLedgerEntryTable.created_at))
            .limit(limit)
        : await db.select({
            id: RenCreditLedgerEntryTable.id,
            organizationId: RenCreditLedgerEntryTable.organization_id,
            organizationName: OrganizationTable.name,
            reservationId: RenCreditLedgerEntryTable.reservation_id,
            entryType: RenCreditLedgerEntryTable.entry_type,
            amountMicroCredits: RenCreditLedgerEntryTable.amount_microcredits,
            availableDeltaMicroCredits: RenCreditLedgerEntryTable.available_delta_microcredits,
            reservedDeltaMicroCredits: RenCreditLedgerEntryTable.reserved_delta_microcredits,
            availableBalanceAfter: RenCreditLedgerEntryTable.available_balance_after,
            reservedBalanceAfter: RenCreditLedgerEntryTable.reserved_balance_after,
            reasonCode: RenCreditLedgerEntryTable.reason_code,
            createdAt: RenCreditLedgerEntryTable.created_at,
          }).from(RenCreditLedgerEntryTable)
            .leftJoin(OrganizationTable, eq(RenCreditLedgerEntryTable.organization_id, OrganizationTable.id))
            .orderBy(desc(RenCreditLedgerEntryTable.created_at))
            .limit(limit)

      return c.json({
        generatedAt: new Date().toISOString(),
        wallets: wallets.map((wallet) => ({ ...wallet, updatedAt: isoDate(wallet.updatedAt) })),
        reservations: reservations.map((reservation) => ({
          ...reservation,
          createdAt: isoDate(reservation.createdAt),
          settledAt: isoDate(reservation.settledAt),
        })),
        ledger: ledger.map((entry) => ({ ...entry, createdAt: isoDate(entry.createdAt) })),
      })
    },
  )

  app.post(
    "/v1/admin/rencredit/grants",
    adminRoute(),
    jsonValidator(grantSchema),
    async (c) => {
      const input = c.req.valid("json")
      const wallet = await grantRenCredit(input)
      return c.json({ ok: true, wallet })
    },
  )
}
