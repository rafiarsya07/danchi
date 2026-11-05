export const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur";

/** Today's date as YYYY-MM-DD in the app's timezone. */
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from today until the given YYYY-MM-DD (negative when past). */
export function daysUntil(iso: string): number {
  const a = Date.parse(todayISO() + "T00:00:00Z");
  const b = Date.parse(iso + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function monthRange(iso = todayISO()): { start: string; end: string; label: string } {
  const [y, m] = iso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const label = new Date(start + "T00:00:00Z").toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return { start, end: next, label };
}

export function money(cents: number, currency = "RM"): string {
  const v = cents / 100;
  const s = v.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${s}`;
}

export function prettyDay(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function greeting(now = new Date()): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(now),
  );
  if (h < 5) return "Hey night owl";
  if (h < 11) return "Good morning";
  if (h < 15) return "Hi";
  if (h < 19) return "Good afternoon";
  return "Good evening";
}

export function headerDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
}

/** "today", "tomorrow", "yesterday", or "Fri 6 Nov" (for use inside a sentence) */
export function dayPhrase(iso: string): string {
  const p = prettyDay(iso);
  return ["Today", "Tomorrow", "Yesterday"].includes(p) ? p.toLowerCase() : p;
}
