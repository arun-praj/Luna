ALTER TABLE "notification_settings" ADD COLUMN "recurring_due_time" text DEFAULT '09:00' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "delivery_status" text DEFAULT 'sent' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "delivery_http_status" integer;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "delivery_error" text;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "attempted_device_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "delivered_device_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "notification_push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"device_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"subscription_json" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" text,
	"last_delivery_at" text,
	"last_delivery_status" text,
	"last_delivery_http_status" integer,
	"last_delivery_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_push_subscriptions" ADD CONSTRAINT "notification_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_push_subscriptions_user_device_unique" ON "notification_push_subscriptions" USING btree ("user_id","device_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_push_subscriptions_endpoint_unique" ON "notification_push_subscriptions" USING btree ("endpoint");
--> statement-breakpoint
CREATE INDEX "notification_push_subscriptions_user_active_idx" ON "notification_push_subscriptions" USING btree ("user_id","active");
--> statement-breakpoint
DO $$
DECLARE
	setting record;
	payload jsonb;
	endpoint text;
	now_value text := to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
	FOR setting IN SELECT user_id, push_subscription FROM notification_settings WHERE push_subscription IS NOT NULL LOOP
		BEGIN
			payload := setting.push_subscription::jsonb;
		EXCEPTION WHEN others THEN
			CONTINUE;
		END;
		endpoint := payload->>'endpoint';
		IF endpoint IS NOT NULL AND endpoint <> '' AND jsonb_typeof(payload->'keys') = 'object' THEN
			INSERT INTO notification_push_subscriptions (
				id, user_id, device_id, endpoint, subscription_json, active, last_seen_at, created_at, updated_at
			) VALUES (
				'legacy-' || setting.user_id, setting.user_id, 'legacy-' || setting.user_id,
				endpoint, setting.push_subscription, true, now_value, now_value, now_value
			) ON CONFLICT (endpoint) DO NOTHING;
		END IF;
	END LOOP;
END $$;
