CREATE TABLE IF NOT EXISTS "hop_mcp_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"token_id" uuid,
	"tool" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hop_notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "hop_mcp_usage" ADD CONSTRAINT "hop_mcp_usage_token_id_hop_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."hop_api_tokens"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hop_mcp_usage_user_id_created_at_idx" ON "hop_mcp_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hop_notification_outbox_user_kind_dedupe_idx" ON "hop_notification_outbox" USING btree ("user_id","kind","dedupe_key");
