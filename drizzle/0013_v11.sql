CREATE TABLE "countdown" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"emoji" text DEFAULT '🎉' NOT NULL,
	"day" date NOT NULL,
	"yearly" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"label" text,
	"minutes" integer NOT NULL,
	"day" date NOT NULL,
	"course_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jar_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"from_user_id" text,
	"text" text NOT NULL,
	"emoji" text DEFAULT '⭐' NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"lat" real,
	"lng" real,
	"accuracy" real,
	"battery" integer,
	"last_at" timestamp with time zone,
	"calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sos_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sos_point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"sos_id" uuid NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"accuracy" real,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "sos_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "countdown" ADD CONSTRAINT "countdown_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jar_note" ADD CONSTRAINT "jar_note_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jar_note" ADD CONSTRAINT "jar_note_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos" ADD CONSTRAINT "sos_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_point" ADD CONSTRAINT "sos_point_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_point" ADD CONSTRAINT "sos_point_sos_id_sos_id_fk" FOREIGN KEY ("sos_id") REFERENCES "public"."sos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "countdown_owner_idx" ON "countdown" USING btree ("owner_id","day");--> statement-breakpoint
CREATE INDEX "focus_owner_idx" ON "focus_session" USING btree ("owner_id","day");--> statement-breakpoint
CREATE INDEX "jar_owner_idx" ON "jar_note" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "sos_owner_idx" ON "sos" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "sos_point_idx" ON "sos_point" USING btree ("sos_id","at");