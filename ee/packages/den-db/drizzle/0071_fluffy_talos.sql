ALTER TABLE `video_generation_jobs` ADD `license_evidence_id` varchar(128);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `ai_provenance_status` enum('pending','preserved') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `ai_provenance_evidence` varchar(128);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `provider_cost_microunits` bigint;--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `provider_cost_currency` varchar(3);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `cost_evidence_reference` varchar(512);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `cost_evidence_recorded_by_org_membership_id` varchar(64);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `cost_evidence_recorded_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `review_status` enum('pending_review','approved','rejected') DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `reviewed_by_org_membership_id` varchar(64);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `reviewed_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `video_generation_jobs` ADD `review_reason` varchar(1000);--> statement-breakpoint
CREATE INDEX `video_jobs_org_review_status` ON `video_generation_jobs` (`organization_id`,`review_status`);