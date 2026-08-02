CREATE TABLE "account_deletion_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email_snapshot" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"requested_at" text NOT NULL,
	"scheduled_for" text,
	"executed_at" text
);
--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email_snapshot" text NOT NULL,
	"format" text DEFAULT 'json' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" text NOT NULL,
	"completed_at" text,
	"bytes" integer
);
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_deletion_requests_user_idx" ON "account_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletion_requests_due_idx" ON "account_deletion_requests" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "data_exports_user_idx" ON "data_exports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_exports_requested_at_idx" ON "data_exports" USING btree ("requested_at");