CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`reference_id` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_unique` ON `notification_deliveries` (`user_id`,`kind`,`reference_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_user_idx` ON `notification_deliveries` (`user_id`,`sent_at`);--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `timezone` text DEFAULT 'UTC' NOT NULL;