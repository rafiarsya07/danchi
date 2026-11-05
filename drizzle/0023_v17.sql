CREATE TABLE "spotify_auth" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"connected_by" text,
	"display_name" text,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listen" ADD COLUMN "seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listen" ADD COLUMN "queue" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "spotify_auth" ADD CONSTRAINT "spotify_auth_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_auth" ADD CONSTRAINT "spotify_auth_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;