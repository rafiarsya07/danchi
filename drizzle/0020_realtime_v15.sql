DROP TRIGGER IF EXISTS danchi_live ON "bucket";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "bucket" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
