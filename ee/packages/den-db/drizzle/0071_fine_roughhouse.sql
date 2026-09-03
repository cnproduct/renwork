CREATE TABLE `commerce_orders` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`created_by_member_id` varchar(64) NOT NULL,
	`plan_id` varchar(160) NOT NULL,
	`offer_id` varchar(160) NOT NULL,
	`catalog_version` varchar(160) NOT NULL,
	`channel` enum('wechat_pay','alipay') NOT NULL,
	`status` enum('pending','paid','fulfilled','closed','failed','refunded') NOT NULL DEFAULT 'pending',
	`currency` varchar(3) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`included_rencredits` bigint NOT NULL,
	`provider_order_id` varchar(255) NOT NULL,
	`provider_transaction_id` varchar(255),
	`checkout_url` varchar(2048),
	`qr_code_url` varchar(2048),
	`idempotency_key` varchar(255) NOT NULL,
	`catalog_snapshot` json NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`paid_at` timestamp(3),
	`fulfilled_at` timestamp(3),
	`closed_at` timestamp(3),
	`last_error_code` varchar(128),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `commerce_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_orders_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `commerce_orders_channel_provider_order` UNIQUE(`channel`,`provider_order_id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_payment_events` (
	`id` varchar(64) NOT NULL,
	`order_id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`channel` enum('wechat_pay','alipay') NOT NULL,
	`provider_event_id` varchar(255) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`verified` enum('yes','no') NOT NULL,
	`processed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `commerce_payment_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_payment_events_provider_event` UNIQUE(`channel`,`provider_event_id`)
);
--> statement-breakpoint
CREATE TABLE `commerce_refunds` (
	`id` varchar(64) NOT NULL,
	`order_id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`amount_minor` bigint NOT NULL,
	`provider_refund_id` varchar(255) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`status` enum('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
	`reason` varchar(255) NOT NULL,
	`completed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `commerce_refunds_id` PRIMARY KEY(`id`),
	CONSTRAINT `commerce_refunds_org_idempotency` UNIQUE(`organization_id`,`idempotency_key`),
	CONSTRAINT `commerce_refunds_provider_refund` UNIQUE(`provider_refund_id`)
);
--> statement-breakpoint
CREATE TABLE `renwork_plan_subscriptions` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`source_order_id` varchar(64) NOT NULL,
	`plan_id` varchar(160) NOT NULL,
	`offer_id` varchar(160) NOT NULL,
	`catalog_version` varchar(160) NOT NULL,
	`billing_interval` enum('monthly','annual') NOT NULL,
	`status` enum('active','expired','refunded') NOT NULL DEFAULT 'active',
	`current_period_start` timestamp(3) NOT NULL,
	`current_period_end` timestamp(3) NOT NULL,
	`next_credit_grant_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `renwork_plan_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `renwork_plan_subscriptions_source_order` UNIQUE(`source_order_id`)
);
--> statement-breakpoint
CREATE INDEX `commerce_orders_org_created` ON `commerce_orders` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `commerce_orders_status_expires` ON `commerce_orders` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `commerce_payment_events_order` ON `commerce_payment_events` (`order_id`);--> statement-breakpoint
CREATE INDEX `commerce_payment_events_org` ON `commerce_payment_events` (`organization_id`);--> statement-breakpoint
CREATE INDEX `commerce_refunds_order` ON `commerce_refunds` (`order_id`);--> statement-breakpoint
CREATE INDEX `renwork_plan_subscriptions_org_status` ON `renwork_plan_subscriptions` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `renwork_plan_subscriptions_next_grant` ON `renwork_plan_subscriptions` (`status`,`next_credit_grant_at`);