"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { ChichiIsland, type IslandAlert } from "@/components/island";
import { MusicHost } from "@/components/music";
import type { IslandState } from "@/lib/data";

/* ---------- tiny shared stores ---------- */

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => {
      if (Object.is(v, value)) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const unreadStore = createStore(0);
/** "live" when the realtime stream is connected */
const connStore = createStore<"live" | "connecting">("connecting");

function useStore<T>(s: ReturnType<typeof createStore<T>>, server: T) {
  return useSyncExternalStore(s.subscribe, s.get, () => server);
}

type Fresh = { id: string; title: string; body: string | null; url: string | null; kind: string };

/**
 * Keeps every open Danchi screen in sync, for real:
 *  - listens to /api/live (Server-Sent Events from Postgres NOTIFY)
 *  - refreshes the page data the moment anything changes, from any device
 *  - shows new notifications inside Chichi Island
 *  - registers the service worker for phone push
 */
let lastLocalAction = 0;

export function LiveProvider({
  initialUnread,
  island,
  canEdit,
  meId,
}: {
  initialUnread: number;
  island: IslandState;
  canEdit: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<IslandAlert[]>([]);
  const since = useRef<string>(new Date().toISOString());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    unreadStore.set(initialUnread);
  }, [initialUnread]);

  // Refresh when something changed elsewhere (her phone, the worker, Chichi).
  // Our own taps already come back with fresh data, so skip the echo of those:
  // no double render, no flicker.
  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLocalAction < 1500) return;
      router.refresh();
    }, 400);
  }, [router]);

  // Notice our own Server Actions (they carry a Next-Action header).
  useEffect(() => {
    const w = window as unknown as { __danchiFetch?: boolean };
    if (w.__danchiFetch) return;
    w.__danchiFetch = true;
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const h = init?.headers;
      const isAction = !!h && (h instanceof Headers ? h.has("next-action") : Object.keys(h as Record<string, string>).some((k) => k.toLowerCase() === "next-action"));
      const res = await orig(input, init);
      if (isAction) lastLocalAction = Date.now();
      return res;
    };
  }, []);

  const checkInbox = useCallback(async () => {
    try {
      const r = await fetch(`/api/notifications?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { unread: number; fresh: Fresh[]; now: string };
      since.current = data.now;
      unreadStore.set(data.unread);
      if (data.fresh.length) {
        setAlerts((a) => [...a, ...data.fresh.reverse().map((f) => ({ ...f }))].slice(-3));
        navigator.vibrate?.([40, 30, 40]);
      }
    } catch {
      /* offline */
    }
  }, []);

  // Realtime stream
  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const open = () => {
      if (stopped) return;
      es = new EventSource("/api/live");
      es.addEventListener("hello", () => connStore.set("live"));
      es.addEventListener("change", (ev) => {
        let t = "";
        try {
          t = (JSON.parse((ev as MessageEvent).data) as { t: string }).t;
        } catch {}
        if (t === "notification") checkInbox();
        refresh();
      });
      es.onerror = () => {
        connStore.set("connecting");
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          retry = setTimeout(open, 4000);
        }
      };
    };
    open();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [checkInbox, refresh]);

  // Safety net: if the stream is down, still catch up every minute and on wake.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      checkInbox();
      if (connStore.get() !== "live") refresh();
    };
    const id = setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        checkInbox();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [checkInbox, refresh]);

  // Service worker for push (+ hear about pushes while the app is open)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "danchi-push") {
        checkInbox();
        refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [checkInbox, refresh]);

  return (
    <>
      <ChichiIsland
        state={island}
        canEdit={canEdit}
        meId={meId}
        alerts={alerts}
        onAlertDone={(id) => setAlerts((a) => a.filter((x) => x.id !== id))}
        onChanged={refresh}
      />
      <MusicHost music={island.music} meId={meId} linked={island.spotifyLinked} mine={island.spotifyMe} />
    </>
  );
}

/** Little "Live" tag when the realtime stream is connected. */
export function LiveDot() {
  const c = useStore(connStore, "connecting");
  return (
    <span
      className={`rounded-full border-2 border-ink px-1.5 text-[10px] font-extrabold leading-4 ${c === "live" ? "bg-mint" : "bg-sun-soft"}`}
      title={c === "live" ? "Live: changes show up instantly" : "Connecting"}
    >
      {c === "live" ? "Live" : "Wait"}
    </span>
  );
}

/** Bell with the unread count, links to the inbox. */
export function BellButton({ initial = 0, size = "md" }: { initial?: number; size?: "md" | "sm" }) {
  const n = useStore(unreadStore, initial);
  const box = size === "sm" ? "size-11" : "size-12";
  return (
    <Link
      href="/inbox"
      aria-label={n ? `Inbox, ${n} new` : "Inbox"}
      className={`sticker-sm press relative flex ${box} shrink-0 items-center justify-center rounded-2xl bg-white`}
    >
      <CuteIcon name="bell" size={size === "sm" ? 30 : 34} className={n ? "wiggle" : undefined} />
      {n > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-coral px-1 text-xs font-extrabold text-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}

/** Unread count pill for the sidebar. */
export function UnreadPill({ initial = 0 }: { initial?: number }) {
  const n = useStore(unreadStore, initial);
  if (!n) return null;
  return <span className="ml-auto rounded-full border-2 border-ink bg-coral px-1.5 text-xs font-extrabold text-white">{n > 9 ? "9+" : n}</span>;
}
