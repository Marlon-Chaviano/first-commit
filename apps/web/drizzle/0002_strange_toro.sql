CREATE TABLE "kit_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit" text NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"contact" text,
	"ip_hash" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit" text NOT NULL,
	"version" text NOT NULL,
	"ok" boolean NOT NULL,
	"platform" text NOT NULL,
	"repository" text NOT NULL,
	"commit_sha" text NOT NULL,
	"workflow_ref" text,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "kit_reports_kit_idx" ON "kit_reports" USING btree ("kit","created_at");--> statement-breakpoint
CREATE INDEX "kit_verifications_kit_version_idx" ON "kit_verifications" USING btree ("kit","version","created_at");