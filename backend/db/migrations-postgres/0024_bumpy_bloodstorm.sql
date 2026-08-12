CREATE TABLE "budget_category_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"bucket" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_moves" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period_id" text NOT NULL,
	"from_allocation_id" text NOT NULL,
	"to_allocation_id" text NOT NULL,
	"amount" real NOT NULL,
	"reversal_of_id" text,
	"reversed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "budget_allocations_category_unique";--> statement-breakpoint
DROP INDEX "budget_allocations_overall_unique";--> statement-breakpoint
DROP INDEX "budget_templates_category_scope_unique";--> statement-breakpoint
DROP INDEX "budget_templates_overall_scope_unique";--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD COLUMN "kind" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_templates" ADD COLUMN "kind" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_category_buckets" ADD CONSTRAINT "budget_category_buckets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_category_buckets" ADD CONSTRAINT "budget_category_buckets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_period_id_budget_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."budget_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_from_allocation_id_budget_allocations_id_fk" FOREIGN KEY ("from_allocation_id") REFERENCES "public"."budget_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_moves" ADD CONSTRAINT "budget_moves_to_allocation_id_budget_allocations_id_fk" FOREIGN KEY ("to_allocation_id") REFERENCES "public"."budget_allocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_category_buckets_user_category_unique" ON "budget_category_buckets" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "budget_category_buckets_user_idx" ON "budget_category_buckets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_moves_user_period_idx" ON "budget_moves" USING btree ("user_id","period_id","created_at");--> statement-breakpoint
CREATE INDEX "budget_moves_reversal_idx" ON "budget_moves" USING btree ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_allocations_category_unique" ON "budget_allocations" USING btree ("period_id","kind","category_id") WHERE "budget_allocations"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_allocations_overall_unique" ON "budget_allocations" USING btree ("period_id","kind") WHERE "budget_allocations"."category_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_templates_category_scope_unique" ON "budget_templates" USING btree ("user_id","recurrence","kind","category_id") WHERE "budget_templates"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_templates_overall_scope_unique" ON "budget_templates" USING btree ("user_id","recurrence","kind") WHERE "budget_templates"."category_id" IS NULL;