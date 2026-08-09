ALTER TABLE `goals` ADD `monthly_contribution` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_templates` ADD `goal_id` text REFERENCES goals(id);