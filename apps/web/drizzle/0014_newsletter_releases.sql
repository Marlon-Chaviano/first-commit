CREATE TABLE "newsletter_deliveries" (
	"release_id" text NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"email" jsonb NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"skipped_at" timestamp with time zone,
	CONSTRAINT "newsletter_deliveries_release_id_subscriber_id_pk" PRIMARY KEY("release_id","subscriber_id")
);
--> statement-breakpoint
CREATE TABLE "newsletter_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"entry" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_release_id_newsletter_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."newsletter_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_subscriber_id_newsletter_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;