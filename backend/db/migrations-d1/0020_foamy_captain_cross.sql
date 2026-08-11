PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_spending_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`limit_amount` real NOT NULL,
	`period` text NOT NULL,
	`client_generated_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_spending_budgets`("id", "user_id", "category_id", "name", "limit_amount", "period", "client_generated_id", "created_at", "updated_at") SELECT "id", "user_id", "category_id", "name", "limit_amount", "period", "client_generated_id", "created_at", "updated_at" FROM `spending_budgets`;--> statement-breakpoint
DROP TABLE `spending_budgets`;--> statement-breakpoint
ALTER TABLE `__new_spending_budgets` RENAME TO `spending_budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `spending_budgets_user_idx` ON `spending_budgets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_client_unique` ON `spending_budgets` (`client_generated_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_overall_period_unique` ON `spending_budgets` (`user_id`,`period`) WHERE "spending_budgets"."category_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `spending_budgets_category_period_unique` ON `spending_budgets` (`user_id`,`period`,`category_id`) WHERE "spending_budgets"."category_id" IS NOT NULL;