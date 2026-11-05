import "server-only";
import { EventEmitter } from "node:events";
import postgres from "postgres";

/**
 * One shared LISTEN connection per server process. Postgres triggers
 * (drizzle/0003_realtime.sql) NOTIFY on every change; we fan that out to the
 * open /api/live streams.
 */
export type LiveEvent = { t: string; op: string; o: string };

type Hub = { emitter: EventEmitter; started: Promise<void> | null };
const g = globalThis as unknown as { danchiLive?: Hub };

function hub(): Hub {
  if (!g.danchiLive) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    g.danchiLive = { emitter, started: null };
  }
  return g.danchiLive;
}

function start(h: Hub) {
  if (h.started) return h.started;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 0 });
  h.started = sql
    .listen(
      "danchi_live",
      (payload) => {
        try {
          h.emitter.emit("change", JSON.parse(payload) as LiveEvent);
        } catch {
          /* ignore junk */
        }
      },
      () => h.emitter.emit("change", { t: "reconnect", op: "LISTEN", o: "*" } satisfies LiveEvent),
    )
    .then(() => undefined)
    .catch((e) => {
      console.error("[live] listen failed", e);
      h.started = null;
    });
  return h.started;
}

/** Subscribe to changes in one Danchi space. Returns an unsubscribe function. */
export function subscribe(spaceId: string, fn: (e: LiveEvent) => void): () => void {
  const h = hub();
  void start(h);
  const handler = (e: LiveEvent) => {
    if (e.o === spaceId || e.o === "*") fn(e);
  };
  h.emitter.on("change", handler);
  return () => h.emitter.off("change", handler);
}
