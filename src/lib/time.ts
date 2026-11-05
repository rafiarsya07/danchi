/**
 * Wall clock helpers for the app's timezone (APP_TIMEZONE). No dependencies,
 * safe to import from the app, the worker and the AI tools.
 */
import { TIMEZONE, todayISO, addDaysISO } from "./format";

export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly", "yearly"];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** The local date/time parts of an instant in TIMEZONE. */
export function localParts(d: Date, tz = TIMEZONE): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "0";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: wd,
  };
}

/** Offset (ms) of TIMEZONE from UTC at a given instant. */
function offsetAt(d: Date, tz: string): number {
  const p = localParts(d, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(d.getTime() / 60000) * 60000;
}

/** "2026-11-03" + "15:30" in TIMEZONE -> the real instant. */
export function zonedToUtc(dateISO: string, time: string, tz = TIMEZONE): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const first = guess - offsetAt(new Date(guess), tz);
  // Second pass handles DST edges (Malaysia has none, but be correct anyway).
  return new Date(guess - offsetAt(new Date(first), tz));
}

/** Local "YYYY-MM-DD" of an instant. */
export function localDateISO(d: Date): string {
  return todayISO(d);
}

/** Local "HH:MM" of an instant. */
export function localTime(d: Date): string {
  const p = localParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** "3:30 PM" */
export function prettyTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "Today 3:30 PM", "Tomorrow 9:00 AM", "Fri 7 Nov, 9:00 AM" */
export function prettyWhen(d: Date): string {
  const day = localDateISO(d);
  const today = todayISO();
  if (day === today) return `Today ${prettyTime(d)}`;
  if (day === addDaysISO(today, 1)) return `Tomorrow ${prettyTime(d)}`;
  if (day === addDaysISO(today, -1)) return `Yesterday ${prettyTime(d)}`;
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(d);
  return `${date}, ${prettyTime(d)}`;
}

/** Next time a repeating reminder should fire, strictly after `after`. */
export function nextOccurrence(from: Date, repeat: Repeat, after = new Date()): Date | null {
  if (repeat === "none") return null;
  const time = localTime(from);
  let day = localDateISO(from);
  for (let i = 0; i < 1000; i++) {
    if (repeat === "daily") day = addDaysISO(day, 1);
    else if (repeat === "weekly") day = addDaysISO(day, 7);
    else if (repeat === "yearly") {
      const [y, m, d] = day.split("-").map(Number);
      const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
      day = `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
    } else {
      const [y, m, d] = day.split("-").map(Number);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
      day = `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
    }
    const next = zonedToUtc(day, time);
    if (next > after) return next;
  }
  return null;
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Once",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
};

/** Milliseconds from now until `d` (negative when past). */
export function msUntil(d: Date): number {
  return d.getTime() - Date.now();
}

/** Whole days from now until `d`, never below 0. */
export function daysUntilAt(d: Date): number {
  return Math.max(0, Math.ceil(msUntil(d) / 86_400_000));
}
