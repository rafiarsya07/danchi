DROP TRIGGER IF EXISTS danchi_live ON "game";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "game" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "love_sticker";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "love_sticker" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
-- Calmer Home: if she never customised it, start with the essentials only
UPDATE "settings" SET "home_hidden" = '["tips","stuff","papers","bills","meals","learning","projects","money","ask"]'::jsonb WHERE "home_hidden" = '[]'::jsonb;
