DROP TRIGGER IF EXISTS danchi_live ON "sos";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "sos" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "sos_point";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "sos_point" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "focus_session";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "focus_session" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "jar_note";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "jar_note" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "countdown";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "countdown" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
