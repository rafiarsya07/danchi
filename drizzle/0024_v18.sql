CREATE TABLE "spotify_me" (
	"user_id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"display_name" text,
	"refresh_token" text NOT NULL,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"use_app" boolean DEFAULT true NOT NULL,
	"problem" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spotify_me" ADD CONSTRAINT "spotify_me_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_me" ADD CONSTRAINT "spotify_me_space_id_user_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;