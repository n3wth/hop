CREATE TABLE "hop_newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"confirm_token" text,
	"unsubscribe_token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"last_digest_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hop_newsletter_subscribers_email_idx" ON "hop_newsletter_subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "hop_newsletter_subscribers_confirm_token_idx" ON "hop_newsletter_subscribers" USING btree ("confirm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "hop_newsletter_subscribers_unsubscribe_token_idx" ON "hop_newsletter_subscribers" USING btree ("unsubscribe_token");