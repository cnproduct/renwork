import { index, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar, bigint, int } from "drizzle-orm/mysql-core"
import { denTypeIdColumn, timestamps } from "../columns"

export const RenworkOfflineOrderStatus = ["active", "reversed"] as const
export const RenworkOfflinePaymentMethods = ["bank_transfer", "wechat_offline", "alipay_offline", "cash", "other"] as const

/**
 * Immutable evidence for a platform-admin recorded offline payment. The
 * catalog snapshot makes the exact offer, RenCredit grant and term auditable
 * even after a later catalog version is published.
 */
export const RenworkOfflineOrderTable = mysqlTable(
  "renwork_offline_orders",
  {
    id: denTypeIdColumn("renworkOfflineOrder", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    created_by_user_id: denTypeIdColumn("user", "created_by_user_id").notNull(),
    plan_id: varchar("plan_id", { length: 160 }).notNull(),
    offer_id: varchar("offer_id", { length: 160 }).notNull(),
    catalog_version: varchar("catalog_version", { length: 255 }).notNull(),
    status: mysqlEnum("status", RenworkOfflineOrderStatus).notNull().default("active"),
    currency: varchar("currency", { length: 3 }).notNull(),
    amount_minor: int("amount_minor").notNull(),
    granted_microcredits: bigint("granted_microcredits", { mode: "number" }).notNull(),
    payment_method: mysqlEnum("payment_method", RenworkOfflinePaymentMethods).notNull(),
    payment_reference: varchar("payment_reference", { length: 255 }).notNull(),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    current_period_start: timestamp("current_period_start", { fsp: 3 }).notNull(),
    current_period_end: timestamp("current_period_end", { fsp: 3 }).notNull(),
    seat_limit: int("seat_limit").notNull(),
    catalog_snapshot: json("catalog_snapshot").notNull(),
    model_policy_snapshot: json("model_policy_snapshot").notNull(),
    previous_entitlement_snapshot: json("previous_entitlement_snapshot").notNull(),
    note: varchar("note", { length: 1000 }),
    reversed_at: timestamp("reversed_at", { fsp: 3 }),
    reversed_by_user_id: denTypeIdColumn("user", "reversed_by_user_id"),
    reversal_reason: varchar("reversal_reason", { length: 1000 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("renwork_offline_orders_org_idempotency").on(table.organization_id, table.idempotency_key),
    uniqueIndex("renwork_offline_orders_payment_reference").on(table.payment_method, table.payment_reference),
    index("renwork_offline_orders_org_created").on(table.organization_id, table.created_at),
    index("renwork_offline_orders_status_period_end").on(table.status, table.current_period_end),
  ],
)
