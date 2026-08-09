CREATE TABLE "data_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"source_exported_at" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"bytes" integer,
	"item_count" integer
);
--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_imports_user_idx" ON "data_imports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_imports_requested_at_idx" ON "data_imports" USING btree ("requested_at");
