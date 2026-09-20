CREATE TABLE `renwork_alipay_orders` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`offer_id` varchar(160) NOT NULL,
	`catalog_version` varchar(255) NOT NULL,
	`catalog_snapshot` json NOT NULL,
	`amount_minor` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'CNY',
	`status` enum('pending','paid','refunded') NOT NULL DEFAULT 'pending',
	`idempotency_key` varchar(160) NOT NULL,
	`provider_trade_no` varchar(128),
	`paid_at` timestamp(3),
	`period_end` timestamp(3),
	`previous_entitlement_snapshot` json,
	`refunded_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `renwork_alipay_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `renwork_alipay_orders_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `renwork_alipay_orders_trade_no` UNIQUE(`provider_trade_no`)
);
--> statement-breakpoint
CREATE INDEX `renwork_alipay_orders_org_created` ON `renwork_alipay_orders` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `renwork_alipay_orders_status` ON `renwork_alipay_orders` (`status`);