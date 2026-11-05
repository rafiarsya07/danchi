DROP TRIGGER IF EXISTS danchi_live ON "daily_check";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "daily_check" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
