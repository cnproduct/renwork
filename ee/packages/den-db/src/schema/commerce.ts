import {
  bigint,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { denTypeIdColumn, timestamps } from "../columns"

export const RenworkPaymentChannels = ["wechat_pay", "alipay"] as const
export const CommerceOrderStatuses = ["pending", "paid", "fulfilled", "closed", "failed", "refunded"] as const
export const CommerceRefundStatuses = ["pending", "succeeded", "failed"] as const
export const RenworkPlanSubscriptionStatuses = ["active", "expired", "refunded"] as const

export const CommerceOrderTable = mysqlTable(
  "commerce_orders",
  {
    id: denTypeIdColumn("commerceOrder", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    created_by_member_id: denTypeIdColumn("member", "created_by_member_id").notNull(),
    plan_id: varchar("plan_id", { length: 160 }).notNull(),
    offer_id: varchar("offer_id", { length: 160 }).notNull(),
    catalog_version: varchar("catalog_version", { length: 160 }).notNull(),
    channel: mysqlEnum("channel", RenworkPaymentChannels).notNull(),
    status: mysqlEnum("status", CommerceOrderStatuses).notNull().default("pending"),
    currency: varchar("currency", { length: 3 }).notNull(),
    amount_minor: bigint("amount_minor", { mode: "number" }).notNull(),
    included_rencredits: bigint("included_rencredits", { mode: "number" }).notNull(),
    provider_order_id: varchar("provider_order_id", { length: 255 }).notNull(),
    provider_transaction_id: varchar("provider_transaction_id", { length: 255 }),
    checkout_url: varchar("checkout_url", { length: 2048 }),
    qr_code_url: varchar("qr_code_url", { length: 2048 }),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    catalog_snapshot: json("catalog_snapshot").notNull(),
    expires_at: timestamp("expires_at", { fsp: 3 }).notNull(),
    paid_at: timestamp("paid_at", { fsp: 3 }),
    fulfilled_at: timestamp("fulfilled_at", { fsp: 3 }),
    closed_at: timestamp("closed_at", { fsp: 3 }),
    last_error_code: varchar("last_error_code", { length: 128 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_orders_org_idempotency").on(table.organization_id, table.idempotency_key),
    uniqueIndex("commerce_orders_channel_provider_order").on(table.channel, table.provider_order_id),
    index("commerce_orders_org_created").on(table.organization_id, table.created_at),
    index("commerce_orders_status_expires").on(table.status, table.expires_at),
  ],
)

export const CommercePaymentEventTable = mysqlTable(
  "commerce_payment_events",
  {
    id: denTypeIdColumn("commercePaymentEvent", "id").notNull().primaryKey(),
    order_id: denTypeIdColumn("commerceOrder", "order_id").notNull(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    channel: mysqlEnum("channel", RenworkPaymentChannels).notNull(),
    provider_event_id: varchar("provider_event_id", { length: 255 }).notNull(),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    payload_hash: varchar("payload_hash", { length: 64 }).notNull(),
    verified: mysqlEnum("verified", ["yes", "no"]).notNull(),
    processed_at: timestamp("processed_at", { fsp: 3 }),
    created_at: timestamps.created_at,
  },
  (table) => [
    uniqueIndex("commerce_payment_events_provider_event").on(table.channel, table.provider_event_id),
    index("commerce_payment_events_order").on(table.order_id),
    index("commerce_payment_events_org").on(table.organization_id),
  ],
)

export const RenworkPlanSubscriptionTable = mysqlTable(
  "renwork_plan_subscriptions",
  {
    id: denTypeIdColumn("renworkPlanSubscription", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    source_order_id: denTypeIdColumn("commerceOrder", "source_order_id").notNull(),
    plan_id: varchar("plan_id", { length: 160 }).notNull(),
    offer_id: varchar("offer_id", { length: 160 }).notNull(),
    catalog_version: varchar("catalog_version", { length: 160 }).notNull(),
    billing_interval: mysqlEnum("billing_interval", ["monthly", "annual"]).notNull(),
    status: mysqlEnum("status", RenworkPlanSubscriptionStatuses).notNull().default("active"),
    current_period_start: timestamp("current_period_start", { fsp: 3 }).notNull(),
    current_period_end: timestamp("current_period_end", { fsp: 3 }).notNull(),
    next_credit_grant_at: timestamp("next_credit_grant_at", { fsp: 3 }),
    granted_rencredits: bigint("granted_rencredits", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("renwork_plan_subscriptions_source_order").on(table.source_order_id),
    index("renwork_plan_subscriptions_org_status").on(table.organization_id, table.status),
    index("renwork_plan_subscriptions_next_grant").on(table.status, table.next_credit_grant_at),
  ],
)

export const CommerceRefundTable = mysqlTable(
  "commerce_refunds",
  {
    id: denTypeIdColumn("commerceRefund", "id").notNull().primaryKey(),
    order_id: denTypeIdColumn("commerceOrder", "order_id").notNull(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    amount_minor: bigint("amount_minor", { mode: "number" }).notNull(),
    provider_refund_id: varchar("provider_refund_id", { length: 255 }).notNull(),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    status: mysqlEnum("status", CommerceRefundStatuses).notNull().default("pending"),
    reason: varchar("reason", { length: 255 }).notNull(),
    completed_at: timestamp("completed_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("commerce_refunds_org_idempotency").on(table.organization_id, table.idempotency_key),
    uniqueIndex("commerce_refunds_provider_refund").on(table.provider_refund_id),
    index("commerce_refunds_order").on(table.order_id),
  ],
)
