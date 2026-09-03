ALTER TABLE `video_generation_jobs` ADD `provider_cost_kind` enum('money','provider_credits');--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `provider_cost_units` bigint;--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `provider_cost_unit_code` varchar(64);--> statement-breakpoint
UPDATE `video_generation_jobs`
SET `provider_cost_kind` = 'money'
WHERE `provider_cost_microunits` IS NOT NULL
  AND `provider_cost_currency` IS NOT NULL;
