import { desc, eq } from "@openwork-ee/den-db/drizzle"
import { OrganizationTable, RenCreditLedgerEntryTable, RenCreditWalletTable } from "@openwork-ee/den-db/schema"
import type { Hono } from "hono"
import { z } from "zod"
import { db } from "../../db.js"
import { adminRoute, jsonValidator } from "../../middleware/index.js"
import { denTypeIdSchema } from "../../openapi.js"
import {
  createOfflineOrder,
  listOfflineOffers,
  listOfflineOrders,
  reverseOfflineOrder,
} from "../../renwork-offline-order.js"
import { syncInferenceForOrganizationMembers } from "../../inference.js"
import type { AuthContextVariables } from "../../session.js"

const createOrderSchema = z.object({
  organizationId: denTypeIdSchema("organization"),
  offerId: z.string().trim().min(1).max(160),
  amountMinor: z.number().int().positive(),
  paymentMethod: z.enum(["bank_transfer", "wechat_offline", "alipay_offline", "cash", "other"]),
  paymentReference: z.string().trim().min(3).max(255),
  idempotencyKey: z.string().trim().min(8).max(255),
  note: z.string().trim().max(1000).nullable().optional(),
})

const reverseOrderSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
})

function statusForError(error: unknown): 400 | 404 | 409 | 500 {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") return 409
  if (!(error instanceof Error)) return 500
  if (error.message.endsWith("_NOT_FOUND")) return 404
  if (error.message.endsWith("_MISMATCH") || error.message.endsWith("_INVALID")) return 400
  if (error.message.endsWith("_CONFLICT")) return 409
  return 500
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
    return "RENWORK_OFFLINE_DUPLICATE_PAYMENT_REFERENCE"
  }
  return error instanceof Error ? error.message : "RENWORK_OFFLINE_ORDER_FAILED"
}

function serializeOrder<T extends { status: "active" | "reversed"; current_period_end: Date | string }>(order: T) {
  const effectiveStatus = order.status === "active" && new Date(order.current_period_end).getTime() <= Date.now()
    ? "expired"
    : order.status
  return { ...order, effective_status: effectiveStatus }
}

export function registerAdminOfflineCommerceRoutes<T extends { Variables: AuthContextVariables }>(app: Hono<T>) {
  app.get("/v1/admin/renwork/offline-orders/options", adminRoute(), async (c) => {
    return c.json({
      catalogVersion: listOfflineOffers()[0]?.catalogVersion ?? null,
      offers: listOfflineOffers(),
      note: "Every fixed-price personal and enterprise offer supports offline activation. Contract-priced offers require agreed terms to be published in the authoritative catalog before activation. No arbitrary RenCredit conversion is permitted.",
    })
  })

  app.get("/v1/admin/renwork/offline-orders", adminRoute(), async (c) => {
    const organizationId = c.req.query("organizationId")
    const parsedOrganizationId = organizationId ? denTypeIdSchema("organization").safeParse(organizationId) : null
    if (parsedOrganizationId && !parsedOrganizationId.success) {
      return c.json({ error: "invalid_organization_id" }, 400)
    }
    const orders = await listOfflineOrders({ organizationId: parsedOrganizationId?.data })
    const wallets = parsedOrganizationId?.data
      ? await db.select().from(RenCreditWalletTable)
          .where(eq(RenCreditWalletTable.organization_id, parsedOrganizationId.data)).limit(1)
      : []
    return c.json({ orders: orders.map(serializeOrder), wallet: wallets[0] ?? null })
  })

  app.post(
    "/v1/admin/renwork/offline-orders",
    adminRoute(),
    jsonValidator(createOrderSchema),
    async (c) => {
      const user = c.get("user")
      if (!user) return c.json({ error: "unauthorized" }, 401)
      try {
        const result = await createOfflineOrder({ ...c.req.valid("json"), actorUserId: user.id })
        let provisioningWarning: string | null = null
        try {
          await syncInferenceForOrganizationMembers({ organizationId: result.order.organization_id })
        } catch (error) {
          provisioningWarning = errorMessage(error)
        }
        return c.json({ ok: true, ...result, provisioningWarning }, result.replayed ? 200 : 201)
      } catch (error) {
        return c.json({ error: errorMessage(error) }, statusForError(error))
      }
    },
  )

  app.post(
    "/v1/admin/renwork/offline-orders/:orderId/reverse",
    adminRoute(),
    jsonValidator(reverseOrderSchema),
    async (c) => {
      const user = c.get("user")
      if (!user) return c.json({ error: "unauthorized" }, 401)
      const orderId = denTypeIdSchema("renworkOfflineOrder").safeParse(c.req.param("orderId"))
      if (!orderId.success) return c.json({ error: "invalid_order_id" }, 400)
      try {
        const result = await reverseOfflineOrder({ orderId: orderId.data, actorUserId: user.id, reason: c.req.valid("json").reason })
        let provisioningWarning: string | null = null
        try {
          await syncInferenceForOrganizationMembers({ organizationId: result.order.organization_id })
        } catch (error) {
          provisioningWarning = errorMessage(error)
        }
        return c.json({ ok: true, ...result, provisioningWarning })
      } catch (error) {
        return c.json({ error: errorMessage(error) }, statusForError(error))
      }
    },
  )

  app.get("/v1/admin/renwork/offline-orders/:organizationId/summary", adminRoute(), async (c) => {
    const organizationId = denTypeIdSchema("organization").safeParse(c.req.param("organizationId"))
    if (!organizationId.success) return c.json({ error: "invalid_organization_id" }, 400)
    const [organization] = await db.select({ id: OrganizationTable.id, name: OrganizationTable.name })
      .from(OrganizationTable).where(eq(OrganizationTable.id, organizationId.data)).limit(1)
    if (!organization) return c.json({ error: "RENWORK_ORGANIZATION_NOT_FOUND" }, 404)
    const [wallet, orders, ledger] = await Promise.all([
      db.select().from(RenCreditWalletTable).where(eq(RenCreditWalletTable.organization_id, organizationId.data)).limit(1),
      listOfflineOrders({ organizationId: organizationId.data, limit: 20 }),
      db.select({
        id: RenCreditLedgerEntryTable.id,
        entryType: RenCreditLedgerEntryTable.entry_type,
        amountMicroCredits: RenCreditLedgerEntryTable.amount_microcredits,
        availableDeltaMicroCredits: RenCreditLedgerEntryTable.available_delta_microcredits,
        availableBalanceAfter: RenCreditLedgerEntryTable.available_balance_after,
        reservedBalanceAfter: RenCreditLedgerEntryTable.reserved_balance_after,
        reasonCode: RenCreditLedgerEntryTable.reason_code,
        createdAt: RenCreditLedgerEntryTable.created_at,
      }).from(RenCreditLedgerEntryTable)
        .where(eq(RenCreditLedgerEntryTable.organization_id, organizationId.data))
        .orderBy(desc(RenCreditLedgerEntryTable.created_at))
        .limit(20),
    ])
    return c.json({ organization, wallet: wallet[0] ?? null, orders: orders.map(serializeOrder), ledger })
  })
}
