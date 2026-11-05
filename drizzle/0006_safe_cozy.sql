CREATE TABLE "checkin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"lat" real,
	"lng" real,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'sent' NOT NULL,
	"nudged_at" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date,
	"flow" text,
	"symptoms" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"person" text NOT NULL,
	"direction" text DEFAULT 'owes_me' NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"due_on" date,
	"settled" boolean DEFAULT false NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"stored_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "love_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"text" text NOT NULL,
	"emoji" text DEFAULT '💌' NOT NULL,
	"reaction" text,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_log" (
	"owner_id" text NOT NULL,
	"day" date NOT NULL,
	"mood" integer NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_log_owner_id_day_pk" PRIMARY KEY("owner_id","day")
);
--> statement-breakpoint
CREATE TABLE "paper" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text DEFAULT 'document' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"org" text,
	"ref_hint" text,
	"expires_on" date,
	"deadline_on" date,
	"status" text DEFAULT 'idea' NOT NULL,
	"link" text,
	"notes" text,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_lock" (
	"user_id" text PRIMARY KEY NOT NULL,
	"pin_hash" text NOT NULL,
	"lock_minutes" integer DEFAULT 15 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"user_id" text NOT NULL,
	"path" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "paper_id" uuid;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "debt_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "hidden_sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "share_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "share_mood" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "cycle_tell_rafi" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "quiet_from" integer DEFAULT 23 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "quiet_to" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_cycle_notice_on" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "emergency" jsonb;--> statement-breakpoint
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_log" ADD CONSTRAINT "cycle_log_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt" ADD CONSTRAINT "debt_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "love_note" ADD CONSTRAINT "love_note_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "love_note" ADD CONSTRAINT "love_note_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_log" ADD CONSTRAINT "mood_log_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper" ADD CONSTRAINT "paper_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lock" ADD CONSTRAINT "user_lock_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_log" ADD CONSTRAINT "visit_log_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_log" ADD CONSTRAINT "visit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkin_owner_idx" ON "checkin" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "checkin_active_idx" ON "checkin" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_start_idx" ON "cycle_log" USING btree ("owner_id","start_on");--> statement-breakpoint
CREATE INDEX "debt_owner_idx" ON "debt" USING btree ("owner_id","settled");--> statement-breakpoint
CREATE INDEX "file_ref_idx" ON "file" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "love_owner_idx" ON "love_note" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "paper_owner_idx" ON "paper" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "visit_owner_idx" ON "visit_log" USING btree ("owner_id","at");--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_paper_id_paper_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."paper"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_debt_id_debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debt"("id") ON DELETE cascade ON UPDATE no action;