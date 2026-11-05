DROP TRIGGER IF EXISTS danchi_live ON "listen";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "listen" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "playlist";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "playlist" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
