"use client";
/* Timers here advance their own state from effects on purpose (tick, then move to the next step). */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState, useTransition } from "react";
import { Mascot } from "@/components/mascot";
import { logFocus } from "@/app/(app)/cozy-actions";

/* ============================ Focus timer ============================ */

type Run = { endAt: number | null; leftMs: number; total: number; mode: "focus" | "break"; label: string; courseId: string };
const KEY = "danchi-focus";
const PRESETS = [
  { m: 25, t: "25 min" },
  { m: 45, t: "45 min" },
  { m: 15, t: "15 min" },
];

function load(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null") as Run | null;
    return r && typeof r.total === "number" ? r : null;
  } catch {
    return null;
  }
}
function save(r: Run | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {}
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.55);
    });
  } catch {}
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function FocusTimer({ courses, todayMinutes }: { courses: { id: string; name: string }[]; todayMinutes: number }) {
  const [run, setRun] = useState<Run | null>(null);
  const [mins, setMins] = useState(25);
  const [label, setLabel] = useState("");
  const [courseId, setCourseId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<string | null>(null);
  const [, start] = useTransition();
  const logged = useRef(false);

  useEffect(() => {
    setRun(load());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const left = run ? (run.endAt ? run.endAt - now : run.leftMs) : 0;

  useEffect(() => {
    if (!run?.endAt || left > 0) return;
    chime();
    if (run.mode === "focus" && !logged.current) {
      logged.current = true;
      const m = Math.round(run.total / 60000);
      start(async () => {
        await logFocus(m, run.label || null, run.courseId || null);
      });
      setDone(`${m} minutes of focus! Proud of you 🌼 Take 5 minutes to stretch and drink water.`);
      const b: Run = { endAt: Date.now() + 5 * 60000, leftMs: 5 * 60000, total: 5 * 60000, mode: "break", label: run.label, courseId: run.courseId };
      setRun(b);
      save(b);
    } else if (run.mode === "break") {
      setDone("Break's over. Ready for another round? 💪");
      setRun(null);
      save(null);
    }
  }, [left, run]);

  useEffect(() => {
    if (!run) return;
    const base = "Danchi";
    document.title = run.endAt ? `${mmss(left)} ${run.mode === "focus" ? "focus" : "break"}, ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [left, run]);

  function begin() {
    logged.current = false;
    setDone(null);
    const r: Run = { endAt: Date.now() + mins * 60000, leftMs: mins * 60000, total: mins * 60000, mode: "focus", label, courseId };
    setRun(r);
    save(r);
  }
  function pause() {
    if (!run) return;
    const r = run.endAt ? { ...run, endAt: null, leftMs: Math.max(0, run.endAt - Date.now()) } : { ...run, endAt: Date.now() + run.leftMs };
    setRun(r);
    save(r);
  }
  function stop() {
    if (run?.mode === "focus") {
      const spent = Math.round((run.total - (run.endAt ? run.endAt - Date.now() : run.leftMs)) / 60000);
      if (spent >= 5) start(async () => void (await logFocus(spent, run.label || null, run.courseId || null)));
    }
    setRun(null);
    save(null);
  }

  const pct = run ? 1 - Math.max(0, left) / run.total : 0;
  const R = 92;
  const circ = 2 * Math.PI * R;
  const breakMode = run?.mode === "break";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex size-[220px] items-center justify-center">
        <svg viewBox="0 0 220 220" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--color-ink)" strokeOpacity="0.12" strokeWidth="16" />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke={breakMode ? "#7BD3A8" : "#FF8A7A"}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            style={{ transition: "stroke-dashoffset .5s linear" }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <Mascot mood={run ? (breakMode ? "love" : "think") : "happy"} size={74} animate={!!run?.endAt} />
          <span className="font-display text-[40px] font-bold leading-none tabular-nums">{run ? mmss(left) : `${mins}:00`}</span>
          <span className="text-xs font-extrabold text-ink-soft">{run ? (breakMode ? "break time" : run.endAt ? "focusing" : "paused") : "ready"}</span>
        </div>
      </div>

      {!run ? (
        <>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.m}
                type="button"
                onClick={() => setMins(p.m)}
                className={`press rounded-full border-2 border-ink px-3.5 py-1.5 text-sm font-extrabold ${mins === p.m ? "bg-sun" : "bg-white"}`}
              >
                {p.t}
              </button>
            ))}
          </div>
          <div className="grid w-full max-w-sm grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="What are you working on?" aria-label="What are you working on" className="field" />
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course" className="field">
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={begin} className="sticker press rounded-[22px] bg-coral px-8 py-3 text-lg font-extrabold text-white">
            Start focus
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={pause} className="sticker-sm press rounded-2xl bg-sun px-5 py-2.5 font-extrabold">
            {run.endAt ? "Pause" : "Resume"}
          </button>
          <button type="button" onClick={stop} className="sticker-sm press rounded-2xl bg-white px-5 py-2.5 font-extrabold">
            {breakMode ? "Skip break" : "Stop"}
          </button>
        </div>
      )}
      {done && <p className="pop-in rounded-2xl border-2 border-ink bg-mint-soft px-3 py-2 text-center text-sm font-extrabold">{done}</p>}
      <p className="text-xs font-bold text-ink-soft">
        Today: {todayMinutes} min focused. Keep Danchi open; your phone buzzes when time&apos;s up.
      </p>
    </div>
  );
}

/* ============================ Breathe ============================ */

const STEPS = [
  { t: "Breathe in", s: 4, scale: 1 },
  { t: "Hold", s: 4, scale: 1 },
  { t: "Breathe out", s: 6, scale: 0.55 },
] as const;

export function Breathe() {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [sec, setSec] = useState<number>(STEPS[0].s);

  useEffect(() => {
    if (!on) return;
    if (sec <= 0) {
      const n = (i + 1) % STEPS.length;
      if (n === 0) setRounds((r) => r + 1);
      setI(n);
      setSec(STEPS[n].s);
      return;
    }
    const t = setTimeout(() => setSec((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [on, sec, i]);

  useEffect(() => {
    if (rounds >= 5) {
      setOn(false);
    }
  }, [rounds]);

  const step = STEPS[i];
  const scale = on ? step.scale : 0.7;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex size-[230px] items-center justify-center">
        <div
          className="absolute rounded-full bg-linear-to-br from-sky to-lilac opacity-70"
          style={{ width: 230, height: 230, transform: `scale(${scale})`, transition: `transform ${on ? step.s : 0.6}s ease-in-out` }}
          aria-hidden
        />
        <div
          className="absolute rounded-full bg-linear-to-br from-mint-soft to-sky-soft"
          style={{ width: 150, height: 150, transform: `scale(${on ? step.scale + 0.15 : 0.8})`, transition: `transform ${on ? step.s : 0.6}s ease-in-out` }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center">
          <Mascot mood="love" size={70} animate={false} />
          <span className="font-display text-2xl font-bold">{on ? step.t : rounds >= 5 ? "Well done 💛" : "Ready?"}</span>
          {on && <span className="text-sm font-extrabold">{sec}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setOn((x) => !x);
          setI(0);
          setSec(STEPS[0].s);
          setRounds(0);
        }}
        className="sticker press rounded-[22px] bg-sky px-8 py-3 text-lg font-extrabold"
      >
        {on ? "Stop" : "Breathe with Chichi (1 min)"}
      </button>
      <p className="max-w-sm text-center text-xs font-bold text-ink-soft">
        In for 4, hold for 4, out for 6. Five slow rounds calm your body down when you feel anxious, angry or can&apos;t sleep. {on ? `Round ${Math.min(rounds + 1, 5)} of 5` : ""}
      </p>
    </div>
  );
}

/* ============================ Happy jar ============================ */

export function JarShake({ notes }: { notes: { id: string; text: string; emoji: string; day: string; from: string }[] }) {
  const [pick, setPick] = useState<(typeof notes)[number] | null>(null);
  const [shaking, setShaking] = useState(false);
  const count = notes.length;
  const fill = Math.min(1, count / 60);
  function shake() {
    if (!count) return;
    setShaking(true);
    try {
      navigator.vibrate?.([30, 40, 30, 40, 30]);
    } catch {}
    setTimeout(() => {
      setShaking(false);
      setPick(notes[Math.floor(Math.random() * count)]);
    }, 650);
  }
  const stars = Array.from({ length: Math.min(count, 40) }, (_, i) => i);
  const colors = ["#FFD95A", "#FFA9C9", "#9EE6C4", "#9FD3FF", "#C9B6FF", "#FFB38A"];
  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={shake} aria-label="Shake the jar" className={`relative ${shaking ? "animate-[wiggle_.15s_ease-in-out_4]" : ""}`} style={{ width: 170, height: 210 }}>
        <svg viewBox="0 0 170 210" width="170" height="210" aria-hidden>
          <rect x="45" y="6" width="80" height="22" rx="7" fill="#FF9E7A" stroke="#2E2240" strokeWidth="4" />
          <path d="M40 28 h90 v12 c18 10 26 26 26 46 v94 a22 22 0 0 1 -22 22 H36 a22 22 0 0 1 -22 -22 V86 c0 -20 8 -36 26 -46 Z" fill="#DDF0FF" stroke="#2E2240" strokeWidth="4" />
          <clipPath id="jarclip">
            <path d="M18 88 c0 -18 8 -32 24 -42 h86 c16 10 24 24 24 42 v92 a18 18 0 0 1 -18 18 H36 a18 18 0 0 1 -18 -18 Z" />
          </clipPath>
          <g clipPath="url(#jarclip)">
            <rect x="0" y={200 - 150 * fill} width="170" height={150 * fill + 10} fill="#FFF1B8" opacity=".7" />
            {stars.map((i) => {
              const x = 30 + ((i * 37) % 110);
              const y = 190 - ((i * 13) % Math.max(20, 150 * fill + 10));
              return <text key={i} x={x} y={y} fontSize="16" fill={colors[i % colors.length]} stroke="#2E2240" strokeWidth=".8">★</text>;
            })}
          </g>
          <path d="M34 70 c-6 20 -6 60 -4 90" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity=".8" />
        </svg>
        <span className="absolute inset-x-0 bottom-3 text-center font-display text-2xl font-bold">{count}</span>
      </button>
      <p className="text-sm font-extrabold">{count ? "Tap the jar to shake out a happy memory" : "Your jar is empty. Add the first happy moment below 🌼"}</p>
      {pick && (
        <div className="pop-in sticker flex max-w-sm flex-col items-center gap-1 rounded-[24px] bg-sun-soft px-4 py-3 text-center">
          <span className="text-3xl">{pick.emoji}</span>
          <p className="font-display text-lg font-bold leading-snug">{pick.text}</p>
          <span className="text-xs font-extrabold text-ink-soft">
            {pick.day}
            {pick.from ? `, from ${pick.from}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
