-- hop_outclicks — first-party affiliate outclick ledger (monetization Phase
-- 1.5). One row per /api/go/* redirect; kind 'card' is the credit-card CTA.
-- This is the conversion baseline we need BEFORE the CJ/Impact network links
-- land: today's applyUrls are placeholder public landing pages, so this table
-- is hop's only first-party record of click volume to negotiate and verify
-- network reporting against.
--
-- AUTHORED, NEVER EXECUTED BY APP CODE — the owner/CI applies it. Until it is
-- applied, lib/outclicks.ts degrades to a silent no-op via withDb.
--
-- Anonymous by design: NO user_id column (click telemetry, not user data).
-- Written fire-and-forget by lib/outclicks.ts (service-role); counted by
-- lib/business-digest.ts. RLS is enabled with NO anon policies, matching every
-- other hop_* table: the anon key can touch nothing.
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
-- The weekly business digest counts kind='card' rows inside a time window.
CREATE INDEX IF NOT EXISTS "hop_outclicks_kind_clicked_at_idx"
	ON "hop_outclicks" ("kind", "clicked_at");
--> statement-breakpoint
ALTER TABLE "hop_outclicks" ENABLE ROW LEVEL SECURITY;
