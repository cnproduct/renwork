import { bigint, index, int, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { denTypeIdColumn, longBlobColumn, timestamps } from "../columns"

export const VideoGenerationQuoteTable = mysqlTable(
  "video_generation_quotes",
  {
    id: denTypeIdColumn("videoGenerationQuote", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    mode: mysqlEnum("mode", ["text_to_video", "first_frame_to_video"]).notNull(),
    resolution: varchar("resolution", { length: 16 }).notNull(),
    duration_seconds: int("duration_seconds").notNull(),
    aspect_ratio: varchar("aspect_ratio", { length: 16 }).notNull(),
    directed_prompt: varchar("directed_prompt", { length: 6000 }).notNull(),
    input_snapshot: json("input_snapshot").notNull(),
    amount_microcredits: bigint("amount_microcredits", { mode: "number" }).notNull(),
    price_version: varchar("price_version", { length: 128 }).notNull(),
    expires_at: timestamp("expires_at", { fsp: 3 }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("video_quotes_org_member_created").on(table.organization_id, table.org_membership_id, table.created_at),
    index("video_quotes_expires").on(table.expires_at),
  ],
)

export const VideoGenerationJobTable = mysqlTable(
  "video_generation_jobs",
  {
    id: denTypeIdColumn("videoGenerationJob", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    quote_id: denTypeIdColumn("videoGenerationQuote", "quote_id").notNull(),
    rencredit_reservation_id: denTypeIdColumn("renCreditReservation", "rencredit_reservation_id").notNull(),
    idempotency_key: varchar("idempotency_key", { length: 255 }).notNull(),
    mode: mysqlEnum("mode", ["text_to_video", "first_frame_to_video"]).notNull(),
    resolution: varchar("resolution", { length: 16 }).notNull(),
    duration_seconds: int("duration_seconds").notNull(),
    aspect_ratio: varchar("aspect_ratio", { length: 16 }).notNull(),
    provider_id: varchar("provider_id", { length: 128 }).notNull(),
    provider_task_id: varchar("provider_task_id", { length: 255 }),
    submission_claim: varchar("submission_claim", { length: 64 }),
    submission_claimed_at: timestamp("submission_claimed_at", { fsp: 3 }),
    price_version: varchar("price_version", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["submitted", "running", "succeeded", "failed"]).notNull().default("submitted"),
    settlement_status: mysqlEnum("settlement_status", ["reserved", "captured", "released"]).notNull().default("reserved"),
    task_hash: varchar("task_hash", { length: 64 }).notNull(),
    result_asset_id: denTypeIdColumn("videoGenerationAsset", "result_asset_id"),
    result_hash: varchar("result_hash", { length: 64 }),
    failure_code: varchar("failure_code", { length: 128 }),
    last_reconciled_at: timestamp("last_reconciled_at", { fsp: 3 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("video_jobs_org_member_idempotency").on(table.organization_id, table.org_membership_id, table.idempotency_key),
    uniqueIndex("video_jobs_org_provider_task").on(table.organization_id, table.provider_task_id),
    index("video_jobs_org_member_created").on(table.organization_id, table.org_membership_id, table.created_at),
    index("video_jobs_org_status").on(table.organization_id, table.status),
  ],
)

export const VideoGenerationAssetTable = mysqlTable(
  "video_generation_assets",
  {
    id: denTypeIdColumn("videoGenerationAsset", "id").notNull().primaryKey(),
    organization_id: denTypeIdColumn("organization", "organization_id").notNull(),
    org_membership_id: denTypeIdColumn("member", "org_membership_id").notNull(),
    job_id: denTypeIdColumn("videoGenerationJob", "job_id"),
    kind: mysqlEnum("kind", ["first_frame", "result_video"]).notNull(),
    content_type: varchar("content_type", { length: 128 }).notNull(),
    result_bytes: longBlobColumn("result_bytes").notNull(),
    result_hash: varchar("result_hash", { length: 64 }).notNull(),
    byte_length: bigint("byte_length", { mode: "number" }).notNull(),
    created_at: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [
    index("video_assets_org_member_result_hash").on(table.organization_id, table.org_membership_id, table.result_hash),
    uniqueIndex("video_assets_job").on(table.job_id),
    index("video_assets_org_member_kind").on(table.organization_id, table.org_membership_id, table.kind),
  ],
)
