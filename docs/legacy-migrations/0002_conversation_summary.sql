CREATE TABLE "hop_conversation_summary" (
	"user_id" text PRIMARY KEY NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
