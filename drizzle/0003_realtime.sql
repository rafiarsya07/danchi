-- Realtime: every change to Danchi's data sends a tiny Postgres NOTIFY.
-- The app LISTENs and pushes it to every open screen over Server-Sent Events,
-- so whatever happens (her phone, the laptop, Chichi, the worker) shows up instantly.
CREATE OR REPLACE FUNCTION danchi_notify_change() RETURNS trigger AS $$
DECLARE
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  PERFORM pg_notify('danchi_live', json_build_object('t', TG_TABLE_NAME, 'op', TG_OP, 'o', rec.owner_id)::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "task";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "task" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "item";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "item" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "shopping_item";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "shopping_item" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "money_tx";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "money_tx" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "reminder";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "reminder" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "notification";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "notification" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS danchi_live ON "ai_memory";
--> statement-breakpoint
CREATE TRIGGER danchi_live AFTER INSERT OR UPDATE OR DELETE ON "ai_memory" FOR EACH ROW EXECUTE FUNCTION danchi_notify_change();
