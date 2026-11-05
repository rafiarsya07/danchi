CREATE TABLE "daily_check" (
	"owner_id" text NOT NULL,
	"day" date NOT NULL,
	"no_spend" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "daily_check_owner_id_day_pk" PRIMARY KEY("owner_id","day")
);
--> statement-breakpoint
ALTER TABLE "daily_check" ADD CONSTRAINT "daily_check_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;