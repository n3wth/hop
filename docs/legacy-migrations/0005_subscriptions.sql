-- hop_subscriptions — premium subscription state (monetization Phase 1).
-- IF NOT EXISTS everywhere: the table may already exist in prod from the
-- earlier hand-run SQL noted in lib/subscription.ts ("reported, NOT run" —
-- verify the live schema before running). The ALTERs then add the Stripe
-- columns to either the fresh table or the pre-existing one.
--
-- Written ONLY by the Stripe webhook route (service-role client, scoped in
-- code by user_id = Auth0 sub). RLS is enabled with NO anon policies, matching
-- every other hop_* table: the anon key can touch nothing.
CREATE TABLE IF NOT EXISTS "hop_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "hop_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "hop_subscriptions" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "hop_subscriptions" ADD COLUMN IF NOT EXISTS "last_event_at" timestamp with time zone;
--> statement-breakpoint
-- Fallback attribution (userIdForStripeCustomer) + the auth-migration re-link
-- key — looked up by value, so it gets an index.
CREATE INDEX IF NOT EXISTS "hop_subscriptions_stripe_customer_id_idx"
	ON "hop_subscriptions" ("stripe_customer_id");
--> statement-breakpoint
ALTER TABLE "hop_subscriptions" ENABLE ROW LEVEL SECURITY;
