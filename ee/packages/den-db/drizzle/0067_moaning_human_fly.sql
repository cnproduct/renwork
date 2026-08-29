ALTER TABLE `automation_revision` MODIFY COLUMN `schedule_kind` enum('once','daily','weekly','monthly','interval') NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_revision` ADD `workspace_id` varchar(160);--> statement-breakpoint
ALTER TABLE `automation_revision` ADD `connectors` json;--> statement-breakpoint
UPDATE `automation_revision` SET `connectors` = JSON_ARRAY() WHERE `connectors` IS NULL;--> statement-breakpoint
ALTER TABLE `automation_revision` MODIFY COLUMN `connectors` json NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_revision` ADD `effective_start_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `automation_revision` ADD `effective_end_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `automation_revision` ADD `notify_mini_program` boolean DEFAULT false NOT NULL;
