import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysISO, todayISO } from "@/lib/format";
import { localDateISO, zonedToUtc } from "@/lib/time";
import { matchIngredients } from "@/server/mutations";

const S = schema;

export type Course = typeof S.course.$inferSelect;
export type Assignment = typeof S.assignment.$inferSelect;
export type Exam = typeof S.exam.$inferSelect;
export type Habit = typeof S.habit.$inferSelect;
export type Note = typeof S.note.$inferSelect;
export type Recipe = typeof S.recipe.$inferSelect;
export type Bill = typeof S.bill.$inferSelect;
export type Project = typeof S.project.$inferSelect;
export type Wish = typeof S.wish.$inferSelect;

/* ---------------- Study ---------------- */

export async function getCourses(spaceId: string, includeArchived = false) {
  const where = includeArchived ? eq(S.course.ownerId, spaceId) : and(eq(S.course.ownerId, spaceId), eq(S.course.archived, false));
  return db.select().from(S.course).where(where).orderBy(asc(S.course.name));
}

export async function getAssignments(spaceId: string) {
  const rows = await db
    .select()
    .from(S.assignment)
    .where(eq(S.assignment.ownerId, spaceId))
    .orderBy(sql`${S.assignment.dueAt} asc nulls last`, asc(S.assignment.createdAt))
    .limit(200);
  return { open: rows.filter((a) => a.status !== "done"), done: rows.filter((a) => a.status === "done").slice(-20).reverse() };
}

export async function getExams(spaceId: string) {
  const since = new Date(Date.now() - 6 * 3600_000);
  const upcoming = await db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), gte(S.exam.at, since))).orderBy(asc(S.exam.at));
  const past = await db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), lt(S.exam.at, since))).orderBy(desc(S.exam.at)).limit(10);
  return { upcoming, past };
}

export async function getDecks(spaceId: string) {
  const today = todayISO();
  const decks = await db.select().from(S.deck).where(eq(S.deck.ownerId, spaceId)).orderBy(asc(S.deck.name));
  if (!decks.length) return [];
  const stats = await db
    .select({
      deckId: S.card.deckId,
      total: count(),
      due: sql<number>`count(*) filter (where ${S.card.dueOn} <= ${today})::int`,
    })
    .from(S.card)
    .where(inArray(S.card.deckId, decks.map((d) => d.id)))
    .groupBy(S.card.deckId);
  return decks.map((d) => {
    const s = stats.find((x) => x.deckId === d.id);
    return { ...d, total: s?.total ?? 0, due: s?.due ?? 0 };
  });
}

export async function getDeck(spaceId: string, id: string) {
  const [d] = await db.select().from(S.deck).where(and(eq(S.deck.id, id), eq(S.deck.ownerId, spaceId))).limit(1);
  if (!d) return null;
  const cards = await db.select().from(S.card).where(eq(S.card.deckId, id)).orderBy(asc(S.card.dueOn), asc(S.card.createdAt));
  const today = todayISO();
  return { deck: d, cards, due: cards.filter((c) => c.dueOn <= today) };
}

/* ---------------- Habits ---------------- */

/** Monday of the week containing `day` */
export function weekStart(day = todayISO()) {
  const d = new Date(day + "T00:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return addDaysISO(day, -wd);
}

export async function getHabits(spaceId: string) {
  const today = todayISO();
  const habits = await db.select().from(S.habit).where(eq(S.habit.ownerId, spaceId)).orderBy(asc(S.habit.archived), asc(S.habit.createdAt));
  const from = addDaysISO(today, -120);
  const logs = habits.length
    ? await db
        .select()
        .from(S.habitLog)
        .where(and(inArray(S.habitLog.habitId, habits.map((h) => h.id)), gte(S.habitLog.day, from)))
    : [];
  const start = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  return habits.map((h) => {
    const days = new Set(logs.filter((l) => l.habitId === h.id).map((l) => l.day));
    let streak = 0;
    let cursor = days.has(today) ? today : addDaysISO(today, -1);
    while (days.has(cursor)) {
      streak++;
      cursor = addDaysISO(cursor, -1);
    }
    const thisWeek = week.filter((d) => days.has(d)).length;
    const last28 = Array.from({ length: 28 }, (_, i) => addDaysISO(today, i - 27)).map((d) => ({ d, on: days.has(d) }));
    return { ...h, doneToday: days.has(today), streak, week: week.map((d) => ({ d, on: days.has(d), future: d > today })), thisWeek, last28 };
  });
}

/* ---------------- Notes ---------------- */

export async function getNotes(spaceId: string, kind: "note" | "journal", q?: string, hidePrivate = false) {
  const term = q ? `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%` : null;
  return db
    .select()
    .from(S.note)
    .where(
      and(
        eq(S.note.ownerId, spaceId),
        eq(S.note.kind, kind),
        hidePrivate ? eq(S.note.private, false) : undefined,
        term ? sql`(${S.note.title} ilike ${term} or ${S.note.body} ilike ${term} or coalesce(${S.note.tags}, '') ilike ${term})` : undefined,
      ),
    )
    .orderBy(desc(S.note.pinned), desc(S.note.updatedAt))
    .limit(200);
}

export async function getNote(spaceId: string, id: string) {
  const [n] = await db.select().from(S.note).where(and(eq(S.note.id, id), eq(S.note.ownerId, spaceId))).limit(1);
  return n ?? null;
}

/* ---------------- Kitchen ---------------- */

export async function getPantry(spaceId: string) {
  return db
    .select({ name: S.item.name, expiresOn: S.item.expiresOn, quantity: S.item.quantity })
    .from(S.item)
    .where(and(eq(S.item.ownerId, spaceId), eq(S.item.category, "food"), sql`${S.item.quantity} > 0`));
}

export async function getRecipes(spaceId: string) {
  const [recipes, pantry] = await Promise.all([
    db.select().from(S.recipe).where(eq(S.recipe.ownerId, spaceId)).orderBy(desc(S.recipe.favorite), asc(S.recipe.title)),
    getPantry(spaceId),
  ]);
  const names = pantry.map((p) => p.name);
  return recipes
    .map((r) => {
      const m = matchIngredients(r.ingredients, names);
      const have = m.filter((x) => x.have).length;
      return { ...r, have, need: m.length, missing: m.filter((x) => !x.have).map((x) => x.line), score: m.length ? have / m.length : 0 };
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.score - a.score);
}

export async function getRecipe(spaceId: string, id: string) {
  const [r] = await db.select().from(S.recipe).where(and(eq(S.recipe.id, id), eq(S.recipe.ownerId, spaceId))).limit(1);
  if (!r) return null;
  const pantry = await getPantry(spaceId);
  return { recipe: r, lines: matchIngredients(r.ingredients, pantry.map((p) => p.name)) };
}

export async function getMealWeek(spaceId: string, start = weekStart()) {
  const end = addDaysISO(start, 6);
  const rows = await db
    .select()
    .from(S.mealPlan)
    .where(and(eq(S.mealPlan.ownerId, spaceId), gte(S.mealPlan.day, start), lte(S.mealPlan.day, end)));
  return { start, days: Array.from({ length: 7 }, (_, i) => addDaysISO(start, i)), rows };
}

/* ---------------- Bills ---------------- */

export async function getBills(spaceId: string) {
  const rows = await db.select().from(S.bill).where(eq(S.bill.ownerId, spaceId)).orderBy(desc(S.bill.active), asc(S.bill.nextDue));
  const monthly = rows
    .filter((b) => b.active && b.cycle !== "once")
    .reduce((s, b) => s + (b.cycle === "yearly" ? b.amountCents / 12 : b.cycle === "weekly" ? (b.amountCents * 52) / 12 : b.amountCents), 0);
  return { rows, monthly: Math.round(monthly) };
}

/* ---------------- Projects ---------------- */

export async function getProjects(spaceId: string) {
  const projects = await db.select().from(S.project).where(eq(S.project.ownerId, spaceId)).orderBy(asc(S.project.status), desc(S.project.createdAt));
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const [tasks, spent] = await Promise.all([
    db
      .select({ projectId: S.task.projectId, total: count(), done: sql<number>`count(*) filter (where ${S.task.done})::int` })
      .from(S.task)
      .where(inArray(S.task.projectId, ids))
      .groupBy(S.task.projectId),
    db
      .select({ projectId: S.transaction.projectId, cents: sql<number>`sum(${S.transaction.amountCents})::int` })
      .from(S.transaction)
      .where(inArray(S.transaction.projectId, ids))
      .groupBy(S.transaction.projectId),
  ]);
  return projects.map((p) => {
    const t = tasks.find((x) => x.projectId === p.id);
    return { ...p, total: t?.total ?? 0, done: t?.done ?? 0, spent: spent.find((x) => x.projectId === p.id)?.cents ?? 0 };
  });
}

export async function getProject(spaceId: string, id: string) {
  const [p] = await db.select().from(S.project).where(and(eq(S.project.id, id), eq(S.project.ownerId, spaceId))).limit(1);
  if (!p) return null;
  const [tasks, notes, tx] = await Promise.all([
    db.select().from(S.task).where(eq(S.task.projectId, id)).orderBy(asc(S.task.done), sql`${S.task.dueOn} asc nulls last`),
    db.select().from(S.note).where(eq(S.note.projectId, id)).orderBy(desc(S.note.updatedAt)),
    db.select().from(S.transaction).where(eq(S.transaction.projectId, id)).orderBy(desc(S.transaction.occurredOn)),
  ]);
  return { project: p, tasks, notes, tx, spent: tx.reduce((s, t) => s + t.amountCents, 0) };
}

/* ---------------- Wishlist ---------------- */

export async function getWishes(spaceId: string) {
  const rows = await db
    .select()
    .from(S.wish)
    .where(eq(S.wish.ownerId, spaceId))
    .orderBy(asc(S.wish.got), sql`case ${S.wish.priority} when 'need' then 0 when 'want' then 1 else 2 end`, desc(S.wish.createdAt));
  return { open: rows.filter((w) => !w.got), got: rows.filter((w) => w.got) };
}

/* ---------------- Calendar: everything with a date ---------------- */

export type CalItem = {
  id: string;
  day: string;
  time?: string;
  title: string;
  kind: "task" | "reminder" | "assignment" | "exam" | "bill" | "meal" | "project" | "paper" | "debt";
  href: string;
  done?: boolean;
};

const timeOf = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit" });

export async function getCalendar(spaceId: string, from: string, to: string, hidden: Set<string> = new Set()): Promise<CalItem[]> {
  const fromAt = zonedToUtc(from, "00:00");
  const toAt = zonedToUtc(addDaysISO(to, 1), "00:00");
  const [tasks, rems, asg, exams, bills, meals, projects, papers, debts] = await Promise.all([
    db.select().from(S.task).where(and(eq(S.task.ownerId, spaceId), gte(S.task.dueOn, from), lte(S.task.dueOn, to))),
    db
      .select()
      .from(S.reminder)
      .where(
        and(
          eq(S.reminder.ownerId, spaceId),
          gte(S.reminder.remindAt, fromAt),
          lt(S.reminder.remindAt, toAt),
          sql`${S.reminder.assignmentId} is null and ${S.reminder.examId} is null and ${S.reminder.billId} is null and ${S.reminder.habitId} is null and ${S.reminder.taskId} is null`,
        ),
      ),
    db.select().from(S.assignment).where(and(eq(S.assignment.ownerId, spaceId), gte(S.assignment.dueAt, fromAt), lt(S.assignment.dueAt, toAt))),
    db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), gte(S.exam.at, fromAt), lt(S.exam.at, toAt))),
    db.select().from(S.bill).where(and(eq(S.bill.ownerId, spaceId), eq(S.bill.active, true), gte(S.bill.nextDue, from), lte(S.bill.nextDue, to))),
    db.select().from(S.mealPlan).where(and(eq(S.mealPlan.ownerId, spaceId), gte(S.mealPlan.day, from), lte(S.mealPlan.day, to))),
    db.select().from(S.project).where(and(eq(S.project.ownerId, spaceId), isNotNull(S.project.dueOn), gte(S.project.dueOn, from), lte(S.project.dueOn, to))),
    db
      .select()
      .from(S.paper)
      .where(
        and(
          eq(S.paper.ownerId, spaceId),
          sql`((${S.paper.expiresOn} between ${from} and ${to}) or (${S.paper.deadlineOn} between ${from} and ${to}))`,
        ),
      ),
    db.select().from(S.debt).where(and(eq(S.debt.ownerId, spaceId), eq(S.debt.settled, false), gte(S.debt.dueOn, from), lte(S.debt.dueOn, to))),
  ]);
  const items: CalItem[] = [
    ...exams.map((e) => ({ id: e.id, day: localDateISO(e.at), time: timeOf(e.at), title: e.title, kind: "exam" as const, href: "/study?tab=exams" })),
    ...asg.map((a) => ({ id: a.id, day: localDateISO(a.dueAt!), time: timeOf(a.dueAt!), title: a.title, kind: "assignment" as const, href: "/study", done: a.status === "done" })),
    ...bills.map((b) => ({ id: b.id, day: b.nextDue, title: b.name, kind: "bill" as const, href: "/bills" })),
    ...tasks.map((t) => ({ id: t.id, day: t.dueOn!, title: t.title, kind: "task" as const, href: t.projectId ? `/projects/${t.projectId}` : "/tasks", done: t.done })),
    ...rems.map((r) => ({ id: r.id, day: localDateISO(r.remindAt), time: timeOf(r.remindAt), title: r.title, kind: "reminder" as const, href: "/reminders", done: r.done })),
    ...projects.map((p) => ({ id: p.id, day: p.dueOn!, title: `${p.emoji} ${p.name} due`, kind: "project" as const, href: `/projects/${p.id}` })),
    ...meals.map((m) => ({ id: m.id, day: m.day, title: m.text ?? "", kind: "meal" as const, href: "/kitchen?tab=plan", time: m.slot })),
    ...papers.map((p) => ({
      id: p.id,
      day: (p.kind === "document" ? p.expiresOn : p.deadlineOn)!,
      title: p.kind === "document" ? `${p.title} expires` : `${p.title} deadline`,
      kind: "paper" as const,
      href: `/papers/${p.id}`,
    })),
    ...debts.map((d) => ({ id: d.id, day: d.dueOn!, title: d.direction === "i_owe" ? `Pay ${d.person} back` : `${d.person} pays you back`, kind: "debt" as const, href: "/money#debts" })),
  ];
  const section: Record<CalItem["kind"], string> = {
    exam: "study",
    assignment: "study",
    bill: "money",
    debt: "money",
    project: "projects",
    task: "tasks",
    reminder: "tasks",
    meal: "kitchen",
    paper: "papers",
  };
  const order = { exam: 0, assignment: 1, paper: 2, bill: 3, debt: 4, project: 5, task: 6, reminder: 7, meal: 8 };
  return items
    .filter((i) => !hidden.has(section[i.kind]))
    .sort((a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind]);
}

/** Small "school + money" summary for Home. */
export async function getHomeExtras(spaceId: string) {
  const today = todayISO();
  const soon = zonedToUtc(addDaysISO(today, 4), "00:00");
  const [asg, exams, bills, habits, meals] = await Promise.all([
    db
      .select()
      .from(S.assignment)
      .where(and(eq(S.assignment.ownerId, spaceId), sql`${S.assignment.status} <> 'done'`, isNotNull(S.assignment.dueAt), lt(S.assignment.dueAt, soon)))
      .orderBy(asc(S.assignment.dueAt))
      .limit(4),
    db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), gte(S.exam.at, new Date()))).orderBy(asc(S.exam.at)).limit(1),
    db
      .select()
      .from(S.bill)
      .where(and(eq(S.bill.ownerId, spaceId), eq(S.bill.active, true), lte(S.bill.nextDue, addDaysISO(today, 5))))
      .orderBy(asc(S.bill.nextDue))
      .limit(4),
    getHabits(spaceId),
    db.select().from(S.mealPlan).where(and(eq(S.mealPlan.ownerId, spaceId), eq(S.mealPlan.day, today))),
  ]);
  return { assignments: asg, nextExam: exams[0] ?? null, bills, habits: habits.filter((h) => !h.archived), meals };
}
