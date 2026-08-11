CREATE TABLE `budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`period_id` text NOT NULL,
	`template_id` text,
	`category_id` text,
	`original_amount` real NOT NULL,
	`adjusted_amount` real NOT NULL,
	`rollover_amount` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `budget_periods`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `budget_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `budget_allocations_period_idx` ON `budget_allocations` (`period_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_category_unique` ON `budget_allocations` (`period_id`,`category_id`) WHERE "budget_allocations"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_allocations_overall_unique` ON `budget_allocations` (`period_id`) WHERE "budget_allocations"."category_id" IS NULL;--> statement-breakpoint
CREATE TABLE `budget_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recurrence` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`total_limit` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `budget_periods_user_idx` ON `budget_periods` (`user_id`,`period_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_periods_identity_unique` ON `budget_periods` (`user_id`,`recurrence`,`period_start`);--> statement-breakpoint
CREATE TABLE `budget_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`recurrence` text NOT NULL,
	`default_amount` real NOT NULL,
	`rollover_rule` text DEFAULT 'none' NOT NULL,
	`client_generated_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `budget_templates_user_idx` ON `budget_templates` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_templates_client_unique` ON `budget_templates` (`client_generated_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budget_templates_category_scope_unique` ON `budget_templates` (`user_id`,`recurrence`,`category_id`) WHERE "budget_templates"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `budget_templates_overall_scope_unique` ON `budget_templates` (`user_id`,`recurrence`) WHERE "budget_templates"."category_id" IS NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `opening_balance` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `accounts` SET `opening_balance` = round(`current_balance` - COALESCE((SELECT sum(CASE WHEN t.`account_id` = `accounts`.`id` THEN CASE WHEN t.`type` IN ('income', 'adjust_balance') THEN t.`amount` WHEN t.`type` = 'goal_spend' THEN 0 ELSE -t.`amount` END WHEN t.`transfer_to_account_id` = `accounts`.`id` AND t.`type` IN ('transfer', 'savings') THEN t.`amount` ELSE 0 END) FROM `transactions` t WHERE t.`user_id` = `accounts`.`user_id`), 0), 2);--> statement-breakpoint
INSERT INTO `budget_templates` (`id`, `user_id`, `category_id`, `name`, `recurrence`, `default_amount`, `rollover_rule`, `client_generated_id`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `category_id`, `name`, `period`, `limit_amount`, 'none', `client_generated_id`, `created_at`, `updated_at` FROM `spending_budgets`;--> statement-breakpoint
WITH legacy_periods AS (
  SELECT `user_id`, `period`,
    CASE WHEN `period` = 'yearly' THEN strftime('%Y-01-01', 'now') WHEN `period` = 'monthly' THEN strftime('%Y-%m-01', 'now') ELSE date('now', '-' || ((CAST(strftime('%w', 'now') AS integer) + 6) % 7) || ' days') END AS `period_start`
  FROM `spending_budgets` GROUP BY `user_id`, `period`
)
INSERT INTO `budget_periods` (`id`, `user_id`, `recurrence`, `period_start`, `period_end`, `total_limit`, `status`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), `user_id`, `period`, `period_start`, CASE WHEN `period` = 'weekly' THEN date(`period_start`, '+6 days') WHEN `period` = 'monthly' THEN date(`period_start`, '+1 month', '-1 day') ELSE date(`period_start`, '+1 year', '-1 day') END,
  COALESCE(MAX(CASE WHEN `category_id` IS NULL THEN `limit_amount` END), SUM(`limit_amount`)), 'open', datetime('now'), datetime('now')
FROM legacy_periods JOIN `spending_budgets` USING (`user_id`, `period`) GROUP BY `user_id`, `period`, `period_start`;--> statement-breakpoint
INSERT INTO `budget_allocations` (`id`, `period_id`, `template_id`, `category_id`, `original_amount`, `adjusted_amount`, `rollover_amount`, `created_at`, `updated_at`)
SELECT `spending_budgets`.`id`, `budget_periods`.`id`, `spending_budgets`.`id`, `spending_budgets`.`category_id`, `spending_budgets`.`limit_amount`, `spending_budgets`.`limit_amount`, 0, `spending_budgets`.`created_at`, `spending_budgets`.`updated_at`
FROM `spending_budgets` JOIN `budget_periods` ON `budget_periods`.`user_id` = `spending_budgets`.`user_id` AND `budget_periods`.`recurrence` = `spending_budgets`.`period`;
