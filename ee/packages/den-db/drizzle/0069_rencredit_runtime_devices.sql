CREATE TABLE `rencredit_runtime_devices` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`org_membership_id` varchar(64) NOT NULL,
	`inference_key_id` varchar(64) NOT NULL,
	`device_id` varchar(255) NOT NULL,
	`public_key_pem` varchar(1024) NOT NULL,
	`public_key_fingerprint` varchar(64) NOT NULL,
	`status` enum('pending','active','revoked') NOT NULL DEFAULT 'pending',
	`revoked_at` timestamp(3),
	`last_seen_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `rencredit_runtime_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `rencredit_runtime_devices_org_member_device` UNIQUE(`organization_id`,`org_membership_id`,`device_id`)
);
--> statement-breakpoint
CREATE INDEX `rencredit_runtime_devices_inference_key` ON `rencredit_runtime_devices` (`inference_key_id`);--> statement-breakpoint
CREATE INDEX `rencredit_runtime_devices_status` ON `rencredit_runtime_devices` (`status`);--> statement-breakpoint
ALTER TABLE `rencredit_usage_events` MODIFY COLUMN `accuracy` enum('reported','estimated','tokenizer') NOT NULL;
