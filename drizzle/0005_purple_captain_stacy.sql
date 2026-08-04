CREATE TABLE "hop_program_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"program" text NOT NULL,
	"username_mask" text NOT NULL,
	"secret_enc" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hop_sync_addresses" (
	"user_id" text PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hop_sync_addresses_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hop_program_credentials_user_program_idx" ON "hop_program_credentials" USING btree ("user_id","program");