"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import type { IslandState } from "@/lib/data";
import { addPlaylist, joinListen, leaveListen, musicControl, removePlaylist, setSpotifyApp, startListen, stopListen } from "@/app/(app)/music-actions";
import { Icon } from "@/components/icon";

/* ---------------- Spotify iFrame API (loaded once, only when needed) ---------------- */

type Controller = {
  loadEntity?: (uri: string, preferVideo?: boolean, startAt?: number) => void;
  loadUri: (uri: string, preferVideo?: boolean, startAt?: number) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  seek: (s: number) => void;
  destroy: () => void;
  addListener: (ev: string, cb: (e: { data: { playingURI?: string; isPaused?: boolean; isBuffering?: boolean; position?: number; duration?: number } }) => void) => void;
};
type Api = { createController: (el: HTMLElement, opts: { uri: string; width?: string | number; height?: string | number }, cb: (c: Controller) => void) => void };

let apiPromise: Promise<Api> | null = null;
function loadApi(): Promise<Api> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as unknown as { onSpotifyIframeApiReady?: (a: Api) => void };
    w.onSpotifyIframeApiReady = (a) => resolve(a);
    const s = document.createElement("script");
    s.src = "https://open.spotify.com/embed/iframe-api/v1";
    s.async = true;
    document.body.appendChild(s);
  });
  return apiPromise;
}

type Music = NonNullable<IslandState["music"]>;
const expectedPos = (m: Music) => (m.paused ? m.positionMs : m.positionMs + Math.max(0, Date.now() - new Date(m.updatedAt).getTime()));

/* ---------------- the floating player (lives across every page) ---------------- */

/**
 * Mounted once next to Chichi Island. Only exists while this phone has joined
 * a listen-together session, so nothing ever plays without your tap.
 */
export function MusicHost({ music, meId, linked = false, mine = null }: { music: IslandState["music"]; meId: string; linked?: boolean; mine?: IslandState["spotifyMe"] }) {
  const listening = !!music?.active && music.listeners.includes(meId);
  // with my own Spotify connected, songs play in my Spotify app (full songs); otherwise the small embed
  const inApp = listening && !!mine?.app;
  const joined = listening && !inApp;
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const ctrl = useRef<Controller | null>(null);
  const cur = useRef<{ uri: string | null; paused: boolean; pos: number }>({ uri: null, paused: true, pos: 0 });
  const quietUntil = useRef(0); // ignore our own echo after applying a remote change
  const lastSent = useRef<{ uri: string | null; paused: boolean | null; at: number; pos: number }>({ uri: null, paused: null, at: 0, pos: 0 });
  const seqSeen = useRef<number | null>(null);
  const endedSeq = useRef<number | null>(null);
  const live = useRef(music);
  useEffect(() => {
    live.current = music;
  }, [music]);
  const path = usePathname();
  // without the Spotify connection, the Music page shows the player's own song list (tall player)
  const isBig = path.startsWith("/music") && !linked;
  const big = useRef(isBig);
  useEffect(() => {
    big.current = isBig;
    const f = holder.current?.querySelector("iframe");
    if (f) {
      f.setAttribute("height", isBig ? "352" : "80");
      f.style.height = isBig ? "352px" : "80px";
    }
  }, [isBig, joined]);

  // create / destroy the embed
  useEffect(() => {
    if (!joined || !holder.current) return;
    let gone = false;
    const el = document.createElement("div");
    holder.current.appendChild(el);
    // if the Spotify script can't start (blocked, offline), show a plain player instead of an empty box
    let fell = false;
    const fallback = window.setTimeout(() => {
      if (gone || ctrl.current) return;
      fell = true;
      const m = live.current;
      const [, kind, id] = (m?.trackUri ?? m?.playlistUri ?? "").split(":");
      if (!kind || !id) return;
      const f = document.createElement("iframe");
      f.src = `https://open.spotify.com/embed/${kind}/${id}`;
      f.width = "100%";
      f.height = big.current ? "352" : "80";
      f.style.border = "0";
      f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
      el.appendChild(f);
    }, 8000);
    loadApi().then((api) => {
      if (gone || fell) return;
      window.clearTimeout(fallback);
      const m = live.current!;
      seqSeen.current = m.seq;
      const uri = m.trackUri ?? m.playlistUri ?? "";
      api.createController(el, { uri, width: "100%", height: big.current ? 352 : 80 }, (c) => {
        if (gone) return c.destroy();
        ctrl.current = c;
        c.addListener("ready", () => {
          const mm = live.current;
          if (!mm) return;
          quietUntil.current = Date.now() + 2500;
          if (mm.trackUri) c.seek(Math.floor(expectedPos(mm) / 1000));
          if (!mm.paused) c.play();
        });
        c.addListener("playback_update", (e) => {
          const d = e.data;
          cur.current = { uri: d.playingURI ?? cur.current.uri, paused: !!d.isPaused, pos: d.position ?? 0 };
          setPlaying(!d.isPaused);
          const mm = live.current;
          if (!mm?.active || d.isBuffering) return;
          const amDj = mm.dj === meId;
          // the song finished on the DJ's phone: next one in the queue, for both
          if (amDj && d.isPaused && (d.duration ?? 0) > 0 && (d.position ?? 0) >= (d.duration ?? 0) - 1500 && mm.upNext > 0 && endedSeq.current !== mm.seq) {
            endedSeq.current = mm.seq;
            fetch("/api/listen/next", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seq: mm.seq }) }).catch(() => {});
            return;
          }
          const L = lastSent.current;
          // a new song on the DJ's phone always goes out; pause and seeks are skipped right after we applied a remote change
          const uriChanged = amDj && !!d.playingURI && /^spotify:(track|episode):/.test(d.playingURI) && d.playingURI !== L.uri;
          const quiet = Date.now() < quietUntil.current;
          const pauseChanged = !quiet && !!d.isPaused !== mm.paused && !!d.isPaused !== L.paused;
          const jumped = !quiet && amDj && Math.abs((d.position ?? 0) - (L.pos + (L.paused ? 0 : Date.now() - L.at))) > 5000;
          if (!uriChanged && !pauseChanged && !jumped) return;
          lastSent.current = { uri: d.playingURI ?? L.uri, paused: !!d.isPaused, at: Date.now(), pos: d.position ?? 0 };
          fetch("/api/listen", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ trackUri: amDj ? d.playingURI : undefined, positionMs: d.position ?? 0, paused: !!d.isPaused }),
          }).catch(() => {});
        });
      });
    });
    return () => {
      gone = true;
      window.clearTimeout(fallback);
      ctrl.current?.destroy();
      ctrl.current = null;
      el.remove();
    };
  }, [joined, meId]);

  // follow the shared state (track, pause, position)
  useEffect(() => {
    const c = ctrl.current;
    if (!c || !music?.active || !joined) return;
    const amDj = music.dj === meId;
    const want = expectedPos(music);
    // someone picked a song or a playlist: every phone loads it
    if (seqSeen.current !== null && music.seq !== seqSeen.current) {
      seqSeen.current = music.seq;
      const uri = music.trackUri ?? music.playlistUri;
      if (uri) {
        quietUntil.current = Date.now() + 3000;
        lastSent.current = { uri: music.trackUri, paused: false, at: Date.now(), pos: 0 };
        (c.loadEntity ?? c.loadUri).call(c, uri, false, Math.floor(want / 1000));
        setTimeout(() => c.play(), 500);
        return;
      }
    }
    if (!amDj && music.trackUri && music.trackUri !== cur.current.uri) {
      quietUntil.current = Date.now() + 2500;
      (c.loadEntity ?? c.loadUri).call(c, music.trackUri, false, Math.floor(want / 1000));
      if (!music.paused) setTimeout(() => c.play(), 400);
      return;
    }
    if (music.paused !== cur.current.paused) {
      quietUntil.current = Date.now() + 1500;
      if (music.paused) c.pause();
      else c.resume();
    }
    if (!amDj && music.trackUri && Math.abs(want - cur.current.pos) > 6000) {
      quietUntil.current = Date.now() + 1500;
      c.seek(Math.floor(want / 1000));
    }
  }, [music, joined, meId]);

  if (inApp) return <AppPlayer music={music!} problem={mine?.problem ?? null} />;
  if (!joined) return null;
  const onChat = path.startsWith("/love");
  const show = open || isBig;
  return (
    <div className={`fixed right-3 z-40 flex flex-col items-end gap-2 md:bottom-5 ${onChat ? "bottom-[86px]" : "bottom-[104px]"}`}>
      <div
        className={`overflow-hidden rounded-[22px] border-2 border-ink bg-white shadow-[0_6px_0_#2E2240] transition-all ${isBig ? "w-[min(440px,calc(100vw-24px))]" : "w-[min(340px,calc(100vw-24px))]"} ${show ? "opacity-100" : "pointer-events-none h-0 border-0 opacity-0 shadow-none"}`}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-extrabold">
          <span className="flex-1 truncate">
            Together: {music!.playlistName}
            {music!.upNext ? `, ${music!.upNext} up next` : ""}
          </span>
          <LeaveStop />
        </div>
        <div ref={holder} className={`w-full ${isBig ? "h-[352px]" : "h-20"}`} />
        <p className="px-3 py-1 text-[10.5px] font-semibold text-ink-soft">
          Only 30s previews on phones.{" "}
          <a href="/music" className="underline">
            Connect your Spotify
          </a>{" "}
          for full songs in the Spotify app.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-label={open ? "Hide the player" : "Show the player"}
        className="press flex size-14 items-center justify-center rounded-full border-2 border-ink bg-ink shadow-[0_4px_0_#2E2240]"
      >
        <Vinyl spinning={playing} />
      </button>
    </div>
  );
}

/* ---------------- playing in my own Spotify app (Spotify Connect) ---------------- */

type Now = { uri: string; name: string; artists: string; image: string | null; ms: number; progress: number; playing: boolean; device: string | null } | null;

const PROBLEM: Record<string, string> = {
  "no-device": "Open the Spotify app on this phone (play anything for a second), then tap Try again.",
  premium: "Spotify only lets Danchi play songs on Premium accounts.",
  "not-added": "This Spotify account isn't added to the Danchi app yet. Rafi adds it in the Spotify dashboard, User Management.",
  auth: "Spotify logged out of Danchi. Connect it again on the Music page.",
  error: "Spotify didn't answer. Tap Try again.",
};

function AppPlayer({ music, problem: first }: { music: Music; problem: string | null }) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState<Now>(null);
  const [problem, setProblem] = useState<string | null>(first);
  const [tick, setTick] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const path = usePathname();

  // ask Spotify what this phone plays, every few seconds while Danchi is visible
  useEffect(() => {
    let gone = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/listen/now")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { now: Now; problem: string | null } | null) => {
          if (gone || !d) return;
          setNow(d.now);
          setProblem(d.problem);
          setTick(Date.now());
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 12_000);
    const v = () => load();
    document.addEventListener("visibilitychange", v);
    return () => {
      gone = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", v);
    };
  }, [music.seq, music.paused, music.trackUri]);

  // move the progress bar between checks
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!now?.playing) return;
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [now?.playing]);
  const pos = now ? Math.min(now.ms, now.progress + (now.playing && clock > tick ? clock - tick : 0)) : 0;

  const act = (k: "pause" | "resume" | "next" | "sync") =>
    start(async () => {
      const r = await musicControl(k);
      if (r.problem !== undefined) setProblem(r.problem ?? null);
      router.refresh();
      setTimeout(() => fetch("/api/listen/now").then((x) => x.json()).then((d) => (setNow(d.now), setTick(Date.now()))).catch(() => {}), 1200);
    });

  const onChat = path.startsWith("/love");
  const playing = now?.playing ?? !music.paused;
  const trackId = (now?.uri ?? music.trackUri ?? music.playlistUri ?? "").split(":");
  return (
    <div className={`fixed right-3 z-40 flex flex-col items-end gap-2 md:bottom-5 ${onChat ? "bottom-[86px]" : "bottom-[104px]"}`}>
      {open && (
        <div className="w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[22px] border-2 border-ink bg-white shadow-[0_6px_0_#2E2240]">
          <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-extrabold">
            <span className="flex-1 truncate">
              Together: {music.playlistName}
              {music.upNext ? `, ${music.upNext} up next` : ""}
            </span>
            <LeaveStop />
          </div>
          <div className="flex items-center gap-3 bg-[#d6f7e2] px-3 py-2.5">
            {now?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={now.image} alt="" className="size-12 shrink-0 rounded-lg border border-ink/20 object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white">
                <Icon name="music" size={20} />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[14.5px] font-extrabold">{now?.name ?? (problem ? "Not playing on this phone" : "Starting in your Spotify app")}</span>
              <span className="truncate text-[12px] font-semibold text-ink-soft">{now ? `${now.artists}${now.device ? `, on ${now.device}` : ""}` : "Full songs, plays with the screen off too"}</span>
              {now && now.ms > 0 && (
                <span className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-[#1ED760]" style={{ width: `${(pos / now.ms) * 100}%` }} />
                </span>
              )}
            </span>
          </div>
          {problem && (
            <div className="flex flex-col gap-1.5 bg-pink-soft px-3 py-2">
              <p className="text-[12.5px] font-bold">{PROBLEM[problem] ?? PROBLEM.error}</p>
              {problem !== "not-added" && problem !== "auth" && (
                <button type="button" disabled={pending} onClick={() => act("sync")} className="self-start rounded-full border-2 border-ink bg-white px-3 py-1 text-[12.5px] font-extrabold">
                  Try again
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(playing ? "pause" : "resume")}
              aria-label={playing ? "Pause for both" : "Play for both"}
              className="press flex size-11 items-center justify-center rounded-full border-2 border-ink bg-[#1ED760] text-[16px] font-black shadow-[0_3px_0_#2E2240]"
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button type="button" disabled={pending} onClick={() => act("next")} aria-label="Next song for both" className="press flex size-11 items-center justify-center rounded-full border-2 border-ink bg-white text-[15px] font-black">
              ▶▶
            </button>
            <button type="button" disabled={pending} onClick={() => act("sync")} className="press flex h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 text-[13px] font-extrabold" title="Put this phone on the same song and second">
              <Icon name="repeat" size={15} />
              Sync
            </button>
            {trackId[2] && (
              <a href={`https://open.spotify.com/${trackId[1]}/${trackId[2]}`} target="_blank" rel="noreferrer" className="ml-auto text-[12px] font-extrabold text-[#139a46] underline">
                Open Spotify
              </a>
            )}
          </div>
          <button type="button" disabled={pending} onClick={() => start(async () => (await setSpotifyApp(false), router.refresh()))} className="w-full border-t border-[var(--color-line)] px-3 py-1.5 text-left text-[11px] font-semibold text-ink-soft">
            Playing in your Spotify app. Use the small Danchi player instead
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-label={open ? "Hide the player" : "Show the player"}
        className="press flex size-14 items-center justify-center rounded-full border-2 border-ink bg-ink shadow-[0_4px_0_#2E2240]"
      >
        <Vinyl spinning={!!now?.playing} />
      </button>
    </div>
  );
}

function Vinyl({ spinning }: { spinning: boolean }) {
  return (
    <svg width={46} height={46} viewBox="0 0 46 46" className={spinning ? "animate-[spin_3s_linear_infinite]" : ""} aria-hidden>
      <circle cx={23} cy={23} r={21} fill="#1E1630" />
      <circle cx={23} cy={23} r={15} fill="none" stroke="#3a2f52" strokeWidth={1.5} />
      <circle cx={23} cy={23} r={10.5} fill="none" stroke="#3a2f52" strokeWidth={1.5} />
      <circle cx={23} cy={23} r={7} fill="#FFB38A" />
      <path d="M23 18 c1 -2 4 -2.5 5 -1.5 c-1 2 -3 2.5 -5 1.5 Z" fill="#7BD3A8" />
      <circle cx={23} cy={23} r={1.6} fill="#1E1630" />
      <path d="M9 14 a17 17 0 0 1 8 -6" stroke="#fff" strokeOpacity={0.25} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </svg>
  );
}

function LeaveStop() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => start(async () => (await leaveListen(), router.refresh()))} className="rounded-full bg-cream px-2.5 py-1">
        Leave
      </button>
      <button type="button" disabled={pending} onClick={() => confirm("Stop the music for both of you?") && start(async () => (await stopListen(), router.refresh()))} className="rounded-full bg-pink-soft px-2.5 py-1">
        Stop
      </button>
    </>
  );
}

/* ---------------- controls inside Chichi Island ---------------- */

export function MusicPanel({ state, meId, onDone }: { state: IslandState; meId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const m = state.music;
  const joined = !!m?.active && m.listeners.includes(meId);
  const go = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2 rounded-[22px] bg-white/10 p-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#1ED760]">
          <Icon name="music" size={18} stroke={2.4} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[14px] font-extrabold">Listen together</span>
          <span className="truncate text-[12px] font-bold text-cream/70">
            {m?.active ? `${m.dj === meId ? "You are" : `${m.djName} is`} playing ${m.playlistName}` : "Same song, both phones"}
          </span>
        </span>
        {m?.active && !joined && (
          <button type="button" disabled={pending} onClick={() => go(joinListen)} className="animate-pulse rounded-full bg-[#1ED760] px-3.5 py-1.5 text-[13px] font-extrabold text-ink">
            Join
          </button>
        )}
      </div>
      {state.playlists.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {state.playlists.map((p) => (
            <span key={p.id} className="flex items-center rounded-full bg-cream text-ink">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  go(() => startListen(p.id));
                  onDone();
                }}
                className="rounded-full py-1.5 pl-3 pr-2 text-[12.5px] font-extrabold"
                title="Play this for both of us"
              >
                ▶ {p.name}
              </button>
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => confirm(`Remove ${p.name}?`) && go(() => removePlaylist(p.id))} className="pr-2 text-ink-soft">
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] font-bold text-cream/80">Add your Spotify playlists to listen together.</p>
      )}
      {adding ? (
        <form
          action={async (fd) => {
            setErr(null);
            const r = await addPlaylist({ ok: false }, fd);
            if (!r.ok) setErr(r.error ?? "Couldn't add it");
            else {
              setAdding(false);
              router.refresh();
            }
          }}
          className="flex flex-col gap-1.5"
        >
          <input name="name" maxLength={60} placeholder="Name (Our songs)" className="h-9 rounded-xl bg-cream px-3 text-[13px] font-bold text-ink outline-none" />
          <input name="url" required placeholder="Spotify playlist link" className="h-9 rounded-xl bg-cream px-3 text-[13px] font-bold text-ink outline-none" />
          {err && <span className="text-[12px] font-bold text-pink">{err}</span>}
          <div className="flex gap-1.5">
            <button type="submit" className="rounded-full bg-[#1ED760] px-3 py-1 text-[12.5px] font-extrabold text-ink">
              Add playlist
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-extrabold">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <a href="/music" onClick={onDone} className="rounded-full bg-[#1ED760] px-3 py-1 text-[12px] font-extrabold text-ink">
            Songs and search
          </a>
          <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-extrabold">
            + Add a Spotify playlist
          </button>
        </div>
      )}
      {m?.active && !joined && <p className="text-[11.5px] font-semibold text-cream/70">Nothing plays on your phone until you tap Join.</p>}
    </div>
  );
}
