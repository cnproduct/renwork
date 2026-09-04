CREATE TABLE `renwork_contract_quotes` (
	`id` varchar(64) NOT NULL,
	`organization_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`approved_by_user_id` varchar(64),
	`published_by_user_id` varchar(64),
	`status` enum('draft','approved','published','revoked') NOT NULL DEFAULT 'draft',
	`currency` varchar(3) NOT NULL DEFAULT 'CNY',
	`amount_minor` int NOT NULL,
	`included_rencredits` int NOT NULL,
	`seat_limit` int NOT NULL,
	`billing_interval` enum('monthly','annual') NOT NULL,
	`contract_reference` varchar(255) NOT NULL,
	`note` varchar(1000),
	`approved_at` timestamp(3),
	`published_at` timestamp(3),
	`revoked_at` timestamp(3),
	`revoke_reason` varchar(1000),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `renwork_contract_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `renwork_contract_quotes_org_reference` UNIQUE(`organization_id`,`contract_reference`)
);
--> statement-breakpoint
CREATE INDEX `renwork_contract_quotes_org_status` ON `renwork_contract_quotes` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `renwork_contract_quotes_created` ON `renwork_contract_quotes` (`created_at`);