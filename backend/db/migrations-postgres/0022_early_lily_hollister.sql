CREATE TABLE "budget_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"template_id" text,
	"category_id" text,
	"original_amount" real NOT NULL,
	"adjusted_amount" real NOT NULL,
	"rollover_amount" real DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recurrence" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"total_limit" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"recurrence" text NOT NULL,
	"default_amount" real NOT NULL,
	"rollover_rule" text DEFAULT 'none' NOT NULL,
	"client_generated_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "opening_balance" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_period_id_budget_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."budget_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_template_id_budget_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."budget_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_templates" ADD CONSTRAINT "budget_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_allocations_period_idx" ON "budget_allocations" USING btree ("period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_allocations_category_unique" ON "budget_allocations" USING btree ("period_id","category_id") WHERE "budget_allocations"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_allocations_overall_unique" ON "budget_allocations" USING btree ("period_id") WHERE "budget_allocations"."category_id" IS NULL;--> statement-breakpoint
CREATE INDEX "budget_periods_user_idx" ON "budget_periods" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_periods_identity_unique" ON "budget_periods" USING btree ("user_id","recurrence","period_start");--> statement-breakpoint
CREATE INDEX "budget_templates_user_idx" ON "budget_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_templates_client_unique" ON "budget_templates" USING btree ("client_generated_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_templates_category_scope_unique" ON "budget_templates" USING btree ("user_id","recurrence","category_id") WHERE "budget_templates"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_templates_overall_scope_unique" ON "budget_templates" USING btree ("user_id","recurrence") WHERE "budget_templates"."category_id" IS NULL;--> statement-breakpoint
UPDATE "accounts" a SET "opening_balance" = round(("current_balance" - COALESCE((SELECT sum(CASE WHEN t."account_id" = a."id" THEN CASE WHEN t."type" IN ('income', 'adjust_balance') THEN t."amount" WHEN t."type" = 'goal_spend' THEN 0 ELSE -t."amount" END WHEN t."transfer_to_account_id" = a."id" AND t."type" IN ('transfer', 'savings') THEN t."amount" ELSE 0 END) FROM "transactions" t WHERE t."user_id" = a."user_id"), 0))::numeric, 2)::real;--> statement-breakpoint
INSERT INTO "budget_templates" ("id", "user_id", "category_id", "name", "recurrence", "default_amount", "rollover_rule", "client_generated_id", "created_at", "updated_at") SELECT "id", "user_id", "category_id", "name", "period", "limit_amount", 'none', "client_generated_id", "created_at", "updated_at" FROM "spending_budgets";--> statement-breakpoint
WITH legacy_periods AS (
  SELECT "user_id", "period", CASE WHEN "period" = 'yearly' THEN to_char(current_date, 'YYYY-01-01') WHEN "period" = 'monthly' THEN to_char(current_date, 'YYYY-MM-01') ELSE (current_date - ((extract(isodow FROM current_date)::integer - 1) * interval '1 day'))::date::text END AS "period_start"
  FROM "spending_budgets" GROUP BY "user_id", "period"
)
INSERT INTO "budget_periods" ("id", "user_id", "recurrence", "period_start", "period_end", "total_limit", "status", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text), lp."user_id", lp."period", lp."period_start", CASE WHEN lp."period" = 'weekly' THEN (lp."period_start"::date + interval '6 days')::date::text WHEN lp."period" = 'monthly' THEN (lp."period_start"::date + interval '1 month - 1 day')::date::text ELSE (lp."period_start"::date + interval '1 year - 1 day')::date::text END, COALESCE(MAX(CASE WHEN sb."category_id" IS NULL THEN sb."limit_amount" END), SUM(sb."limit_amount")), 'open', now()::text, now()::text
FROM legacy_periods lp JOIN "spending_budgets" sb USING ("user_id", "period") GROUP BY lp."user_id", lp."period", lp."period_start";--> statement-breakpoint
INSERT INTO "budget_allocations" ("id", "period_id", "template_id", "category_id", "original_amount", "adjusted_amount", "rollover_amount", "created_at", "updated_at") SELECT sb."id", bp."id", sb."id", sb."category_id", sb."limit_amount", sb."limit_amount", 0, sb."created_at", sb."updated_at" FROM "spending_budgets" sb JOIN "budget_periods" bp ON bp."user_id" = sb."user_id" AND bp."recurrence" = sb."period";
