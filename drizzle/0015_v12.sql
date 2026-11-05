ALTER TABLE "love_note" ADD COLUMN "kind" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "love_note" ADD COLUMN "reply_to_id" uuid;