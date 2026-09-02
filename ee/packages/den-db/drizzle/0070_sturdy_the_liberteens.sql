CREATE TABLE `video_generation_assets` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`org_membership_id` varchar(64) NOT NULL,
	`job_id` varchar(64),
	`kind` enum('first_frame','result_video') NOT NULL,
	`content_type` varchar(128) NOT NULL,
	`result_bytes` longblob NOT NULL,
	`result_hash` varchar(64) NOT NULL,
	`byte_length` bigint NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `video_generation_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_assets_job` UNIQUE(`job_id`)
);
--> statement-breakpoint
CREATE TABLE `video_generation_jobs` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`org_membership_id` varchar(64) NOT NULL,
	`quote_id` varchar(64) NOT NULL,
	`rencredit_reservation_id` varchar(64) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`mode` enum('text_to_video','first_frame_to_video') NOT NULL,
	`resolution` varchar(16) NOT NULL,
	`duration_seconds` int NOT NULL,
	`aspect_ratio` varchar(16) NOT NULL,
	`provider_id` varchar(128) NOT NULL,
	`provider_task_id` varchar(255),
	`submission_claim` varchar(64),
	`submission_claimed_at` timestamp(3),
	`price_version` varchar(128) NOT NULL,
	`status` enum('submitted','running','succeeded','failed') NOT NULL DEFAULT 'submitted',
	`settlement_status` enum('reserved','captured','released') NOT NULL DEFAULT 'reserved',
	`task_hash` varchar(64) NOT NULL,
	`result_asset_id` varchar(64),
	`result_hash` varchar(64),
	`failure_code` varchar(128),
	`last_reconciled_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `video_generation_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_jobs_org_member_idempotency` UNIQUE(`organization_id`,`org_membership_id`,`idempotency_key`),
	CONSTRAINT `video_jobs_org_provider_task` UNIQUE(`organization_id`,`provider_task_id`)
);
--> statement-breakpoint
CREATE TABLE `video_generation_quotes` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`org_membership_id` varchar(64) NOT NULL,
	`mode` enum('text_to_video','first_frame_to_video') NOT NULL,
	`resolution` varchar(16) NOT NULL,
	`duration_seconds` int NOT NULL,
	`aspect_ratio` varchar(16) NOT NULL,
	`directed_prompt` varchar(6000) NOT NULL,
	`input_snapshot` json NOT NULL,
	`amount_microcredits` bigint NOT NULL,
	`price_version` varchar(128) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `video_generation_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rencredit_reservations` MODIFY COLUMN `inference_key_id` varchar(64);--> statement-breakpoint
CREATE INDEX `video_assets_org_member_result_hash` ON `video_generation_assets` (`organization_id`,`org_membership_id`,`result_hash`);--> statement-breakpoint
CREATE INDEX `video_assets_org_member_kind` ON `video_generation_assets` (`organization_id`,`org_membership_id`,`kind`);--> statement-breakpoint
CREATE INDEX `video_jobs_org_member_created` ON `video_generation_jobs` (`organization_id`,`org_membership_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_jobs_org_status` ON `video_generation_jobs` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `video_quotes_org_member_created` ON `video_generation_quotes` (`organization_id`,`org_membership_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `video_quotes_expires` ON `video_generation_quotes` (`expires_at`);