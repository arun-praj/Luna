ALTER TABLE `notification_settings` ADD `recurring_transaction_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `recurring_transaction_time` text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_settings` ADD `recurring_transaction_frequency` text DEFAULT 'monthly' NOT NULL;