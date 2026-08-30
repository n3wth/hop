ALTER TABLE "hop_user_accounts" ADD COLUMN "cached_balances" jsonb;--> statement-breakpoint
ALTER TABLE "hop_user_accounts" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hop_user_accounts" ADD COLUMN "last_sync_ok" boolean;