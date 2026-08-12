CREATE TABLE `budget_income_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`interval` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `budget_income_sources_user_idx` ON `budget_income_sources` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_income_sources_user_category_unique` ON `budget_income_sources` (`user_id`,`category_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `budget_onboarding_completed` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `budget_onboarding_completed` = 1 WHERE `id` IN (SELECT DISTINCT `user_id` FROM `budget_templates`);
