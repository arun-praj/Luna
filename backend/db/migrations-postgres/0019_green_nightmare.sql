ALTER TABLE "goals" ADD COLUMN "monthly_contribution" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD COLUMN "goal_id" text;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;