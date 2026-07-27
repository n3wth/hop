-- Baseline for the Better Auth + Neon cutover. Replaces the legacy migration
-- set (docs/legacy-migrations/) whose journal only covered 3 of 10 files.
-- Every statement is IDEMPOTENT so a database partially provisioned from the
-- legacy set can converge on this schema.
--> statement-breakpoint
-- Legacy shape: the pre-cutover hop_subscriptions (user_id/tier) is renamed
-- aside so the Stripe-shaped table below can be created. Data is preserved.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hop_subscriptions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE "hop_subscriptions" RENAME TO "hop_subscriptions_legacy";
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_four" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"duffel_order_id" text,
	"booking_reference" text,
	"offer_snapshot" jsonb,
	"total_amount" text,
	"total_currency" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_conversation_summary" (
	"user_id" text PRIMARY KEY NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hop_conversations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_cron_heartbeats" (
	"job" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_degradation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"route" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"trip" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hop_customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "hop_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hop_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_improvement_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text DEFAULT 'p3' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"linear_issue_id" text,
	"linear_identifier" text,
	"delivered_via" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"filed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "hop_improvement_findings_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_inferred_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"confidence" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_manual_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"code" text,
	"balance" numeric DEFAULT '0' NOT NULL,
	"kind" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_memory_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"cabin" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_outclicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now(),
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"url" text NOT NULL,
	"program" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_standing_order_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standing_order_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"route" text NOT NULL,
	"pick" jsonb NOT NULL,
	"cpp" numeric NOT NULL,
	"fingerprint" text NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_standing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"min_cpp" numeric NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"eligible_programs" text[] DEFAULT '{}' NOT NULL,
	"min_cabin" text,
	"last_notified_offer" text,
	"notify_email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text,
	"from_email" text NOT NULL,
	"to_email" text,
	"subject" text,
	"body" text,
	"status" text DEFAULT 'new' NOT NULL,
	"draft_reply" text,
	"notified_at" timestamp with time zone,
	"reply_text" text,
	"replied_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_travel_history" (
	"user_id" text PRIMARY KEY NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"google_refresh_token" text,
	"google_email" text,
	"trips" jsonb,
	"last_synced_at" timestamp with time zone,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_user_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"aw_user_id" text,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_user_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"home_airport" text,
	"travel_prefs" jsonb,
	"travel_profile" jsonb,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_valuation_overrides" (
	"program_id" text PRIMARY KEY NOT NULL,
	"cpp" numeric NOT NULL,
	"sample_size" integer NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "hop_subscriptions" ADD CONSTRAINT "hop_subscriptions_customer_id_hop_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."hop_customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "hop_standing_order_alerts" ADD CONSTRAINT "hop_standing_order_alerts_standing_order_id_hop_standing_orders_id_fk" FOREIGN KEY ("standing_order_id") REFERENCES "public"."hop_standing_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hop_degradation_events_created_at_idx" ON "hop_degradation_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hop_inferred_facts_user_kind_value_idx" ON "hop_inferred_facts" USING btree ("user_id","kind","value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hop_outclicks_kind_clicked_at_idx" ON "hop_outclicks" USING btree ("kind","clicked_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hop_support_tickets_message_id_idx" ON "hop_support_tickets" USING btree ("message_id");
--> statement-breakpoint
-- Deltas for databases created from the legacy migration set:
ALTER TABLE "hop_standing_orders" ADD COLUMN IF NOT EXISTS "notify_email" text;