CREATE TABLE `data_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`source_exported_at` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`bytes` integer,
	`item_count` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `data_imports_user_idx` ON `data_imports` (`user_id`);--> statement-breakpoint
CREATE INDEX `data_imports_requested_at_idx` ON `data_imports` (`requested_at`);
