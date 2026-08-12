CREATE TABLE "budget_income_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"amount" real NOT NULL,
	"interval" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "budget_onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_income_sources" ADD CONSTRAINT "budget_income_sources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_income_sources" ADD CONSTRAINT "budget_income_sources_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_income_sources_user_idx" ON "budget_income_sources" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_income_sources_user_category_unique" ON "budget_income_sources" USING btree ("user_id","category_id");
--> statement-breakpoint
UPDATE "users" SET "budget_onboarding_completed" = true WHERE "id" IN (SELECT DISTINCT "user_id" FROM "budget_templates");
