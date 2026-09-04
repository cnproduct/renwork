import { index, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar, bigint, int } from "drizzle-orm/mysql-core"
import { denTypeIdColumn, timestamps } from "../columns"

export const RenworkOfflineOrderStatus = ["active", "reversed"] as const
export const RenworkOfflinePaymentMethods = ["bank_transfer", "wechat_offline", "alipay_offline", "cash", "other"] as const
export const RenworkContractQuoteStatus = ["draft", "approved", "published", "revoked"] as const

/**
 * Organization-bound commercial terms for the enterprise custom plan. A quote
 * is editable only while it is a draft, must be approved by a second platform
 * administrator, and becomes orderable only after publication.
 */
export const RenworkContractQuoteTable = mysqlTable(
  "renwork_contract_quotes",
  {
    id: denTypeIdColumn("renworkContractQuote", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    created_by_user_id: denTypeIdColumn("user", "created_by_user_id").notNull(),
    approved_by_user_id: denTypeIdColumn("user", "approved_by_user_id"),
    published_by_user_id: denTypeIdColumn("user", "published_by_user_id"),
    status: mysqlEnum("status", RenworkContractQuoteStatus).notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull().default("CNY"),
    amount_minor: int("amount_minor").notNull(),
    included_rencredits: int("included_rencredits").notNull(),
    seat_limit: int("seat_limit").notNull(),
    billing_interval: mysqlEnum("billing_interval", ["monthly", "annual"]).notNull(),
    contract_reference: varchar("contract_reference", { length: 255 }).notNull(),
    note: varchar("note", { length: 1000 }),
    approved_at: timestamp("approved_at", { fsp: 3 }),
    published_at: timestamp("published_at", { fsp: 3 }),
    revoked_at: timestamp("revoked_at", { fsp: 3 }),
    revoke_reason: varchar("revoke_reason", { length: 1000 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("renwork_contract_quotes_org_reference").on(table.organization_id, table.contract_reference),
    index("renwork_contract_quotes_org_status").on(table.organization_id, table.status),
    index("renwork_contract_quotes_created").on(table.created_at),
  ],
)

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
