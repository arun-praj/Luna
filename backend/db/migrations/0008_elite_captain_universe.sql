CREATE TABLE `user_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_tags_user_idx` ON `user_tags` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_tags_user_name_unique` ON `user_tags` (`user_id`,`name`);