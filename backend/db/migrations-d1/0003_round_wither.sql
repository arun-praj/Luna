CREATE TABLE `report_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_type` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`transaction_fingerprint` text NOT NULL,
	`report_json` text NOT NULL,
	`generated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_cache_unique` ON `report_cache` (`user_id`,`period_type`,`period_start`);--> statement-breakpoint
CREATE INDEX `report_cache_user_idx` ON `report_cache` (`user_id`,`generated_at`);--> statement-breakpoint
CREATE TABLE `report_generation_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_generation_limits_unique` ON `report_generation_limits` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `report_generation_limits_user_idx` ON `report_generation_limits` (`user_id`,`day`);