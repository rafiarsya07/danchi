import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysISO, monthRange, todayISO } from "@/lib/format";

const S = schema;

/* ---------------- Usage: how fast she uses things ---------------- */

/** Uses per day over the last 60 days, and when it will probably run out. */
export async function usageFor(spaceId: string, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, { usedPerWeek: number; daysLeft: number | null; runsOutOn: string | null; used60: number }>();
  const since = new Date(Date.now() - 60 * 86_400_000);
  const rows = await db
    .select({ itemId: S.itemUse.itemId, used: sql<number>`coalesce(sum(case when ${S.itemUse.delta} < 0 then -${S.itemUse.delta} else 0 end), 0)::int`, first: sql<Date>`min(${S.itemUse.at})` })
    .from(S.itemUse)
    .where(and(eq(S.itemUse.ownerId, spaceId), inArray(S.itemUse.itemId, itemIds), gte(S.itemUse.at, since)))
    .groupBy(S.itemUse.itemId);
  const items = await db.select({ id: S.item.id, quantity: S.item.quantity }).from(S.item).where(inArray(S.item.id, itemIds));
  const qty = new Map(items.map((i) => [i.id, i.quantity]));
  const out = new Map<string, { usedPerWeek: number; daysLeft: number | null; runsOutOn: string | null; used60: number }>();
  for (const r of rows) {
    const spanDays = Math.max(7, Math.min(60, (Date.now() - new Date(r.first).getTime()) / 86_400_000));
    const perDay = r.used / spanDays;
    const q = qty.get(r.itemId) ?? 0;
    const daysLeft = perDay > 0 ? Math.floor(q / perDay) : null;
    out.set(r.itemId, {
      used60: r.used,
      usedPerWeek: Math.round(perDay * 7 * 10) / 10,
      daysLeft,
      runsOutOn: daysLeft != null ? addDaysISO(todayISO(), daysLeft) : null,
    });
  }
  return out;
}

/** Things that will probably run out within a week, based on how fast she uses them. */
export async function getRestockSoon(spaceId: string) {
  const items = await db.select().from(S.item).where(eq(S.item.ownerId, spaceId));
  const use = await usageFor(spaceId, items.map((i) => i.id));
  return items
    .map((i) => ({ ...i, u: use.get(i.id) }))
    .filter((i) => i.u?.daysLeft != null && i.u.daysLeft <= 7 && i.quantity > 0)
    .sort((a, b) => (a.u!.daysLeft ?? 0) - (b.u!.daysLeft ?? 0))
    .slice(0, 6);
}

export async function getItem(spaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [it] = await db.select().from(S.item).where(and(eq(S.item.id, id), eq(S.item.ownerId, spaceId))).limit(1);
  if (!it) return null;
  const [history, use, prices] = await Promise.all([
    db.select().from(S.itemUse).where(eq(S.itemUse.itemId, id)).orderBy(desc(S.itemUse.at)).limit(15),
    usageFor(spaceId, [id]),
    db
      .select()
      .from(S.priceLog)
      .where(and(eq(S.priceLog.ownerId, spaceId), eq(S.priceLog.name, it.name.trim().toLowerCase())))
      .orderBy(desc(S.priceLog.on))
      .limit(10),
  ]);
  return { item: it, history, usage: use.get(id) ?? null, prices };
}

/* ---------------- Shopping: history, prices, budget ---------------- */

export async function getShopHistory(spaceId: string) {
  return db
    .select()
    .from(S.shoppingItem)
    .where(and(eq(S.shoppingItem.ownerId, spaceId), eq(S.shoppingItem.done, true)))
    .orderBy(desc(sql`coalesce(${S.shoppingItem.boughtAt}, ${S.shoppingItem.createdAt})`))
    .limit(80);
}

/** Price comparison: per product, the cheapest store and the latest price. */
export async function getPrices(spaceId: string) {
  const rows = await db.select().from(S.priceLog).where(eq(S.priceLog.ownerId, spaceId)).orderBy(desc(S.priceLog.on)).limit(400);
  const byName = new Map<string, typeof rows>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  return [...byName.entries()]
    .map(([name, list]) => {
      const stores = new Map<string, number>();
      for (const r of list) {
        const k = r.store || "Somewhere";
        stores.set(k, Math.min(stores.get(k) ?? Infinity, r.priceCents));
      }
      const sorted = [...stores.entries()].sort((a, b) => a[1] - b[1]);
      return { name, latest: list[0], cheapest: { store: sorted[0][0], cents: sorted[0][1] }, stores: sorted, times: list.length };
    })
    .sort((a, b) => b.times - a.times);
}

export async function getShopMonth(spaceId: string) {
  const { start, end } = monthRange();
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${S.transaction.amountCents}), 0)::int` })
    .from(S.transaction)
    .where(and(eq(S.transaction.ownerId, spaceId), eq(S.transaction.category, "shop"), eq(S.transaction.kind, "expense"), gte(S.transaction.occurredOn, start), lt(S.transaction.occurredOn, end)));
  return r?.n ?? 0;
}

/* ---------------- Savings goals ---------------- */

export async function getSavings(spaceId: string) {
  return db.select().from(S.savingsGoal).where(eq(S.savingsGoal.ownerId, spaceId)).orderBy(asc(S.savingsGoal.createdAt));
}

/* ---------------- Learning ---------------- */

export async function getLearning(spaceId: string) {
  const today = todayISO();
  const weekStart = addDaysISO(today, -6);
  const [items, logs] = await Promise.all([
    db.select().from(S.learning).where(eq(S.learning.ownerId, spaceId)).orderBy(asc(S.learning.status), desc(S.learning.updatedAt)),
    db.select().from(S.learningLog).where(and(eq(S.learningLog.ownerId, spaceId), gte(S.learningLog.day, addDaysISO(today, -27)))).orderBy(desc(S.learningLog.createdAt)),
  ]);
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)).map((d) => ({ d, minutes: logs.filter((l) => l.day === d).reduce((n, l) => n + l.minutes, 0) }));
  return { items, logs, week, weekMinutes: week.reduce((n, d) => n + d.minutes, 0) };
}

export async function getLearningItem(spaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [it] = await db.select().from(S.learning).where(and(eq(S.learning.id, id), eq(S.learning.ownerId, spaceId))).limit(1);
  return it ?? null;
}

/* ---------------- Study: one course ---------------- */

export async function getCourse(spaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db.select().from(S.course).where(and(eq(S.course.id, id), eq(S.course.ownerId, spaceId))).limit(1);
  if (!c) return null;
  const [asg, exams, decks, notes] = await Promise.all([
    db.select().from(S.assignment).where(eq(S.assignment.courseId, id)).orderBy(asc(S.assignment.dueAt)),
    db.select().from(S.exam).where(eq(S.exam.courseId, id)).orderBy(asc(S.exam.at)),
    db
      .select({ id: S.deck.id, name: S.deck.name, kind: S.deck.kind, year: S.deck.year, cards: sql<number>`(select count(*)::int from card where card.deck_id = ${S.deck.id})` })
      .from(S.deck)
      .where(eq(S.deck.courseId, id))
      .orderBy(asc(S.deck.kind), asc(S.deck.name)),
    db.select().from(S.note).where(eq(S.note.courseId, id)).orderBy(desc(S.note.updatedAt)).limit(30),
  ]);
  const doneA = asg.filter((a) => a.status === "done").length;
  const doneC = c.checklist.filter((x) => x.done).length;
  const total = asg.length + c.checklist.length;
  return { course: c, asg, exams, decks, notes, progress: total ? Math.round(((doneA + doneC) / total) * 100) : 0 };
}

/* ---------------- Food consumption: what she used this week ---------------- */

export async function getUsedThisWeek(spaceId: string, category = "food") {
  const since = new Date(Date.now() - 7 * 86_400_000);
  return db
    .select({ id: S.item.id, name: S.item.name, used: sql<number>`sum(-${S.itemUse.delta})::int` })
    .from(S.itemUse)
    .innerJoin(S.item, eq(S.item.id, S.itemUse.itemId))
    .where(and(eq(S.itemUse.ownerId, spaceId), eq(S.item.category, category), lt(S.itemUse.delta, 0), gte(S.itemUse.at, since)))
    .groupBy(S.item.id, S.item.name)
    .orderBy(desc(sql`sum(-${S.itemUse.delta})`))
    .limit(12);
}
