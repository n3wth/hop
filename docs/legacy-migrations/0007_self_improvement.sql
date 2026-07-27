-- Self-improvement loop tables (ADR 0007). ALL THREE ARE SYSTEM-SCOPED: no
-- user_id column exists on any of them, by design — no user row, balance, or
-- free text can ever land here. hop_degradation_events.route only ever holds
-- a validated 'AAA-BBB' IATA pair (lib/degradation-telemetry.ts rejects
-- anything else to null), so the write side closes the future prompt surface.
--
-- IF NOT EXISTS everywhere (house migration style). RLS is enabled with NO
-- anon policies, matching every other hop_* table: the anon key can touch
-- nothing; only the service-role client reads/writes. App code NEVER runs
-- this file — apply it manually (class (c) in ADR 0007's taxonomy).

-- One liveness row per vercel.json cron job, upserted fire-and-forget by
-- lib/cron-heartbeat.ts at the end of each authorized run. ok=false with
-- note='disabled' means "owner switched it off" — the D1 detector only looks
-- at last_run_at age.
CREATE TABLE IF NOT EXISTS "hop_cron_heartbeats" (
	"job" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean DEFAULT true NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "hop_cron_heartbeats" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Append-only degradation telemetry: one row per degraded source per live
-- search (lib/degradation-telemetry.ts). Pruned to 30 days by the sentinel.
CREATE TABLE IF NOT EXISTS "hop_degradation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"route" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
-- The sentinel reads an 8-day window and prunes >30d — both hit created_at.
CREATE INDEX IF NOT EXISTS "hop_degradation_events_created_at_idx"
	ON "hop_degradation_events" ("created_at");
--> statement-breakpoint
ALTER TABLE "hop_degradation_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Idempotent, fingerprinted findings (lib/improvement-findings.ts): the
-- durable queue between detection and delivery. fingerprint is UNIQUE — a
-- re-detection updates the row (or reopens it within the 7-day flap window);
-- filed_at makes filing at-most-once per episode.
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
ALTER TABLE "hop_improvement_findings" ENABLE ROW LEVEL SECURITY;
