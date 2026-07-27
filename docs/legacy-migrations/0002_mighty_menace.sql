CREATE TABLE "hop_valuation_overrides" (
	"program_id" text PRIMARY KEY NOT NULL,
	"cpp" numeric NOT NULL,
	"sample_size" integer NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
