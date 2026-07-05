CREATE TABLE "hop_sweet_spot_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" serial NOT NULL,
	"route" text NOT NULL,
	"program" text NOT NULL,
	"program_slug" text NOT NULL,
	"metal" text,
	"cabin" text NOT NULL,
	"miles_ow" integer,
	"miles_label" text NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"confidence" text DEFAULT 'med' NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hop_sweet_spot_drafts" ENABLE ROW LEVEL SECURITY;
