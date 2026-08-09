ALTER TABLE `recurring_templates` ADD `end_date` text;
--> statement-breakpoint
ALTER TABLE `recurring_templates` ADD `approval_required` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `recurring_templates` ADD `transfer_to_account_id` text REFERENCES `accounts`(`id`);
--> statement-breakpoint
ALTER TABLE `recurring_templates` ADD `savings_instrument_id` text REFERENCES `savings_instruments`(`id`);
--> statement-breakpoint
CREATE TABLE `recurring_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recurring_template_id` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`transaction_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_template_id`) REFERENCES `recurring_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_occurrences_template_date_unique` ON `recurring_occurrences` (`recurring_template_id`,`scheduled_date`);
--> statement-breakpoint
CREATE INDEX `recurring_occurrences_user_status_idx` ON `recurring_occurrences` (`user_id`,`status`,`scheduled_date`);
