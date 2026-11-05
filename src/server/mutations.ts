/**
 * Writes that both the app (Server Actions) and Chichi the AI can make.
 * Callers are responsible for checking the user is the owner.
 */
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { addDaysISO, money, todayISO } from "../lib/format";
import { zonedToUtc, prettyTime, prettyWhen, type Repeat } from "../lib/time";
import { notify } from "./notify";

export async function createReminder(
  db: Db,
  spaceId: string,
  r: { title: string; date: string; time: string; repeat?: Repeat; note?: string | null; taskId?: string | null },
) {
  const remindAt = zonedToUtc(r.date, r.time);
  const [row] = await db
    .insert(schema.reminder)
    .values({
      ownerId: spaceId,
      title: r.title,
      note: r.note || null,
      remindAt,
      repeat: r.repeat ?? "none",
      taskId: r.taskId ?? null,
    })
    .returning();
  return row;
}

export async function createTask(
  db: Db,
  spaceId: string,
  t: { title: string; dueOn?: string | null; priority?: "low" | "normal" | "high"; remindTime?: string | null },
) {
  const [row] = await db
    .insert(schema.task)
    .values({ ownerId: spaceId, title: t.title, dueOn: t.dueOn ?? null, priority: t.priority ?? "normal" })
    .returning();
  let reminderAt: Date | null = null;
  if (t.remindTime) {
    const r = await createReminder(db, spaceId, {
      title: t.title,
      date: t.dueOn || todayISO(),
      time: t.remindTime,
      taskId: row.id,
    });
    reminderAt = r.remindAt;
  }
  return { task: row, reminderAt };
}

export async function addShopping(db: Db, spaceId: string, s: { name: string; priority?: "urgent" | "need" | "maybe" }) {
  const [row] = await db
    .insert(schema.shoppingItem)
    .values({ ownerId: spaceId, name: s.name, priority: s.priority ?? "need" })
    .returning();
  return row;
}

export async function logMoney(
  db: Db,
  spaceId: string,
  t: { amount: number; category: string; note?: string | null; kind?: "expense" | "income"; on?: string },
) {
  const [row] = await db
    .insert(schema.transaction)
    .values({
      ownerId: spaceId,
      kind: t.kind ?? "expense",
      amountCents: Math.round(t.amount * 100),
      category: t.category,
      note: t.note || null,
      occurredOn: t.on ?? todayISO(),
    })
    .returning();
  return row;
}

/** Put an item on the shopping list (once) and let her know it's running low. */
export async function ensureOnList(db: Db, spaceId: string, itemId: string, name: string, priority: "urgent" | "need") {
  const [existing] = await db
    .select({ id: schema.shoppingItem.id })
    .from(schema.shoppingItem)
    .where(and(eq(schema.shoppingItem.ownerId, spaceId), eq(schema.shoppingItem.itemId, itemId), eq(schema.shoppingItem.done, false)))
    .limit(1);
  if (existing) {
    if (priority === "urgent") await db.update(schema.shoppingItem).set({ priority }).where(eq(schema.shoppingItem.id, existing.id));
    return false;
  }
  await db.insert(schema.shoppingItem).values({ ownerId: spaceId, itemId, name, priority });
  await notify(db, {
    ownerId: spaceId,
    kind: "low",
    title: priority === "urgent" ? `${name} ran out!` : `${name} is running low`,
    body: "Chichi put it on your shopping list 🛍️",
    url: "/shop",
  });
  return true;
}

export { prettyWhen };

/* ---------------- Automatic reminders for other modules ---------------- */

type AutoRef = { assignmentId?: string; examId?: string; billId?: string; habitId?: string; paperId?: string; debtId?: string };

/**
 * Replace the pending automatic reminders of one assignment / exam / bill / habit.
 * Past times are skipped. Repeat is only used by habits.
 */
export async function syncAutoReminders(
  db: Db,
  spaceId: string,
  ref: AutoRef,
  items: { title: string; at: Date; note?: string | null; repeat?: Repeat }[],
) {
  const r = schema.reminder;
  const col = ref.assignmentId
    ? r.assignmentId
    : ref.examId
      ? r.examId
      : ref.billId
        ? r.billId
        : ref.paperId
          ? r.paperId
          : ref.debtId
            ? r.debtId
            : r.habitId;
  const id = ref.assignmentId ?? ref.examId ?? ref.billId ?? ref.paperId ?? ref.debtId ?? ref.habitId!;
  await db.delete(r).where(and(eq(col, id), eq(r.done, false), eq(r.ownerId, spaceId)));
  const now = new Date();
  const rows = items
    .filter((i) => i.at > now)
    .map((i) => ({ ownerId: spaceId, title: i.title, note: i.note ?? null, remindAt: i.at, repeat: i.repeat ?? "none", ...ref }));
  if (rows.length) await db.insert(r).values(rows);
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86_400_000);
}

/** Reminders for an assignment: the evening before, and the morning it's due. */
export async function assignmentReminders(db: Db, spaceId: string, a: { id: string; title: string; dueAt: Date | null; done: boolean }) {
  if (!a.dueAt || a.done) return syncAutoReminders(db, spaceId, { assignmentId: a.id }, []);
  const dueDay = todayISO(a.dueAt);
  const eve = zonedToUtc(todayISO(addDays(a.dueAt, -1)), "20:00");
  const morning = zonedToUtc(dueDay, "09:00");
  return syncAutoReminders(db, spaceId, { assignmentId: a.id }, [
    { title: `📚 ${a.title} is due tomorrow`, at: eve, note: `Due ${prettyWhen(a.dueAt)}. You got this!` },
    ...(morning < a.dueAt ? [{ title: `📚 ${a.title} is due today`, at: morning, note: `Due ${prettyWhen(a.dueAt)}` }] : []),
  ]);
}

/** Reminders for an exam: 3 days before, the night before, and 2 hours before. */
export async function examReminders(db: Db, spaceId: string, e: { id: string; title: string; at: Date; room: string | null }) {
  const where = e.room ? ` in ${e.room}` : "";
  return syncAutoReminders(db, spaceId, { examId: e.id }, [
    { title: `📖 Exam in 3 days: ${e.title}`, at: zonedToUtc(todayISO(addDays(e.at, -3)), "09:00"), note: "Little by little, start revising today 🌱" },
    { title: `📖 Exam tomorrow: ${e.title}`, at: zonedToUtc(todayISO(addDays(e.at, -1)), "20:00"), note: `${prettyWhen(e.at)}${where}. Sleep early tonight 🌙` },
    { title: `📖 ${e.title} in 2 hours`, at: new Date(e.at.getTime() - 2 * 3600_000), note: `${prettyTime(e.at)}${where}. Bring your stuff, you're ready 💪` },
  ]);
}

/** One reminder a few days before a bill is due. */
export async function billReminders(
  db: Db,
  spaceId: string,
  b: { id: string; name: string; amountCents: number; nextDue: string; remindDaysBefore: number; active: boolean },
  currency = "RM",
) {
  if (!b.active) return syncAutoReminders(db, spaceId, { billId: b.id }, []);
  const day = addDaysISO(b.nextDue, -Math.max(0, b.remindDaysBefore));
  return syncAutoReminders(db, spaceId, { billId: b.id }, [
    {
      title: `💸 ${b.name} ${money(b.amountCents, currency)} due ${b.remindDaysBefore === 0 ? "today" : b.remindDaysBefore === 1 ? "tomorrow" : `in ${b.remindDaysBefore} days`}`,
      at: zonedToUtc(day, "09:00"),
      note: "Tap Pay in Bills when it's done ✨",
    },
  ]);
}

/** Daily habit nudge (skipped automatically on days she already did it). */
export async function habitReminder(db: Db, spaceId: string, h: { id: string; name: string; emoji: string; remindTime: string | null; archived: boolean }) {
  if (!h.remindTime || h.archived) return syncAutoReminders(db, spaceId, { habitId: h.id }, []);
  let at = zonedToUtc(todayISO(), h.remindTime);
  if (at <= new Date()) at = zonedToUtc(addDaysISO(todayISO(), 1), h.remindTime);
  return syncAutoReminders(db, spaceId, { habitId: h.id }, [{ title: `${h.emoji} ${h.name}`, at, repeat: "daily", note: "Little habit time 🌱" }]);
}

/** Documents: 60 and 14 days before expiry. Applications: a week and a day before the deadline. */
export async function paperReminders(
  db: Db,
  spaceId: string,
  p: { id: string; kind: string; title: string; expiresOn: string | null; deadlineOn: string | null; status: string },
) {
  const items: { title: string; at: Date; note?: string }[] = [];
  if (p.kind === "document" && p.expiresOn) {
    items.push(
      { title: `🗂️ ${p.title} expires in 2 months`, at: zonedToUtc(addDaysISO(p.expiresOn, -60), "09:00"), note: "Renewals can take a while. Maybe start the paperwork soon?" },
      { title: `🗂️ ${p.title} expires in 2 weeks`, at: zonedToUtc(addDaysISO(p.expiresOn, -14), "09:00"), note: `Expires ${p.expiresOn}. Don't forget to renew 💛` },
    );
  }
  const closed = ["submitted", "interview", "offer", "rejected"].includes(p.status);
  if (p.kind === "application" && p.deadlineOn && !closed) {
    items.push(
      { title: `✍️ ${p.title} closes in a week`, at: zonedToUtc(addDaysISO(p.deadlineOn, -7), "09:00"), note: "Check the checklist in Papers. You can do this!" },
      { title: `✍️ ${p.title} closes tomorrow`, at: zonedToUtc(addDaysISO(p.deadlineOn, -1), "09:00"), note: "Last push! Submit today if you can 🍀" },
    );
  }
  return syncAutoReminders(db, spaceId, { paperId: p.id }, items);
}

/** A nudge on the day a debt is due. */
export async function debtReminders(
  db: Db,
  spaceId: string,
  d: { id: string; person: string; direction: string; amountCents: number; dueOn: string | null; settled: boolean },
  currency = "RM",
) {
  if (!d.dueOn || d.settled) return syncAutoReminders(db, spaceId, { debtId: d.id }, []);
  const amt = money(d.amountCents, currency);
  return syncAutoReminders(db, spaceId, { debtId: d.id }, [
    {
      title: d.direction === "i_owe" ? `🤝 Pay ${d.person} back ${amt} today` : `🤝 ${d.person} owes you ${amt}`,
      at: zonedToUtc(d.dueOn, "10:00"),
      note: d.direction === "i_owe" ? "Mark it settled in Money when it's done." : "A gentle reminder to them is okay 😊",
    },
  ]);
}

export function nextDueDate(day: string, cycle: string): string | null {
  if (cycle === "once") return null;
  if (cycle === "weekly") return addDaysISO(day, 7);
  const [y, m, d] = day.split("-").map(Number);
  const months = cycle === "yearly" ? 12 : 1;
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Simple spaced repetition (SM-2 flavoured). grade: 0 again, 1 hard, 2 good, 3 easy */
export function scheduleCard(c: { intervalDays: number; ease: number; reps: number }, grade: 0 | 1 | 2 | 3) {
  let { intervalDays, ease, reps } = c;
  if (grade === 0) {
    reps = 0;
    intervalDays = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (grade === 1) {
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
    ease = Math.max(1.3, ease - 0.15);
  } else if (grade === 2) {
    intervalDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(intervalDays * ease);
    reps += 1;
  } else {
    intervalDays = reps === 0 ? 3 : Math.round(Math.max(1, intervalDays) * ease * 1.3);
    ease += 0.15;
    reps += 1;
  }
  return { intervalDays, ease: Math.round(ease * 100) / 100, reps, dueOn: addDaysISO(todayISO(), intervalDays) };
}

/** Which recipe ingredients she already has (food in Stuff with quantity > 0). */
export function matchIngredients(ingredients: string, have: string[]) {
  const pantry = have.map((h) => h.toLowerCase());
  const lines = ingredients
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const words = (l: string) =>
    l
      .toLowerCase()
      .replace(/[0-9/.,()]+/g, " ")
      .replace(/\b(g|kg|ml|l|tbsp|tsp|cup|cups|pcs|piece|pieces|of|a|an|the|some|to|taste)\b/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  return lines.map((line) => {
    const ws = words(line);
    const hit = pantry.some((p) => ws.some((w) => p.includes(w) || w.includes(p)));
    return { line, have: hit };
  });
}
