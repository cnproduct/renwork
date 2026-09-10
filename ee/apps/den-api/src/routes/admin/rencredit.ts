import type { Hono } from "hono"
import { z } from "zod"
import { adminRoute, jsonValidator } from "../../middleware/index.js"
import type { AuthContextVariables } from "../../session.js"
import { denTypeIdSchema } from "../../openapi.js"
import { grantRenCredit } from "../../rencredit-ledger.js"
import { and, desc, eq, inArray, sql } from "@openwork-ee/den-db/drizzle"
import {
  OrganizationTable,
  RenCreditLedgerEntryTable,
  RenCreditReservationTable,
  RenCreditWalletTable,
  RenCreditRuntimeDeviceTable,
} from "@openwork-ee/den-db/schema"
import { db } from "../../db.js"
import { PUBLISHED_DESKTOP_VERSIONS } from "../../generated/desktop-versions.js"
import { classifyClientVersion, runtimeHealthStatus } from "./runtime-health.js"

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

const runtimeHealthQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

function isoDate(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function registerAdminRenCreditRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get(
    "/v1/admin/rencredit/runtime-health",
    adminRoute(),
    async (c) => {
      const parsed = runtimeHealthQuerySchema.safeParse(c.req.query())
      if (!parsed.success) return c.json({ error: "invalid_query", details: parsed.error.flatten() }, 400)

      const generatedAt = new Date()
      const windowStart = new Date(generatedAt.getTime() - 24 * 60 * 60_000)
      const onlineSince = new Date(generatedAt.getTime() - 15 * 60_000)
      const currentClientVersion = PUBLISHED_DESKTOP_VERSIONS[0]
      const organizations = await db.select({
        id: OrganizationTable.id,
        name: OrganizationTable.name,
      }).from(OrganizationTable).orderBy(desc(OrganizationTable.updatedAt)).limit(parsed.data.limit)
      const organizationIds = organizations.map((organization) => organization.id)

      if (organizationIds.length === 0) {
        return c.json({
          generatedAt: generatedAt.toISOString(),
          windowHours: 24,
          currentClientVersion,
          summary: { organizations: 0, healthy: 0, warning: 0, critical: 0, idle: 0, reservations24h: 0, captures24h: 0, releases24h: 0, expiredReservations: 0, failureRate24h: 0, activeDevices: 0, onlineDevices: 0, outdatedDevices: 0, unknownVersionDevices: 0 },
          clientVersions: [],
          organizations: [],
        })
      }

      const [wallets, reservationRows, deviceRows, versionRows] = await Promise.all([
        db.select({
          organizationId: RenCreditWalletTable.organization_id,
          status: RenCreditWalletTable.status,
          availableMicroCredits: RenCreditWalletTable.available_microcredits,
          reservedMicroCredits: RenCreditWalletTable.reserved_microcredits,
          updatedAt: RenCreditWalletTable.updated_at,
        }).from(RenCreditWalletTable).where(inArray(RenCreditWalletTable.organization_id, organizationIds)),
        db.select({
          organizationId: RenCreditReservationTable.organization_id,
          reservations24h: sql<number>`sum(case when ${RenCreditReservationTable.created_at} >= ${windowStart} then 1 else 0 end)`,
          captures24h: sql<number>`sum(case when ${RenCreditReservationTable.created_at} >= ${windowStart} and ${RenCreditReservationTable.status} = 'captured' then 1 else 0 end)`,
          releases24h: sql<number>`sum(case when ${RenCreditReservationTable.created_at} >= ${windowStart} and ${RenCreditReservationTable.status} = 'released' then 1 else 0 end)`,
          failures24h: sql<number>`sum(case when ${RenCreditReservationTable.created_at} >= ${windowStart} and ${RenCreditReservationTable.status} = 'released' and ${RenCreditReservationTable.failure_code} is not null then 1 else 0 end)`,
          expiredReservations: sql<number>`sum(case when ${RenCreditReservationTable.status} = 'reserved' and ${RenCreditReservationTable.expires_at} < ${generatedAt} then 1 else 0 end)`,
          latestReservationAt: sql<Date | null>`max(${RenCreditReservationTable.created_at})`,
        }).from(RenCreditReservationTable)
          .where(inArray(RenCreditReservationTable.organization_id, organizationIds))
          .groupBy(RenCreditReservationTable.organization_id),
        db.select({
          organizationId: RenCreditRuntimeDeviceTable.organization_id,
          activeDevices: sql<number>`sum(case when ${RenCreditRuntimeDeviceTable.status} = 'active' then 1 else 0 end)`,
          pendingDevices: sql<number>`sum(case when ${RenCreditRuntimeDeviceTable.status} = 'pending' then 1 else 0 end)`,
          revokedDevices: sql<number>`sum(case when ${RenCreditRuntimeDeviceTable.status} = 'revoked' then 1 else 0 end)`,
          onlineDevices: sql<number>`sum(case when ${RenCreditRuntimeDeviceTable.status} = 'active' and ${RenCreditRuntimeDeviceTable.last_seen_at} >= ${onlineSince} then 1 else 0 end)`,
          latestSeenAt: sql<Date | null>`max(${RenCreditRuntimeDeviceTable.last_seen_at})`,
        }).from(RenCreditRuntimeDeviceTable)
          .where(inArray(RenCreditRuntimeDeviceTable.organization_id, organizationIds))
          .groupBy(RenCreditRuntimeDeviceTable.organization_id),
        db.select({
          organizationId: RenCreditRuntimeDeviceTable.organization_id,
          clientVersion: RenCreditRuntimeDeviceTable.client_version,
          deviceCount: sql<number>`count(*)`,
        }).from(RenCreditRuntimeDeviceTable)
          .where(and(
            inArray(RenCreditRuntimeDeviceTable.organization_id, organizationIds),
            eq(RenCreditRuntimeDeviceTable.status, "active"),
          ))
          .groupBy(RenCreditRuntimeDeviceTable.organization_id, RenCreditRuntimeDeviceTable.client_version),
      ])

      const walletByOrganization = new Map(wallets.map((wallet) => [wallet.organizationId, wallet]))
      const reservationsByOrganization = new Map(reservationRows.map((row) => [row.organizationId, row]))
      const devicesByOrganization = new Map(deviceRows.map((row) => [row.organizationId, row]))
      const versionsByOrganization = new Map<string, typeof versionRows>()
      for (const row of versionRows) {
        const current = versionsByOrganization.get(row.organizationId) ?? []
        current.push(row)
        versionsByOrganization.set(row.organizationId, current)
      }

      const organizationHealth = organizations.map((organization) => {
        const wallet = walletByOrganization.get(organization.id)
        const reservation = reservationsByOrganization.get(organization.id)
        const devices = devicesByOrganization.get(organization.id)
        const versions = (versionsByOrganization.get(organization.id) ?? []).map((entry) => ({
          version: entry.clientVersion,
          count: Number(entry.deviceCount),
          classification: classifyClientVersion(entry.clientVersion, currentClientVersion),
        }))
        const captures24h = Number(reservation?.captures24h ?? 0)
        const releases24h = Number(reservation?.releases24h ?? 0)
        const failures24h = Number(reservation?.failures24h ?? 0)
        const settled24h = captures24h + releases24h
        const failureRate24h = settled24h > 0 ? failures24h / settled24h : 0
        const outdatedDevices = versions.filter((entry) => entry.classification === "outdated").reduce((sum, entry) => sum + entry.count, 0)
        const unknownVersionDevices = versions.filter((entry) => entry.classification === "unknown").reduce((sum, entry) => sum + entry.count, 0)
        const values = {
          reservations24h: Number(reservation?.reservations24h ?? 0),
          captures24h,
          releases24h,
          failures24h,
          expiredReservations: Number(reservation?.expiredReservations ?? 0),
          activeDevices: Number(devices?.activeDevices ?? 0),
          pendingDevices: Number(devices?.pendingDevices ?? 0),
          revokedDevices: Number(devices?.revokedDevices ?? 0),
          onlineDevices: Number(devices?.onlineDevices ?? 0),
          outdatedDevices,
          unknownVersionDevices,
          failureRate24h,
        }
        return {
          organizationId: organization.id,
          organizationName: organization.name,
          status: runtimeHealthStatus({
            hasWallet: Boolean(wallet),
            walletStatus: wallet?.status ?? null,
            ...values,
          }),
          wallet: wallet ? {
            status: wallet.status,
            availableMicroCredits: wallet.availableMicroCredits,
            reservedMicroCredits: wallet.reservedMicroCredits,
            updatedAt: isoDate(wallet.updatedAt),
          } : null,
          ...values,
          latestSeenAt: isoDate(devices?.latestSeenAt ?? null),
          latestReservationAt: isoDate(reservation?.latestReservationAt ?? null),
          clientVersions: versions,
        }
      })

      const versionTotals = new Map<string, { version: string | null; count: number; classification: string }>()
      for (const row of versionRows) {
        const key = row.clientVersion ?? "unknown"
        const existing = versionTotals.get(key)
        const count = Number(row.deviceCount)
        if (existing) existing.count += count
        else versionTotals.set(key, { version: row.clientVersion, count, classification: classifyClientVersion(row.clientVersion, currentClientVersion) })
      }
      const sum = (field: keyof typeof organizationHealth[number]) => organizationHealth.reduce((total, organization) => total + Number(organization[field] ?? 0), 0)
      const settled24h = sum("captures24h") + sum("releases24h")
      return c.json({
        generatedAt: generatedAt.toISOString(),
        windowHours: 24,
        currentClientVersion,
        summary: {
          organizations: organizationHealth.length,
          healthy: organizationHealth.filter((organization) => organization.status === "healthy").length,
          warning: organizationHealth.filter((organization) => organization.status === "warning").length,
          critical: organizationHealth.filter((organization) => organization.status === "critical").length,
          idle: organizationHealth.filter((organization) => organization.status === "idle").length,
          reservations24h: sum("reservations24h"),
          captures24h: sum("captures24h"),
          releases24h: sum("releases24h"),
          expiredReservations: sum("expiredReservations"),
          failureRate24h: settled24h > 0 ? sum("failures24h") / settled24h : 0,
          activeDevices: sum("activeDevices"),
          onlineDevices: sum("onlineDevices"),
          outdatedDevices: sum("outdatedDevices"),
          unknownVersionDevices: sum("unknownVersionDevices"),
        },
        clientVersions: [...versionTotals.values()].sort((left, right) => right.count - left.count),
        organizations: organizationHealth,
      })
    },
  )

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
