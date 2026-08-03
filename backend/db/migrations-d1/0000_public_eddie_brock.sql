CREATE TABLE `account_deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email_snapshot` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`requested_at` text NOT NULL,
	`scheduled_for` text,
	`executed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `account_deletion_requests_user_idx` ON `account_deletion_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_deletion_requests_due_idx` ON `account_deletion_requests` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'NPR' NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`background_color` text,
	`icon` text,
	`include_in_total_balance` integer DEFAULT true NOT NULL,
	`allow_negative_balance` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text,
	`color` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `data_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email_snapshot` text NOT NULL,
	`format` text DEFAULT 'json' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text,
	`bytes` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `data_exports_user_idx` ON `data_exports` (`user_id`);--> statement-breakpoint
CREATE INDEX `data_exports_requested_at_idx` ON `data_exports` (`requested_at`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`allocated_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`target_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`goal_milestones_enabled` integer DEFAULT true NOT NULL,
	`recurring_due_enabled` integer DEFAULT true NOT NULL,
	`recurring_transaction_enabled` integer DEFAULT false NOT NULL,
	`recurring_transaction_time` text DEFAULT '09:00' NOT NULL,
	`recurring_transaction_frequency` text DEFAULT 'monthly' NOT NULL,
	`low_balance_enabled` integer DEFAULT false NOT NULL,
	`low_balance_threshold` integer,
	`push_subscription` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`channel` text NOT NULL,
	`purpose` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `otp_codes_user_purpose_idx` ON `otp_codes` (`user_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `otp_codes_expires_at_idx` ON `otp_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_hash_unique` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_expires_at_idx` ON `password_reset_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `recurring_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category_id` text,
	`notes` text,
	`frequency` text NOT NULL,
	`next_due_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_templates_user_idx` ON `recurring_templates` (`user_id`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`device_label` text,
	`parent_token_id` text,
	`issued_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`revoked_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_hash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_parent_idx` ON `refresh_tokens` (`parent_token_id`);--> statement-breakpoint
CREATE TABLE `savings_instrument_types` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `savings_instrument_types_user_idx` ON `savings_instrument_types` (`user_id`);--> statement-breakpoint
CREATE TABLE `savings_instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`interest_rate` real,
	`icon` text DEFAULT 'Growth' NOT NULL,
	`background_color` text DEFAULT '#e5f3eb' NOT NULL,
	`maturity_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `savings_instrument_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `savings_instruments_user_idx` ON `savings_instruments` (`user_id`);--> statement-breakpoint
CREATE TABLE `spending_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`limit_amount` real NOT NULL,
	`period` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `spending_budgets_user_idx` ON `spending_budgets` (`user_id`);--> statement-breakpoint
CREATE TABLE `transaction_history` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`changed_by` text,
	`change_type` text NOT NULL,
	`old_values` text,
	`new_values` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transaction_history_transaction_idx` ON `transaction_history` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category_id` text,
	`title` text DEFAULT '' NOT NULL,
	`notes` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_template_id` text,
	`receipt_image_url` text,
	`goal_id` text,
	`savings_instrument_id` text,
	`transfer_to_account_id` text,
	`date` text NOT NULL,
	`transaction_at` text DEFAULT '' NOT NULL,
	`sync_status` text DEFAULT 'synced' NOT NULL,
	`client_generated_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_template_id`) REFERENCES `recurring_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`savings_instrument_id`) REFERENCES `savings_instruments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_client_generated_id_unique` ON `transactions` (`client_generated_id`);--> statement-breakpoint
CREATE TABLE `user_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_tags_user_idx` ON `user_tags` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tags_user_name_unique` ON `user_tags` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`currency` text DEFAULT 'NPR' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`tutorial_started_at` text,
	`tutorial_completed_at` text,
	`otp_enabled` integer DEFAULT false NOT NULL,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`two_factor_secret_encrypted` text,
	`two_factor_setup_secret_encrypted` text,
	`two_factor_backup_codes` text,
	`two_factor_verified_at` text,
	`email_verified_at` text,
	`phone_verified_at` text,
	`pwa_install_dismissed_at` text,
	`last_login_at` text,
	`avatar_preset` text DEFAULT 'sunrise' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`);--> statement-breakpoint
CREATE TABLE `webauthn_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`device_label` text,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webauthn_credential_id_unique` ON `webauthn_credentials` (`credential_id`);--> statement-breakpoint
CREATE INDEX `webauthn_credentials_user_idx` ON `webauthn_credentials` (`user_id`);