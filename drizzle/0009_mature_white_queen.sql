CREATE TABLE "hop_shared_verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"created_by" text,
	"params" jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hop_shared_verdicts_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE INDEX "hop_shared_verdicts_created_by_idx" ON "hop_shared_verdicts" USING btree ("created_by");