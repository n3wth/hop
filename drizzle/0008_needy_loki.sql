CREATE TABLE "hop_newsletter_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hop_newsletter_signups_email_idx" ON "hop_newsletter_signups" USING btree ("email");