CREATE TABLE "item_use" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text DEFAULT 'goal' NOT NULL,
	"title" text NOT NULL,
	"link" text,
	"status" text DEFAULT 'doing' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"level" integer,
	"notes" text,
	"due_on" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"learning_id" uuid,
	"day" date NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"store" text,
	"price_cents" integer NOT NULL,
	"on" date DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savings_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🐷' NOT NULL,
	"target_cents" integer NOT NULL,
	"saved_cents" integer DEFAULT 0 NOT NULL,
	"due_on" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deck" ADD COLUMN "kind" text DEFAULT 'flashcards' NOT NULL;--> statement-breakpoint
ALTER TABLE "deck" ADD COLUMN "year" text;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "bought_on" date;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "team" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "home_hidden" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "shop_budget_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD COLUMN "price_cents" integer;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD COLUMN "store" text;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD COLUMN "bought_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "repeat" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_use" ADD CONSTRAINT "item_use_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning" ADD CONSTRAINT "learning_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_log" ADD CONSTRAINT "learning_log_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_log" ADD CONSTRAINT "learning_log_learning_id_learning_id_fk" FOREIGN KEY ("learning_id") REFERENCES "public"."learning"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_log" ADD CONSTRAINT "price_log_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_use_idx" ON "item_use" USING btree ("item_id","at");--> statement-breakpoint
CREATE INDEX "learning_owner_idx" ON "learning" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "learning_log_idx" ON "learning_log" USING btree ("owner_id","day");--> statement-breakpoint
CREATE INDEX "price_log_idx" ON "price_log" USING btree ("owner_id","name");--> statement-breakpoint
CREATE INDEX "savings_owner_idx" ON "savings_goal" USING btree ("owner_id");