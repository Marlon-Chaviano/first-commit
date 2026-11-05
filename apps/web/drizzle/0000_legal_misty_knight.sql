CREATE TABLE "install_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kit" text NOT NULL,
	"official" boolean NOT NULL,
	"options" jsonb NOT NULL,
	"skills" text[] NOT NULL,
	"agents" text[] NOT NULL,
	"pm" text NOT NULL,
	"cli_version" text NOT NULL,
	"os" text,
	"anon_id" uuid NOT NULL,
	"country" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kit_stats_daily" (
	"kit" text NOT NULL,
	"day" date NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "kit_stats_daily_kit_day_pk" PRIMARY KEY("kit","day")
);
--> statement-breakpoint
CREATE INDEX "install_events_kit_created_idx" ON "install_events" USING btree ("kit","created_at");