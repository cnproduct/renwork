CREATE TABLE `rencredit_ledger_entries` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`reservation_id` varchar(64),
	`entry_type` enum('grant','reserve','capture','release','refund','adjustment') NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`amount_microcredits` bigint NOT NULL,
	`available_delta_microcredits` bigint NOT NULL,
	`reserved_delta_microcredits` bigint NOT NULL,
	`available_balance_after` bigint NOT NULL,
	`reserved_balance_after` bigint NOT NULL,
	`wallet_version_after` int NOT NULL,
	`reason_code` varchar(128) NOT NULL,
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `rencredit_ledger_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `rencredit_ledger_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `rencredit_reservations` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`org_membership_id` varchar(64) NOT NULL,
	`inference_key_id` varchar(64) NOT NULL,
	`run_id` varchar(255) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`model_sku` varchar(255) NOT NULL,
	`catalog_version` varchar(255) NOT NULL,
	`route_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`upstream_model_id` varchar(255) NOT NULL,
	`billing_mode` varchar(32) NOT NULL,
	`reserved_microcredits` bigint NOT NULL,
	`captured_microcredits` bigint NOT NULL DEFAULT 0,
	`released_microcredits` bigint NOT NULL DEFAULT 0,
	`estimated_usage` json NOT NULL,
	`actual_usage` json,
	`pricing_snapshot` json NOT NULL,
	`status` enum('reserved','captured','released') NOT NULL DEFAULT 'reserved',
	`provider_response_id` varchar(255),
	`failure_code` varchar(128),
	`has_result` boolean NOT NULL DEFAULT false,
	`expires_at` timestamp(3) NOT NULL,
	`settled_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `rencredit_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `rencredit_reservations_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `rencredit_reservations_org_run` UNIQUE(`organization_id`,`run_id`)
);
--> statement-breakpoint
CREATE TABLE `rencredit_usage_events` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`reservation_id` varchar(64) NOT NULL,
	`provider_response_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`model_sku` varchar(255) NOT NULL,
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`reasoning_tokens` int NOT NULL DEFAULT 0,
	`cache_read_tokens` int NOT NULL DEFAULT 0,
	`cache_write_tokens` int NOT NULL DEFAULT 0,
	`accuracy` enum('reported','estimated') NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `rencredit_usage_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `rencredit_usage_org_provider_response` UNIQUE(`organization_id`,`provider_response_id`)
);
--> statement-breakpoint
CREATE TABLE `rencredit_wallets` (
	`organization_id` varchar(64) NOT NULL,
	`available_microcredits` bigint NOT NULL DEFAULT 0,
	`reserved_microcredits` bigint NOT NULL DEFAULT 0,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `rencredit_wallets_organization_id` PRIMARY KEY(`organization_id`)
);
--> statement-breakpoint
CREATE INDEX `rencredit_ledger_org_created` ON `rencredit_ledger_entries` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `rencredit_ledger_reservation` ON `rencredit_ledger_entries` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `rencredit_reservations_org_status` ON `rencredit_reservations` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `rencredit_reservations_inference_key` ON `rencredit_reservations` (`inference_key_id`);--> statement-breakpoint
CREATE INDEX `rencredit_usage_reservation` ON `rencredit_usage_events` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `rencredit_usage_org_created` ON `rencredit_usage_events` (`organization_id`,`created_at`);