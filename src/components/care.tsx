"use client";

import { CuteIcon } from "@/components/cute-icon";
import { useEffect, useState, useTransition } from "react";
import { addFifteen, askForHug, checkIn, imSafe, reactLove, setMood, startSafeTimer, stopTimer } from "@/app/(app)/care-actions";
import { Mascot } from "@/components/mascot";
import { MOODS } from "@/lib/mood";

/* ---------------- location (only when she taps, only if she allows) ---------------- */

const LOC_KEY = "danchi-share-location";
function readLocPref() {
  try {
    return localStorage.getItem(LOC_KEY) !== "off";
  } catch {
    return true;
  }
}
function writeLocPref(on: boolean) {
  try {
    localStorage.setItem(LOC_KEY, on ? "on" : "off");
  } catch {}
}

function getPosition(timeout = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });
}

function useLocPref() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(readLocPref());
  }, []);
  return [on, (v: boolean) => (writeLocPref(v), setOn(v))] as const;
}

/* ---------------- check in buttons ---------------- */

export function SafetyButtons({ partner = "Rafi", compact = false }: { partner?: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [loc, setLoc] = useLocPref();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  function send(kind: "safe" | "omw" | "help") {
    if (kind === "help" && !armed) return setArmed(true);
    setArmed(false);
    setMsg(null);
    start(async () => {
      const pos = loc && kind !== "safe" ? await getPosition() : null;
      const r = await checkIn(kind, undefined, pos?.lat, pos?.lng);
      setMsg(
        r.ok
          ? kind === "help"
            ? `${partner} got your 🆘${pos ? " with your location" : ""}. If you're in danger, call 999 too.`
            : kind === "omw"
              ? `${partner} knows you're on your way 🚶`
              : `${partner} knows you're home 💛`
          : (r.error ?? "Didn't send. Try again?"),
      );
    });
  }

  const btn = "sticker press flex flex-col items-center justify-center gap-0.5 rounded-[22px] px-2 font-extrabold disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2.5">
        <button type="button" disabled={pending} onClick={() => send("safe")} className={`${btn} ${compact ? "h-[76px]" : "h-24"} bg-mint`}>
          <CuteIcon name="home" size={compact ? 38 : 44} />
          <span className="text-[13px]">Home safe</span>
        </button>
        <button type="button" disabled={pending} onClick={() => send("omw")} className={`${btn} ${compact ? "h-[76px]" : "h-24"} bg-sky`}>
          <CuteIcon name="walk" size={compact ? 38 : 44} />
          <span className="text-[13px]">On my way</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => send("help")}
          aria-label={armed ? "Tap again to send Need you" : "Need you"}
          className={`${btn} ${compact ? "h-[76px]" : "h-24"} ${armed ? "bg-coral text-white" : "bg-pink"}`}
        >
          <CuteIcon name="sos" size={compact ? 38 : 44} className={armed ? "animate-pulse" : ""} />
          <span className="text-[13px] leading-tight">{armed ? "Tap again" : "Need you"}</span>
        </button>
      </div>
      <label className="flex items-center gap-2 text-[13px] font-extrabold text-ink-soft">
        <input type="checkbox" checked={loc} onChange={(e) => setLoc(e.target.checked)} className="size-[18px] accent-[#2EB67D]" />
        📍 Add my location to &quot;On my way&quot; and &quot;Need you&quot;
      </label>
      {pending && <p className="text-sm font-extrabold">Sending to {partner}...</p>}
      {msg && (
        <p role="status" className="pop-in rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
          {msg}
        </p>
      )}
    </div>
  );
}

/* ---------------- safe arrival timer ---------------- */

function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function ActiveTimer({ dueAt, message, alerted, readOnly, partner = "Rafi" }: { dueAt: string; message: string | null; alerted: boolean; readOnly?: boolean; partner?: string }) {
  const now = useNow();
  const left = new Date(dueAt).getTime() - now;
  const [pending, start] = useTransition();
  const late = left <= 0;
  return (
    <div className={`sticker flex flex-col gap-3 rounded-[26px] p-4 ${alerted ? "bg-coral text-white" : late ? "bg-sun" : "bg-mint"}`}>
      <div className="flex items-center gap-3">
        <CuteIcon name="compass" size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-extrabold opacity-80">{readOnly ? "Her safe arrival timer" : "Safe arrival timer"}</span>
          <span suppressHydrationWarning className="font-display text-[34px] font-bold leading-none tabular-nums">{late ? "Time's up" : mmss(left)}</span>
          {message && <span className="truncate text-sm font-extrabold">{message}</span>}
        </div>
      </div>
      {alerted && <p className="text-sm font-extrabold">{readOnly ? "She hasn't checked in yet. Maybe call her?" : `${partner} was told you haven't checked in. Tap I'm safe!`}</p>}
      {!readOnly && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <button type="button" disabled={pending} onClick={() => start(() => imSafe())} className="sticker-sm press h-12 rounded-2xl bg-white text-[17px] font-extrabold text-ink">
            ✓ I&apos;m safe
          </button>
          <button type="button" disabled={pending} onClick={() => start(() => addFifteen())} className="sticker-sm press h-12 rounded-2xl bg-white px-3 text-sm font-extrabold text-ink">
            +15
          </button>
          <button type="button" disabled={pending} onClick={() => start(() => stopTimer())} className="h-12 rounded-2xl border-2 border-ink bg-white/70 px-3 text-sm font-extrabold text-ink">
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

export function TimerForm({ partner = "Rafi" }: { partner?: string }) {
  const [mode, setMode] = useState<"in" | "at">("in");
  const [minutes, setMinutes] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [loc] = useLocPref();

  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("mode", mode);
        fd.set("minutes", String(minutes));
        setErr(null);
        start(async () => {
          const pos = loc ? await getPosition(4000) : null;
          if (pos) {
            fd.set("lat", String(pos.lat));
            fd.set("lng", String(pos.lng));
          }
          const r = await startSafeTimer({ ok: false }, fd);
          if (!r.ok) setErr(r.error ?? "Didn't start");
        });
      }}
    >
      <p className="text-sm font-bold">
        Going somewhere? Start a timer. If you don&apos;t tap <b>I&apos;m safe</b> in time, Chichi asks you first, then tells {partner} 10 minutes later.
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label="Timer type">
        {(["in", "at"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-full border-2 border-ink px-4 text-sm font-extrabold ${mode === m ? "bg-sun" : "bg-white"}`}
          >
            {m === "in" ? "In a while" : "By a time"}
          </button>
        ))}
      </div>
      {mode === "in" ? (
        <div className="flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMinutes(m)}
              aria-pressed={minutes === m}
              className={`h-11 min-w-14 rounded-2xl border-2 border-ink px-3 text-sm font-extrabold ${minutes === m ? "bg-mint shadow-[0_3px_0_#2E2240]" : "bg-white"}`}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>
      ) : (
        <input type="time" name="at" required className="field max-w-40" aria-label="Arrive by" />
      )}
      <input name="message" maxLength={120} placeholder="Where to? (Grab home from campus...)" className="field" />
      {err && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-pink-soft px-3 py-1.5 text-sm font-extrabold">
          {err}
        </p>
      )}
      <button type="submit" disabled={pending} className="sticker-sm press font-display h-12 self-start rounded-2xl bg-mint px-5 text-lg font-bold disabled:opacity-60">
        {pending ? "Starting" : "Start timer 🧭"}
      </button>
    </form>
  );
}

/* ---------------- mood ---------------- */


const REPLIES: Record<number, string> = {
  1: "I'm sorry today is heavy. You don't have to fix it all. One small kind thing for yourself is enough 💛",
  2: "Meh days happen. Water, a snack and a little rest can help more than you think 🌷",
  3: "Okay is okay! Steady and calm 🌼",
  4: "Yay, a good day! Keep that glow going ✨",
  5: "Lovely! Chichi is doing a happy dance for you 💃",
};

export function MoodPicker({ current, partner = "Rafi", shared }: { current: number | null; partner?: string; shared: boolean }) {
  const [pending, start] = useTransition();
  const [mood, setLocal] = useState<number | null>(current);
  const [hug, setHug] = useState<"idle" | "sent">("idle");
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="How are you feeling?">
        {MOODS.map((m) => (
          <button
            key={m.v}
            type="button"
            role="radio"
            aria-checked={mood === m.v}
            disabled={pending}
            onClick={() => {
              setLocal(m.v);
              start(() => setMood(m.v));
            }}
            className={`flex h-[66px] flex-col items-center justify-center rounded-2xl border-2 border-ink leading-none transition ${
              mood === m.v ? "-translate-y-0.5 bg-sun shadow-[0_3px_0_#2E2240]" : "bg-white"
            }`}
          >
            <CuteIcon name={m.icon} size={mood === m.v ? 38 : 34} />
            <span className="mt-1 text-[10px] font-extrabold">{m.t}</span>
          </button>
        ))}
      </div>
      {mood && <p className="pop-in text-sm font-bold">{REPLIES[mood]}</p>}
      {mood && mood <= 2 && (
        <button
          type="button"
          disabled={hug === "sent"}
          onClick={async () => {
            await askForHug();
            setHug("sent");
          }}
          className="sticker-sm press h-11 self-start rounded-2xl bg-pink px-4 text-sm font-extrabold disabled:opacity-70"
        >
          {hug === "sent" ? `${partner} is on it 🫂` : `🫂 Ask ${partner} for a hug`}
        </button>
      )}
      {shared && <p className="text-[11px] font-bold text-ink-soft">{partner} can see today&apos;s face (not your notes). Change it in Settings, Privacy.</p>}
    </div>
  );
}

/* ---------------- love note reactions ---------------- */

export function LoveReact({ id, current }: { id: string; current: string | null }) {
  const [pending, start] = useTransition();
  const [r, setR] = useState(current);
  return (
    <div className="flex gap-1.5">
      {["❤️", "🥹", "😂", "🫶"].map((e) => (
        <button
          key={e}
          type="button"
          disabled={pending}
          aria-pressed={r === e}
          aria-label={`React ${e}`}
          onClick={() => {
            setR(e);
            start(() => reactLove(id, e));
          }}
          className={`flex size-10 items-center justify-center rounded-xl border-2 border-ink text-lg ${r === e ? "bg-sun shadow-[0_2px_0_#2E2240]" : "bg-white"}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function ChichiSays({ children, mood = "love" as const }: { children: React.ReactNode; mood?: "love" | "happy" | "think" | "worried" }) {
  return (
    <div className="flex items-center gap-1">
      <Mascot mood={mood} size={64} animate={false} />
      <p className="rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-bold">{children}</p>
    </div>
  );
}
