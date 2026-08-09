ALTER TABLE "recurring_templates" ADD COLUMN "title" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD COLUMN "end_date" text;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD COLUMN "approval_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD COLUMN "transfer_to_account_id" text;
--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD COLUMN "savings_instrument_id" text;
--> statement-breakpoint
CREATE TABLE "recurring_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recurring_template_id" text NOT NULL,
	"scheduled_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"transaction_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "recurring_occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "recurring_occurrences_recurring_template_id_recurring_templates_id_fk" FOREIGN KEY ("recurring_template_id") REFERENCES "public"."recurring_templates"("id") ON DELETE cascade,
	CONSTRAINT "recurring_occurrences_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_occurrences_template_date_unique" ON "recurring_occurrences" USING btree ("recurring_template_id","scheduled_date");
--> statement-breakpoint
CREATE INDEX "recurring_occurrences_user_status_idx" ON "recurring_occurrences" USING btree ("user_id","status","scheduled_date");
