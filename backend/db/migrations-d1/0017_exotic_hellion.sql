CREATE TABLE `home_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`occurrence_key` text NOT NULL,
	`show_at` text NOT NULL,
	`expires_at` text,
	`shown_at` text,
	`dismissed_at` text,
	`resolved_at` text,
	`payload` text NOT NULL,
	`hard_urgency` integer DEFAULT 0 NOT NULL,
	`deterministic_rank` integer DEFAULT 0 NOT NULL,
	`ai_status` text DEFAULT 'pending' NOT NULL,
	`ai_rank` integer,
	`ai_suppressed` integer DEFAULT false NOT NULL,
	`ai_title` text,
	`ai_detail` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `home_alerts_identity_unique` ON `home_alerts` (`user_id`,`kind`,`source_id`,`occurrence_key`);--> statement-breakpoint
CREATE INDEX `home_alerts_user_visibility_idx` ON `home_alerts` (`user_id`,`show_at`,`dismissed_at`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `home_alerts_ai_pending_idx` ON `home_alerts` (`ai_status`,`created_at`);