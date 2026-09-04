CREATE TABLE `renwork_offline_orders` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`plan_id` varchar(160) NOT NULL,
	`offer_id` varchar(160) NOT NULL,
	`catalog_version` varchar(255) NOT NULL,
	`status` enum('active','reversed') NOT NULL DEFAULT 'active',
	`currency` varchar(3) NOT NULL,
	`amount_minor` int NOT NULL,
	`granted_microcredits` bigint NOT NULL,
	`payment_method` enum('bank_transfer','wechat_offline','alipay_offline','cash','other') NOT NULL,
	`payment_reference` varchar(255) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`current_period_start` timestamp(3) NOT NULL,
	`current_period_end` timestamp(3) NOT NULL,
	`seat_limit` int NOT NULL,
	`catalog_snapshot` json NOT NULL,
	`model_policy_snapshot` json NOT NULL,
	`previous_entitlement_snapshot` json NOT NULL,
	`note` varchar(1000),
	`reversed_at` timestamp(3),
	`reversed_by_user_id` varchar(64),
	`reversal_reason` varchar(1000),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `renwork_offline_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `renwork_offline_orders_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `renwork_offline_orders_payment_reference` UNIQUE(`payment_method`,`payment_reference`)
);
--> statement-breakpoint
CREATE INDEX `renwork_offline_orders_org_created` ON `renwork_offline_orders` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `renwork_offline_orders_status_period_end` ON `renwork_offline_orders` (`status`,`current_period_end`);