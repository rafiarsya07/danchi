-- Realtime for the new modules (same trigger function as 0003_realtime.sql)
DROP TRIGGER IF EXISTS danchi_live ON "project";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "project" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "course";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "course" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "assignment";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "assignment" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "exam";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "exam" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "deck";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "deck" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "card";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "card" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "note";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "note" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "habit";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "habit" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "habit_log";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "habit_log" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "recipe";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "recipe" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "meal_plan";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "meal_plan" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "bill";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "bill" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "wish";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "wish" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
