CREATE TABLE `report_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`report_type` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`sent_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_deliveries_unique` ON `report_deliveries` (`user_id`,`report_type`,`period_start`);--> statement-breakpoint
CREATE INDEX `report_deliveries_user_idx` ON `report_deliveries` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `monthly_report_enabled` integer DEFAULT false NOT NULL;