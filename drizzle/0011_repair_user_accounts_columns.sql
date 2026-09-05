-- Repair: restore hop_user_accounts columns from 0006 that are missing in prod
-- (Neon branch restore reverted the DDL while __drizzle_migrations still lists
-- 0006 as applied, so the journal-based runner skips it). Idempotent by design.
ALTER TABLE "hop_user_accounts" ADD COLUMN IF NOT EXISTS "cached_balances" jsonb;--> statement-breakpoint
ALTER TABLE "hop_user_accounts" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hop_user_accounts" ADD COLUMN IF NOT EXISTS "last_sync_ok" boolean;
