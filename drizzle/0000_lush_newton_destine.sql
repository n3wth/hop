CREATE TABLE "hop_api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_four" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hop_bookings" (
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
CREATE TABLE "hop_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hop_conversations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "hop_manual_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"code" text,
	"balance" numeric DEFAULT '0' NOT NULL,
	"kind" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hop_standing_order_alerts" (
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
CREATE TABLE "hop_standing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"params" jsonb NOT NULL,
	"min_cpp" numeric NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"eligible_programs" text[] DEFAULT '{}' NOT NULL,
	"min_cabin" text,
	"last_notified_offer" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hop_travel_history" (
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
CREATE TABLE "hop_user_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"aw_user_id" text,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hop_user_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"home_airport" text,
	"travel_prefs" jsonb,
	"travel_profile" jsonb,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hop_standing_order_alerts" ADD CONSTRAINT "hop_standing_order_alerts_standing_order_id_hop_standing_orders_id_fk" FOREIGN KEY ("standing_order_id") REFERENCES "public"."hop_standing_orders"("id") ON DELETE cascade ON UPDATE no action;