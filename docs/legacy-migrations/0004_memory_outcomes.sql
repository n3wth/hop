CREATE TABLE "hop_memory_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"cabin" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "hop_memory_outcomes_user_created_idx"
	ON "hop_memory_outcomes" ("user_id", "created_at");
