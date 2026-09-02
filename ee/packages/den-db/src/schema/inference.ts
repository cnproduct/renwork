import { relations } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { INFERENCE_RESET_STRATEGIES, INFERENCE_WINDOW_TYPES } from "@openwork/types/den/inference"
import { denTypeIdColumn, encryptedTextColumn, timestamps } from "../columns"
import { MemberTable, OrganizationTable } from "./org"

export const InferenceKeyStatus = ["active", "revoked"] as const
export const InferenceOrgUpstreamProviderKeyStatus = ["active", "revoked"] as const
export const RenCreditWalletStatus = ["active", "suspended"] as const
export const RenCreditReservationStatus = ["reserved", "captured", "released"] as const
export const RenCreditLedgerEntryTypes = ["grant", "reserve", "capture", "release", "refund", "adjustment"] as const
export const RenCreditRuntimeDeviceStatus = ["pending", "active", "revoked"] as const

export const InferenceKeyTable = mysqlTable(
  "inference_keys",
  {
    id: denTypeIdColumn("inferenceKey", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    name: varchar("name", { length: 255 }),
    key_hash: varchar("key_hash", { length: 255 }).notNull(),
    key_prefix: varchar("key_prefix", { length: 32 }),
    status: mysqlEnum("status", InferenceKeyStatus).notNull().default("active"),
    revoked_at: timestamp("revoked_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inference_keys_key_hash").on(table.key_hash),
    index("inference_keys_organization_id").on(table.organization_id),
    index("inference_keys_org_membership_id").on(table.org_membership_id),
    index("inference_keys_status").on(table.status),
  ],
)

export const InferenceOrgLimitPolicyTable = mysqlTable(
  "inference_org_limit_policies",
  {
    id: denTypeIdColumn("inferenceOrgLimitPolicy", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    window_type: mysqlEnum("window_type", INFERENCE_WINDOW_TYPES).notNull(),
    reset_strategy: mysqlEnum("reset_strategy", INFERENCE_RESET_STRATEGIES).notNull(),
    anchor_at: timestamp("anchor_at", { fsp: 3 }),
    current_bucket_id: denTypeIdColumn("inferenceOrgUsageBucket", "current_bucket_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inference_org_limit_policies_org_window_type").on(
      table.organization_id,
      table.window_type,
    ),
  ],
)

export const InferenceOrgUsageBucketTable = mysqlTable(
  "inference_org_usage_buckets",
  {
    id: denTypeIdColumn("inferenceOrgUsageBucket", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    policy_id: denTypeIdColumn("inferenceOrgLimitPolicy", "policy_id").notNull(),
    window_start_at: timestamp("window_start_at", { fsp: 3 }).notNull(),
    window_end_at: timestamp("window_end_at", { fsp: 3 }).notNull(),
    limit_amount: bigint("limit_amount", { mode: "number" }).notNull(),
    used_amount: bigint("used_amount", { mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("inference_org_usage_buckets_org_window").on(
      table.organization_id,
      table.window_start_at,
      table.window_end_at,
    ),
    index("inference_org_usage_buckets_policy_window").on(
      table.policy_id,
      table.window_start_at,
      table.window_end_at,
    ),
  ],
)

// Stores organization-owned upstream provider credentials used by the inference proxy.
export const InferenceOrgUpstreamProviderKeyTable = mysqlTable(
  "inference_org_upstream_provider_keys",
  {
    id: denTypeIdColumn("inferenceOrgProviderKey", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    provider: varchar("provider", { length: 64 }).notNull().default("openrouter"),
    external_key_hash: varchar("external_key_hash", { length: 255 }),
    external_workspace_id: varchar("external_workspace_id", { length: 255 }),
    encrypted_api_key: encryptedTextColumn("encrypted_api_key").notNull(),
    key_prefix: varchar("key_prefix", { length: 32 }),
    status: mysqlEnum("status", InferenceOrgUpstreamProviderKeyStatus).notNull().default("active"),
    revoked_at: timestamp("revoked_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    index("inference_org_upstream_provider_keys_external_key_hash").on(table.external_key_hash),
    uniqueIndex("inference_org_upstream_provider_keys_org_provider").on(
      table.organization_id,
      table.provider,
    ),
    index("inference_org_upstream_provider_keys_status").on(table.status),
  ],
)

export const InferenceUsageLedgerEntryTable = mysqlTable(
  "inference_usage_ledger_entries",
  {
    id: denTypeIdColumn("inferenceUsageLedgerEntry", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    inference_key_id: denTypeIdColumn("inferenceKey", "inference_key_id"),
    external_job_id: varchar("external_job_id", { length: 255 }).notNull(),
    external_event_id: varchar("external_event_id", { length: 255 }),
    cost_amount: bigint("cost_amount", { mode: "number" }).notNull(),
    model_id: varchar("model_id", { length: 255 }),
    provider_id: varchar("provider_id", { length: 255 }),
    input_tokens: int("input_tokens"),
    output_tokens: int("output_tokens"),
    total_tokens: int("total_tokens"),
    event_type: varchar("event_type", { length: 64 }).notNull(),
    occurred_at: timestamp("occurred_at", { fsp: 3 }).notNull(),
    created_at: timestamps.created_at,
  },
  (table) => [
    index("inference_usage_ledger_entries_organization_id").on(table.organization_id),
    index("inference_usage_ledger_entries_org_membership_id").on(table.org_membership_id),
    index("inference_usage_ledger_entries_inference_key_id").on(table.inference_key_id),
    uniqueIndex("inference_usage_ledger_entries_external_event_id").on(table.external_event_id),
    uniqueIndex("inference_usage_ledger_entries_job_event_type").on(
      table.external_job_id,
      table.event_type,
    ),
  ],
)

export const InferenceUsageLedgerBucketChargeTable = mysqlTable(
  "inference_usage_ledger_bucket_charges",
  {
    id: denTypeIdColumn("inferenceUsageLedgerBucketCharge", "id").notNull().primaryKey(),
    ledger_entry_id: denTypeIdColumn("inferenceUsageLedgerEntry", "ledger_entry_id").notNull(),
    bucket_id: denTypeIdColumn("inferenceOrgUsageBucket", "bucket_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    created_at: timestamps.created_at,
  },
  (table) => [
    index("inference_usage_ledger_bucket_charges_bucket_id").on(table.bucket_id),
    uniqueIndex("inference_usage_ledger_bucket_charges_entry_bucket").on(
      table.ledger_entry_id,
      table.bucket_id,
    ),
  ],
)

/** Cloud-authoritative tenant balance. Values are RenCredit micro-units. */
export const RenCreditWalletTable = mysqlTable(
  "rencredit_wallets",
  {
    organization_id: denTypeIdColumn("organization", "organization_id").notNull().primaryKey(),
    available_microcredits: bigint("available_microcredits", { mode: "number" }).notNull().default(0),
    reserved_microcredits: bigint("reserved_microcredits", { mode: "number" }).notNull().default(0),
    status: mysqlEnum("status", RenCreditWalletStatus).notNull().default("active"),
    version: int("version").notNull().default(1),
    ...timestamps,
  },
)

/** Immutable pricing snapshot plus the mutable settlement state for one run. */
export const RenCreditReservationTable = mysqlTable(
  "rencredit_reservations",
  {
    id: denTypeIdColumn("renCreditReservation", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    inference_key_id: denTypeIdColumn("inferenceKey", "inference_key_id"),
    run_id: varchar("run_id", { length: 255 }).notNull(),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    model_sku: varchar("model_sku", { length: 255 }).notNull(),
    catalog_version: varchar("catalog_version", { length: 255 }).notNull(),
    route_id: varchar("route_id", { length: 255 }).notNull(),
    provider_id: varchar("provider_id", { length: 255 }).notNull(),
    upstream_model_id: varchar("upstream_model_id", { length: 255 }).notNull(),
    billing_mode: varchar("billing_mode", { length: 32 }).notNull(),
    reserved_microcredits: bigint("reserved_microcredits", { mode: "number" }).notNull(),
    captured_microcredits: bigint("captured_microcredits", { mode: "number" }).notNull().default(0),
    released_microcredits: bigint("released_microcredits", { mode: "number" }).notNull().default(0),
    estimated_usage: json("estimated_usage").notNull(),
    actual_usage: json("actual_usage"),
    pricing_snapshot: json("pricing_snapshot").notNull(),
    status: mysqlEnum("status", RenCreditReservationStatus).notNull().default("reserved"),
    provider_response_id: varchar("provider_response_id", { length: 255 }),
    failure_code: varchar("failure_code", { length: 128 }),
    has_result: boolean("has_result").notNull().default(false),
    expires_at: timestamp("expires_at", { fsp: 3 }).notNull(),
    settled_at: timestamp("settled_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rencredit_reservations_org_idempotency").on(table.organization_id, table.idempotency_key),
    uniqueIndex("rencredit_reservations_org_run").on(table.organization_id, table.run_id),
    index("rencredit_reservations_org_status").on(table.organization_id, table.status),
    index("rencredit_reservations_inference_key").on(table.inference_key_id),
  ],
)

/** Append-only double-entry audit rows. Application code never updates these rows. */
export const RenCreditLedgerEntryTable = mysqlTable(
  "rencredit_ledger_entries",
  {
    id: denTypeIdColumn("renCreditLedgerEntry", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    reservation_id: denTypeIdColumn("renCreditReservation", "reservation_id"),
    entry_type: mysqlEnum("entry_type", RenCreditLedgerEntryTypes).notNull(),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    amount_microcredits: bigint("amount_microcredits", { mode: "number" }).notNull(),
    available_delta_microcredits: bigint("available_delta_microcredits", { mode: "number" }).notNull(),
    reserved_delta_microcredits: bigint("reserved_delta_microcredits", { mode: "number" }).notNull(),
    available_balance_after: bigint("available_balance_after", { mode: "number" }).notNull(),
    reserved_balance_after: bigint("reserved_balance_after", { mode: "number" }).notNull(),
    wallet_version_after: int("wallet_version_after").notNull(),
    reason_code: varchar("reason_code", { length: 128 }).notNull(),
    metadata: json("metadata"),
    created_at: timestamps.created_at,
  },
  (table) => [
    uniqueIndex("rencredit_ledger_org_idempotency").on(table.organization_id, table.idempotency_key),
    index("rencredit_ledger_org_created").on(table.organization_id, table.created_at),
    index("rencredit_ledger_reservation").on(table.reservation_id),
  ],
)

/** Provider-reported usage events; unique per tenant/provider response for retry safety. */
export const RenCreditUsageEventTable = mysqlTable(
  "rencredit_usage_events",
  {
    id: denTypeIdColumn("renCreditUsageEvent", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    reservation_id: denTypeIdColumn("renCreditReservation", "reservation_id").notNull(),
    provider_response_id: varchar("provider_response_id", { length: 255 }).notNull(),
    provider_id: varchar("provider_id", { length: 255 }).notNull(),
    model_sku: varchar("model_sku", { length: 255 }).notNull(),
    input_tokens: int("input_tokens").notNull().default(0),
    output_tokens: int("output_tokens").notNull().default(0),
    reasoning_tokens: int("reasoning_tokens").notNull().default(0),
    cache_read_tokens: int("cache_read_tokens").notNull().default(0),
    cache_write_tokens: int("cache_write_tokens").notNull().default(0),
    accuracy: mysqlEnum("accuracy", ["reported", "estimated", "tokenizer"]).notNull(),
    occurred_at: timestamp("occurred_at", { fsp: 3 }).notNull(),
    created_at: timestamps.created_at,
  },
  (table) => [
    uniqueIndex("rencredit_usage_org_provider_response").on(table.organization_id, table.provider_response_id),
    index("rencredit_usage_reservation").on(table.reservation_id),
    index("rencredit_usage_org_created").on(table.organization_id, table.created_at),
  ],
)

/** Approved device keys for content-free local runtime metering receipts. */
export const RenCreditRuntimeDeviceTable = mysqlTable(
  "rencredit_runtime_devices",
  {
    id: varchar("id", { length: 64 }).notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    inference_key_id: denTypeIdColumn("inferenceKey", "inference_key_id").notNull(),
    device_id: varchar("device_id", { length: 255 }).notNull(),
    public_key_pem: varchar("public_key_pem", { length: 1024 }).notNull(),
    public_key_fingerprint: varchar("public_key_fingerprint", { length: 64 }).notNull(),
    status: mysqlEnum("status", RenCreditRuntimeDeviceStatus).notNull().default("pending"),
    revoked_at: timestamp("revoked_at", { fsp: 3 }),
    last_seen_at: timestamp("last_seen_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rencredit_runtime_devices_org_member_device").on(
      table.organization_id,
      table.org_membership_id,
      table.device_id,
    ),
    index("rencredit_runtime_devices_inference_key").on(table.inference_key_id),
    index("rencredit_runtime_devices_status").on(table.status),
  ],
)

export const inferenceKeyRelations = relations(InferenceKeyTable, ({ many, one }) => ({
  organization: one(OrganizationTable, {
    fields: [InferenceKeyTable.organization_id],
    references: [OrganizationTable.id],
  }),
  orgMembership: one(MemberTable, {
    fields: [InferenceKeyTable.org_membership_id],
    references: [MemberTable.id],
  }),
  ledgerEntries: many(InferenceUsageLedgerEntryTable),
}))

export const inferenceOrgLimitPolicyRelations = relations(
  InferenceOrgLimitPolicyTable,
  ({ many, one }) => ({
    organization: one(OrganizationTable, {
      fields: [InferenceOrgLimitPolicyTable.organization_id],
      references: [OrganizationTable.id],
    }),
    buckets: many(InferenceOrgUsageBucketTable),
  }),
)

export const inferenceOrgUsageBucketRelations = relations(
  InferenceOrgUsageBucketTable,
  ({ many, one }) => ({
    organization: one(OrganizationTable, {
      fields: [InferenceOrgUsageBucketTable.organization_id],
      references: [OrganizationTable.id],
    }),
    policy: one(InferenceOrgLimitPolicyTable, {
      fields: [InferenceOrgUsageBucketTable.policy_id],
      references: [InferenceOrgLimitPolicyTable.id],
    }),
    charges: many(InferenceUsageLedgerBucketChargeTable),
  }),
)

export const inferenceOrgUpstreamProviderKeyRelations = relations(
  InferenceOrgUpstreamProviderKeyTable,
  ({ one }) => ({
    organization: one(OrganizationTable, {
      fields: [InferenceOrgUpstreamProviderKeyTable.organization_id],
      references: [OrganizationTable.id],
    }),
  }),
)

export const inferenceUsageLedgerEntryRelations = relations(
  InferenceUsageLedgerEntryTable,
  ({ many, one }) => ({
    organization: one(OrganizationTable, {
      fields: [InferenceUsageLedgerEntryTable.organization_id],
      references: [OrganizationTable.id],
    }),
    orgMembership: one(MemberTable, {
      fields: [InferenceUsageLedgerEntryTable.org_membership_id],
      references: [MemberTable.id],
    }),
    inferenceKey: one(InferenceKeyTable, {
      fields: [InferenceUsageLedgerEntryTable.inference_key_id],
      references: [InferenceKeyTable.id],
    }),
    bucketCharges: many(InferenceUsageLedgerBucketChargeTable),
  }),
)

export const inferenceUsageLedgerBucketChargeRelations = relations(
  InferenceUsageLedgerBucketChargeTable,
  ({ one }) => ({
    ledgerEntry: one(InferenceUsageLedgerEntryTable, {
      fields: [InferenceUsageLedgerBucketChargeTable.ledger_entry_id],
      references: [InferenceUsageLedgerEntryTable.id],
    }),
    bucket: one(InferenceOrgUsageBucketTable, {
      fields: [InferenceUsageLedgerBucketChargeTable.bucket_id],
      references: [InferenceOrgUsageBucketTable.id],
    }),
  }),
)

export const inferenceKey = InferenceKeyTable
export const inferenceOrgLimitPolicy = InferenceOrgLimitPolicyTable
export const inferenceOrgUsageBucket = InferenceOrgUsageBucketTable
export const inferenceOrgUpstreamProviderKey = InferenceOrgUpstreamProviderKeyTable
export const inferenceUsageLedgerEntry = InferenceUsageLedgerEntryTable
export const inferenceUsageLedgerBucketCharge = InferenceUsageLedgerBucketChargeTable
export const renCreditWallet = RenCreditWalletTable
export const renCreditReservation = RenCreditReservationTable
export const renCreditLedgerEntry = RenCreditLedgerEntryTable
export const renCreditUsageEvent = RenCreditUsageEventTable
export const renCreditRuntimeDevice = RenCreditRuntimeDeviceTable
