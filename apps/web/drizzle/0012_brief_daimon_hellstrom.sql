CREATE TABLE "shared_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"kit" text NOT NULL,
	"kit_version" text NOT NULL,
	"selections" jsonb NOT NULL,
	"name" text,
	"opens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "shared_configs_kit_idx" ON "shared_configs" USING btree ("kit");