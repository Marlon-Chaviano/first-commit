CREATE TABLE "org_email_verifications" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "verified_domain" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "verified_email" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "org_email_verifications" ADD CONSTRAINT "org_email_verifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;