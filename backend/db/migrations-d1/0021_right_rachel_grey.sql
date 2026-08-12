CREATE TABLE `budget_category_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`bucket` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_category_buckets_user_category_unique` ON `budget_category_buckets` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `budget_category_buckets_user_idx` ON `budget_category_buckets` (`user_id`);--> statement-breakpoint
CREATE TABLE `budget_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_id` text NOT NULL,
	`from_allocation_id` text NOT NULL,
	`to_allocation_id` text NOT NULL,
	`amount` real NOT NULL,
	`reversal_of_id` text,
	`reversed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`period_id`) REFERENCES `budget_periods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_allocation_id`) REFERENCES `budget_allocations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`to_allocation_id`) REFERENCES `budget_allocations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `budget_moves_user_period_idx` ON `budget_moves` (`user_id`,`period_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `budget_moves_reversal_idx` ON `budget_moves` (`reversal_of_id`);--> statement-breakpoint
DROP INDEX `budget_allocations_category_unique`;--> statement-breakpoint
DROP INDEX `budget_allocations_overall_unique`;--> statement-breakpoint
ALTER TABLE `budget_allocations` ADD `kind` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_category_unique` ON `budget_allocations` (`period_id`,`kind`,`category_id`) WHERE "budget_allocations"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_overall_unique` ON `budget_allocations` (`period_id`,`kind`) WHERE "budget_allocations"."category_id" IS NULL;--> statement-breakpoint
DROP INDEX `budget_templates_category_scope_unique`;--> statement-breakpoint
DROP INDEX `budget_templates_overall_scope_unique`;--> statement-breakpoint
ALTER TABLE `budget_templates` ADD `kind` text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_templates_category_scope_unique` ON `budget_templates` (`user_id`,`recurrence`,`kind`,`category_id`) WHERE "budget_templates"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_templates_overall_scope_unique` ON `budget_templates` (`user_id`,`recurrence`,`kind`) WHERE "budget_templates"."category_id" IS NULL;