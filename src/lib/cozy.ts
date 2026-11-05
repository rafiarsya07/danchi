import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysISO, todayISO } from "@/lib/format";

const S = schema;

/** Next time a countdown happens (yearly ones roll over to next year). */
export function nextDay(day: string, yearly: boolean, today = todayISO()) {
  if (!yearly || day >= today) return day;
  const [, m, d] = day.split("-");
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-${m}-${d}`;
  return thisYear >= today ? thisYear : `${y + 1}-${m}-${d}`;
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);

export async function getCountdowns(spaceId: string) {
  const today = todayISO();
  const rows = await db.select().from(S.countdown).where(eq(S.countdown.ownerId, spaceId));
  return rows
    .map((r) => {
      const on = nextDay(r.day, r.yearly, today);
      return { ...r, on, days: daysBetween(today, on) };
    })
    .filter((r) => r.days >= 0 || r.yearly)
    .sort((a, b) => a.days - b.days);
}

export async function getJar(spaceId: string) {
  return db.select().from(S.jarNote).where(eq(S.jarNote.ownerId, spaceId)).orderBy(desc(S.jarNote.createdAt)).limit(300);
}

export async function getFocus(spaceId: string) {
  const today = todayISO();
  const weekAgo = addDaysISO(today, -6);
  const rows = await db
    .select({ day: S.focusSession.day, minutes: sql<number>`sum(${S.focusSession.minutes})::int` })
    .from(S.focusSession)
    .where(and(eq(S.focusSession.ownerId, spaceId), gte(S.focusSession.day, weekAgo)))
    .groupBy(S.focusSession.day);
  const by = new Map(rows.map((r) => [r.day, r.minutes]));
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(weekAgo, i)).map((d) => ({ d, minutes: by.get(d) ?? 0 }));
  const recent = await db.select().from(S.focusSession).where(eq(S.focusSession.ownerId, spaceId)).orderBy(desc(S.focusSession.createdAt)).limit(8);
  return { today: by.get(today) ?? 0, week, weekTotal: week.reduce((a, w) => a + w.minutes, 0), recent };
}
