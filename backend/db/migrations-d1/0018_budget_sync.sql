ALTER TABLE `spending_budgets` ADD `client_generated_id` text;--> statement-breakpoint
ALTER TABLE `spending_budgets` ADD `created_at` text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';--> statement-breakpoint
ALTER TABLE `spending_budgets` ADD `updated_at` text NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_client_unique` ON `spending_budgets` (`client_generated_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_overall_period_unique` ON `spending_budgets` (`user_id`, `period`) WHERE `category_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_category_period_unique` ON `spending_budgets` (`user_id`, `period`, `category_id`) WHERE `category_id` IS NOT NULL;--> statement-breakpoint
