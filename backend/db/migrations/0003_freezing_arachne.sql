CREATE TABLE `notification_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`goal_milestones_enabled` integer DEFAULT true NOT NULL,
	`recurring_due_enabled` integer DEFAULT true NOT NULL,
	`low_balance_enabled` integer DEFAULT false NOT NULL,
	`low_balance_threshold` integer,
	`push_subscription` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
