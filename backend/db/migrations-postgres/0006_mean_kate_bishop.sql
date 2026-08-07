CREATE TABLE "report_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"report_type" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"sent_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "monthly_report_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_deliveries_unique" ON "report_deliveries" USING btree ("user_id","report_type","period_start");--> statement-breakpoint
CREATE INDEX "report_deliveries_user_idx" ON "report_deliveries" USING btree ("user_id","created_at");