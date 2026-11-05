"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { askChichi } from "@/lib/ask-client";
import { MusicPanel } from "@/components/music";
import { Mascot, MascotBadge, type Mood } from "@/components/mascot";
import { toggleTask } from "@/app/(app)/actions";
import type { IslandState } from "@/lib/data";

export type IslandAlert = { id: string; title: string; body: string | null; url: string | null; kind: string };

/* Show/hide preference lives on the device (Settings has the switch). */
const KEY = "danchi-island";
function subscribePref(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("danchi-island", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("danchi-island", cb);
  };
}
function readPref() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function useIslandPref() {
  return useSyncExternalStore(subscribePref, readPref, () => true);
}
export function setIslandPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event("danchi-island"));
}

function useNow(every = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** The cozy-corner focus timer lives on this device; peek at it. */
function useFocusRun(now: number) {
  const [run, setRun] = useState<{ endAt: number | null; leftMs: number; mode: string; label?: string } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const r = JSON.parse(localStorage.getItem("danchi-focus") || "null");
        setRun(r && typeof r.total === "number" ? r : null);
      } catch {
        setRun(null);
      }
    };
    read();
    window.addEventListener("storage", read);
    const id = setInterval(read, 5000);
    return () => {
      window.removeEventListener("storage", read);
      clearInterval(id);
    };
  }, []);
  if (!run) return null;
  const left = run.endAt ? run.endAt - now : run.leftMs;
  if (left <= 0) return null;
  return { left, mode: run.mode, paused: !run.endAt, label: run.label };
}

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function countdown(ms: number) {
  if (ms <= 60_000) return "now";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Chichi Island: a little live pill at the top of every screen, inspired by
 * the iPhone Dynamic Island. Shows what's next with a countdown, grows when
 * a notification arrives, and opens into a mini control center.
 */
export function ChichiIsland({
  state,
  canEdit,
  meId,
  alerts,
  onAlertDone,
  onChanged,
}: {
  state: IslandState;
  canEdit: boolean;
  meId: string;
  alerts: IslandAlert[];
  onAlertDone: (id: string) => void;
  onChanged: () => void;
}) {
  const visible = useIslandPref();
  const now = useNow(1000);
  const focus = useFocusRun(now);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const alert = alerts[0];

  // Alerts stay for a few seconds, then shrink back into the pill.
  useEffect(() => {
    if (!alert || open) return;
    const id = setTimeout(() => onAlertDone(alert.id), 6500);
    return () => clearTimeout(id);
  }, [alert, open, onAlertDone]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible && !alert) return null;

  const next = state.next;
  const msToNext = next ? new Date(next.at).getTime() - now : Infinity;
  const soon = next && msToNext < 3 * 3600_000;
  const total = state.todayOpen + state.todayDone;
  const msToTimer = state.timer ? new Date(state.timer.dueAt).getTime() - now : 0;

  let mood: Mood = "happy";
  let label: React.ReactNode;
  let right: React.ReactNode = null;
  let tone = "bg-ink";
  if (state.sos) {
    mood = "worried";
    tone = "bg-[#C9213A]";
    label = <span className="flex min-w-0 items-center gap-1"><Ico n="sos" /><span className="truncate">SOS is on, tap for her location</span></span>;
  } else if (state.timer) {
    mood = msToTimer < 0 ? "worried" : "remind";
    label = <span className="flex min-w-0 items-center gap-1"><Ico n="compass" /><span className="truncate">Safe arrival timer</span></span>;
    right = <span className="shrink-0 font-display text-sun">{msToTimer <= 0 ? "late!" : countdown(msToTimer)}</span>;
  } else if (state.love) {
    mood = "love";
    label = (
      <span className="flex min-w-0 items-center gap-1">
        <Ico n="letter" />
        <span className="truncate">
          {state.love.from}: {state.love.text}
        </span>
      </span>
    );
    right = state.love.count > 1 ? <span className="shrink-0 rounded-full bg-[#FF8A5C] px-1.5 text-[11px]">{state.love.count}</span> : null;
  } else if (state.music?.active && !state.music.listeners.includes(meId)) {
    mood = "love";
    label = (
      <span className="flex min-w-0 items-center gap-1">
        <span className="flex size-5 items-center justify-center rounded-full bg-[#1ED760] text-[11px] text-ink">♫</span>
        <span className="truncate">{state.music.djName} is playing music. Join?</span>
      </span>
    );
  } else if (soon && next) {
    mood = "remind";
    label = <span className="truncate">{next.title}</span>;
    right = <span className="shrink-0 font-display text-sun">{msToNext <= 0 ? "now" : countdown(msToNext)}</span>;
  } else if (state.turns.length) {
    mood = "cheer";
    label = <span className="flex min-w-0 items-center gap-1"><Ico n="game" /><span className="truncate">Your turn: {state.turns[0].label}</span></span>;
  } else if (focus) {
    mood = focus.mode === "break" ? "love" : "think";
    label = <span className="flex min-w-0 items-center gap-1"><Ico n={focus.mode === "break" ? "cozy" : "focus"} /><span className="truncate">{focus.mode === "break" ? "Break" : focus.label || "Focus"}</span></span>;
    right = <span className="shrink-0 font-display tabular-nums text-sun">{focus.paused ? "paused" : mmss(focus.left)}</span>;
  } else if (state.celebrate) {
    mood = "cheer";
    label = <span className="truncate">{state.celebrate}</span>;
  } else if (state.music?.active && state.music.listeners.includes(meId) && !state.music.paused) {
    mood = "love";
    label = (
      <span className="flex min-w-0 items-center gap-1.5">
        <Bars />
        <span className="truncate">Listening together: {state.music.playlistName}</span>
      </span>
    );
  } else if (state.todayOpen > 0) {
    label = <span className="truncate">{state.todayOpen} left today</span>;
    right = <MiniRing done={state.todayDone} total={total} />;
  } else if (state.exam) {
    mood = "think";
    label = <span className="flex min-w-0 items-center gap-1"><Ico n="exam" /><span className="truncate">{state.exam.title}</span></span>;
    right = <span className="shrink-0 font-display text-sun">{countdown(new Date(state.exam.at).getTime() - now)}</span>;
  } else if (state.countdown) {
    mood = "cheer";
    label = (
      <span className="truncate">
        {state.countdown.emoji} {state.countdown.title}
      </span>
    );
    right = <span className="shrink-0 font-display text-sun">{state.countdown.days === 0 ? "today!" : `${state.countdown.days}d`}</span>;
  } else if (state.expiring > 0) {
    mood = "worried";
    label = <span className="truncate">{state.expiring} expiring soon</span>;
  } else {
    mood = total > 0 ? "cheer" : "happy";
    label = <span className="truncate">{total > 0 ? "All done today!" : "Cosy day 🌼"}</span>;
  }

  const shell =
    "fixed left-1/2 top-[max(8px,env(safe-area-inset-top))] z-50 -translate-x-1/2 md:left-[calc(50%+128px)] text-cream";

  // ---- Alert: a notification just arrived ----
  if (alert && !open) {
    return (
      <div ref={ref} className={shell}>
        <div role="status" className="island-grow flex w-[min(380px,calc(100vw-20px))] items-center gap-2 rounded-[30px] bg-ink py-2 pl-1.5 pr-2 shadow-[0_8px_24px_rgba(46,34,64,0.35)]">
          <span className="shrink-0 rounded-full bg-peach-soft">
            <Mascot mood={alert.kind === "low" ? "worried" : alert.kind === "digest" ? "wave" : "remind"} size={54} animate={false} />
          </span>
          <Link href={alert.url || "/inbox"} onClick={() => onAlertDone(alert.id)} className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-extrabold">{alert.title}</span>
            {alert.body && <span className="line-clamp-2 text-[13px] font-bold text-cream/75">{alert.body}</span>}
          </Link>
          <button type="button" aria-label="Dismiss" onClick={() => onAlertDone(alert.id)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon name="close" size={16} stroke={2.6} />
          </button>
        </div>
      </div>
    );
  }

  // ---- Collapsed pill ----
  if (!open) {
    return (
      <div ref={ref} className={shell}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Chichi Island"
          className={`island-in flex h-10 max-w-[min(300px,calc(100vw-140px))] items-center gap-2 rounded-full ${tone} py-1 pl-1 pr-3.5 text-[13px] font-extrabold shadow-[0_4px_14px_rgba(46,34,64,0.3)] transition active:scale-95 ${state.sos ? "animate-pulse" : ""}`}
        >
          <span className="flex size-8 shrink-0 items-end justify-center overflow-hidden rounded-full bg-peach-soft">
            <Mascot mood={mood} size={36} animate={false} className="-mb-1" />
          </span>
          {label}
          {right}
        </button>
      </div>
    );
  }

  // ---- Expanded: mini control center ----
  return (
    <div ref={ref} className={shell}>
      <div className="island-grow flex max-h-[calc(100dvh-20px)] w-[min(390px,calc(100vw-16px))] flex-col gap-3 overflow-y-auto overscroll-contain rounded-[32px] bg-ink p-3.5 shadow-[0_12px_32px_rgba(46,34,64,0.4)]">
        <div className="flex items-center gap-2">
          <MascotBadge size={42} mood={mood} />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="font-display text-lg font-bold">Chichi Island</span>
            <span className="text-xs font-bold text-cream/70">
              {state.todayDone}/{total} done today{state.low ? `, ${state.low} running low` : ""}
            </span>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-full bg-white/10">
            <Icon name="close" size={18} stroke={2.6} />
          </button>
        </div>

        {state.sos && (
          <Link href={`/sos/${state.sos.token}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[22px] bg-[#C9213A] p-2.5 text-sm font-extrabold text-white">
            <Ico n="sos" /> SOS is on. Open live location
          </Link>
        )}
        {state.celebrate && <p className="rounded-[22px] bg-pink-soft p-2.5 text-center text-sm font-extrabold text-ink">{state.celebrate}</p>}
        {state.love && (
          <Link href="/love" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[22px] bg-pink-soft p-2.5 text-ink">
            <CuteIcon name="letter" size={34} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13px] font-extrabold">
                {state.love.from}
                {state.love.count > 1 ? `, ${state.love.count} new` : ""}
              </span>
              <span className="truncate text-[13px] font-bold text-ink-soft">{state.love.text}</span>
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold">Reply</span>
          </Link>
        )}
        <MusicPanel state={state} meId={meId} onDone={() => setOpen(false)} />

        {(state.turns.length > 0 || focus || state.timer || state.exam || state.countdown) && (
          <div className="flex flex-wrap gap-1.5">
            {state.timer && (
              <Link href="/safe" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-extrabold">
                <Ico n="compass" /> Timer {msToTimer <= 0 ? "late!" : countdown(msToTimer)}
              </Link>
            )}
            {state.turns.map((t) => (
              <Link key={t.kind} href={`/play?g=${t.kind}`} onClick={() => setOpen(false)} className="rounded-full bg-sun px-3 py-1.5 text-[12px] font-extrabold text-ink">
                <Ico n="game" /> Your turn: {t.label}
              </Link>
            ))}
            {focus && (
              <Link href="/cozy?tab=focus" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-extrabold">
                <Ico n={focus.mode === "break" ? "cozy" : "focus"} /> {focus.mode === "break" ? "Break" : "Focus"} {focus.paused ? "paused" : mmss(focus.left)}
              </Link>
            )}
            {state.exam && (
              <Link href="/study?tab=exams" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-extrabold">
                <Ico n="exam" /> {state.exam.title} in {countdown(new Date(state.exam.at).getTime() - now)}
              </Link>
            )}
            {state.countdown && (
              <Link href="/cozy?tab=days" onClick={() => setOpen(false)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-extrabold">
                {state.countdown.emoji} {state.countdown.title}: {state.countdown.days === 0 ? "today!" : `${state.countdown.days}d`}
              </Link>
            )}
          </div>
        )}

        {next ? (
          <NextReminder next={next} msToNext={msToNext} canEdit={canEdit} onChanged={onChanged} />
        ) : (
          <Link href="/reminders?new=1" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[22px] bg-white/10 p-2.5 text-sm font-extrabold">
            <CuteIcon name="bell" size={30} /> No reminders. Add one?
          </Link>
        )}

        {state.tasks.length > 0 && (
          <div className="flex flex-col gap-1 rounded-[22px] bg-cream p-2 text-ink">
            {state.tasks.map((t) => (
              <IslandTask key={t.id} id={t.id} title={t.title} canEdit={canEdit} />
            ))}
          </div>
        )}

        <QuickTell onDone={onChanged} />

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { href: "/love", icon: "letter" as const, label: "Chat" },
            { href: "/play", icon: "party" as const, label: "Play" },
            { href: "/tasks", icon: "tasks" as const, label: "Tasks" },
            { href: "/reminders", icon: "bell" as const, label: "Remind" },
            { href: "/cozy", icon: "cozy" as const, label: "Cozy" },
            { href: "/safe", icon: "shield" as const, label: "Safety" },
            { href: "/shop", icon: "shop" as const, label: "Shop" },
            { href: "/ask", icon: "ask" as const, label: "Chichi" },
          ].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/10 py-1.5 text-[11px] font-extrabold">
              <CuteIcon name={l.icon} size={28} />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tiny dancing equalizer for "listening together". */
function Bars() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-[3px] rounded-full bg-[#1ED760]" style={{ height: "100%", animation: `eq-bounce .9s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}

function Ico({ n }: { n: Parameters<typeof CuteIcon>[0]["name"] }) {
  return <CuteIcon name={n} size={20} className="-my-1 inline-block shrink-0 align-middle" />;
}

function MiniRing({ done, total }: { done: number; total: number }) {
  const C = 2 * Math.PI * 8;
  const r = total ? done / total : 0;
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={10} cy={10} r={8} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={3} />
      <circle cx={10} cy={10} r={8} fill="none" stroke="#9EE6C4" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${C * r} ${C}`} />
    </svg>
  );
}

function NextReminder({
  next,
  msToNext,
  canEdit,
  onChanged,
}: {
  next: NonNullable<IslandState["next"]>;
  msToNext: number;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (action: "done" | "snooze", minutes?: number) => {
    setBusy(true);
    try {
      const r = await fetch("/api/reminders/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: next.id, action, minutes }),
      });
      setMsg(r.ok ? (action === "done" ? "Done! ✨" : `Okay, again in ${minutes} min ⏰`) : "Hmm, try again?");
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-[22px] bg-sun p-2.5 text-ink">
      <div className="flex items-center gap-2">
        <CuteIcon name="bell" size={34} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[15px] font-extrabold">{next.title}</span>
          <span className="text-xs font-bold text-ink-soft">
            {clock(next.at)}, {msToNext <= 0 ? "now!" : `in ${countdown(msToNext)}`}
            {next.repeat !== "none" ? `, ${next.repeat}` : ""}
          </span>
        </div>
      </div>
      {canEdit && (
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" disabled={busy} onClick={() => act("done")} className="h-10 rounded-xl border-2 border-ink bg-mint text-sm font-extrabold disabled:opacity-50">
            ✓ Done
          </button>
          <button type="button" disabled={busy} onClick={() => act("snooze", 10)} className="h-10 rounded-xl border-2 border-ink bg-white text-sm font-extrabold disabled:opacity-50">
            +10 min
          </button>
          <button type="button" disabled={busy} onClick={() => act("snooze", 60)} className="h-10 rounded-xl border-2 border-ink bg-white text-sm font-extrabold disabled:opacity-50">
            +1 hour
          </button>
        </div>
      )}
      {msg && <span className="text-center text-xs font-extrabold">{msg}</span>}
    </div>
  );
}

function IslandTask({ id, title, canEdit }: { id: string; title: string; canEdit: boolean }) {
  const [done, setDone] = useState(false);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      disabled={!canEdit || done}
      onClick={() =>
        start(async () => {
          setDone(true);
          await toggleTask(id);
        })
      }
      className="flex min-h-10 items-center gap-2.5 rounded-xl px-1.5 text-left text-sm font-extrabold disabled:cursor-default"
    >
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-[2.5px] border-ink ${done ? "bg-mint" : "bg-white"}`}>
        {done && <Icon name="check" size={13} stroke={3.4} />}
      </span>
      <span className={`truncate ${done ? "line-through opacity-50" : ""}`}>{title}</span>
    </button>
  );
}

/** "Tell Chichi..." one-liner: add reminders, tasks, shopping in plain words. */
function QuickTell({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ text: string; actions: string[] } | null>(null);
  const send = async () => {
    const m = text.trim();
    if (!m || busy) return;
    setBusy(true);
    setReply(null);
    const live = { text: "", actions: [] as string[] };
    try {
      const d = await askChichi(m, null, {
        onDelta: (t) => {
          live.text += t;
          setReply({ ...live, actions: [...live.actions] });
        },
        onAction: (a) => {
          live.actions.push(a);
          setReply({ ...live, actions: [...live.actions] });
        },
      });
      setReply({ text: d.text, actions: d.actions });
      setText("");
      onDone();
    } catch (e) {
      setReply({ text: (e as Error).message || "Couldn't reach Chichi. Try again?", actions: [] });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-3 pr-1"
      >
        <label htmlFor="island-tell" className="sr-only-safe">
          Tell Chichi
        </label>
        <input
          id="island-tell"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={busy ? "Chichi is thinking" : "Tell Chichi: “remind me at 9 to call mama”"}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm font-bold text-cream outline-none placeholder:text-cream/50"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send to Chichi" className="flex size-9 items-center justify-center rounded-full bg-sun text-ink disabled:opacity-40">
          <Icon name="send" size={16} stroke={2.6} />
        </button>
      </form>
      {reply && (
        <div className="pop-in flex flex-col gap-1 rounded-2xl bg-white/10 px-3 py-2 text-[13px] font-bold">
          {reply.actions.map((a, i) => (
            <span key={i} className="text-mint">
              ✓ {a}
            </span>
          ))}
          <span className="line-clamp-4 whitespace-pre-line">{reply.text}</span>
          {reply.text.length > 220 && (
            <Link href="/ask" className="self-start text-[12px] font-extrabold text-sun underline">
              Read the full answer in Ask Chichi
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
