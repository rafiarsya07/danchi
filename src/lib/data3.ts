import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysISO, todayISO } from "@/lib/format";
import { cycleStats } from "@/lib/cycle";
import { zonedToUtc } from "@/lib/time";

const S = schema;

export type Paper = typeof S.paper.$inferSelect;
export type FileRow = typeof S.file.$inferSelect;
export type Debt = typeof S.debt.$inferSelect;
export type Checkin = typeof S.checkin.$inferSelect;
export type LoveNote = typeof S.loveNote.$inferSelect;

/* ---------------- Papers ---------------- */

export async function getPapers(spaceId: string) {
  const rows = await db.select().from(S.paper).where(eq(S.paper.ownerId, spaceId)).orderBy(asc(S.paper.title));
  const docs = rows
    .filter((r) => r.kind === "document")
    .sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
  const apps = rows
    .filter((r) => r.kind === "application")
    .sort((a, b) => (a.deadlineOn ?? "9999").localeCompare(b.deadlineOn ?? "9999"));
  const counts = await fileCounts(spaceId, "paper", rows.map((r) => r.id));
  return { docs, apps, counts };
}

export async function getPaper(spaceId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await db.select().from(S.paper).where(and(eq(S.paper.id, id), eq(S.paper.ownerId, spaceId))).limit(1);
  return p ?? null;
}

/** Documents expiring within 60 days and applications closing within 14. */
export async function getPaperAttention(spaceId: string) {
  const today = todayISO();
  return db
    .select()
    .from(S.paper)
    .where(
      and(
        eq(S.paper.ownerId, spaceId),
        or(
          and(eq(S.paper.kind, "document"), isNotNull(S.paper.expiresOn), lte(S.paper.expiresOn, addDaysISO(today, 60))),
          and(
            eq(S.paper.kind, "application"),
            isNotNull(S.paper.deadlineOn),
            gte(S.paper.deadlineOn, today),
            lte(S.paper.deadlineOn, addDaysISO(today, 14)),
            inArray(S.paper.status, ["idea", "preparing"]),
          ),
        ),
      ),
    )
    .orderBy(asc(sql`coalesce(${S.paper.expiresOn}, ${S.paper.deadlineOn})`))
    .limit(4);
}

/* ---------------- Files ---------------- */

export async function getFiles(spaceId: string, refType: string, refId: string) {
  return db
    .select()
    .from(S.file)
    .where(and(eq(S.file.ownerId, spaceId), eq(S.file.refType, refType), eq(S.file.refId, refId)))
    .orderBy(desc(S.file.createdAt));
}

async function fileCounts(spaceId: string, refType: string, ids: string[]) {
  if (!ids.length) return {} as Record<string, number>;
  const rows = await db
    .select({ refId: S.file.refId, n: sql<number>`count(*)::int` })
    .from(S.file)
    .where(and(eq(S.file.ownerId, spaceId), eq(S.file.refType, refType), inArray(S.file.refId, ids)))
    .groupBy(S.file.refId);
  return Object.fromEntries(rows.map((r) => [r.refId, r.n])) as Record<string, number>;
}

/* ---------------- Debts & money trend ---------------- */

export async function getDebts(spaceId: string) {
  const rows = await db
    .select()
    .from(S.debt)
    .where(eq(S.debt.ownerId, spaceId))
    .orderBy(asc(S.debt.settled), asc(sql`coalesce(${S.debt.dueOn}, '9999-12-31')`), desc(S.debt.createdAt))
    .limit(60);
  const open = rows.filter((r) => !r.settled);
  return {
    open,
    settled: rows.filter((r) => r.settled).slice(0, 10),
    owedToMe: open.filter((r) => r.direction === "owes_me").reduce((n, r) => n + r.amountCents, 0),
    iOwe: open.filter((r) => r.direction === "i_owe").reduce((n, r) => n + r.amountCents, 0),
  };
}

/** Spent and earned for the last 6 months, oldest first. */
export async function getMoneyTrend(spaceId: string) {
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const t = y * 12 + (m - 1) - (5 - i);
    const yy = Math.floor(t / 12);
    const mm = (t % 12) + 1;
    return `${yy}-${String(mm).padStart(2, "0")}`;
  });
  const rows = await db
    .select({
      ym: sql<string>`to_char(${S.transaction.occurredOn}, 'YYYY-MM')`,
      kind: S.transaction.kind,
      total: sql<number>`sum(${S.transaction.amountCents})::int`,
    })
    .from(S.transaction)
    .where(and(eq(S.transaction.ownerId, spaceId), gte(S.transaction.occurredOn, `${months[0]}-01`)))
    .groupBy(sql`1`, S.transaction.kind);
  return months.map((ym) => ({
    ym,
    label: new Date(`${ym}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
    spent: rows.find((r) => r.ym === ym && r.kind === "expense")?.total ?? 0,
    earned: rows.find((r) => r.ym === ym && r.kind === "income")?.total ?? 0,
  }));
}

/* ---------------- Safety ---------------- */

export async function getSafety(spaceId: string) {
  const rows = await db.select().from(S.checkin).where(eq(S.checkin.ownerId, spaceId)).orderBy(desc(S.checkin.createdAt)).limit(15);
  const timer = rows.find((r) => r.kind === "timer" && (r.status === "active" || r.status === "alerted")) ?? null;
  const last = rows.find((r) => r.kind !== "timer" || r.status === "safe") ?? null;
  return { timer, last, history: rows };
}

/* ---------------- Love notes ---------------- */

/** The two way love thread: oldest first, with paps and reply quotes. */
export async function getLoveThread(spaceId: string, limit = 80) {
  const rows = (await db.select().from(S.loveNote).where(eq(S.loveNote.ownerId, spaceId)).orderBy(desc(S.loveNote.createdAt)).limit(limit)).reverse();
  const ids = rows.map((r) => r.id);
  const files = ids.length
    ? await db
        .select({ id: S.file.id, refId: S.file.refId })
        .from(S.file)
        .where(and(eq(S.file.refType, "love"), inArray(S.file.refId, ids)))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((r) => {
    const q = r.replyToId ? byId.get(r.replyToId) : null;
    return {
      ...r,
      photos: files.filter((f) => f.refId === r.id).map((f) => f.id),
      reply: q ? { text: q.kind === "pap" ? "📸 a pap" : q.text.slice(0, 80), fromUserId: q.fromUserId } : r.replyToId ? { text: "an older note", fromUserId: "" } : null,
    };
  });
}

export async function getLoveNotes(spaceId: string, limit = 50) {
  return db.select().from(S.loveNote).where(eq(S.loveNote.ownerId, spaceId)).orderBy(desc(S.loveNote.createdAt)).limit(limit);
}

/* ---------------- Mood ---------------- */

export async function getMoods(spaceId: string, days = 14) {
  const today = todayISO();
  const from = addDaysISO(today, -(days - 1));
  const rows = await db
    .select()
    .from(S.moodLog)
    .where(and(eq(S.moodLog.ownerId, spaceId), gte(S.moodLog.day, from)))
    .orderBy(asc(S.moodLog.day));
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const strip = Array.from({ length: days }, (_, i) => addDaysISO(from, i)).map((d) => ({ d, mood: byDay.get(d)?.mood ?? null }));
  const low = rows.slice(-3).filter((r) => r.mood <= 2).length;
  return { today: byDay.get(today) ?? null, strip, lowStreak: low };
}

/* ---------------- Cycle ---------------- */

export async function getCycle(spaceId: string) {
  const logs = await db.select().from(S.cycleLog).where(eq(S.cycleLog.ownerId, spaceId)).orderBy(desc(S.cycleLog.startOn)).limit(24);
  return { logs, stats: cycleStats(logs) };
}

/* ---------------- Privacy & devices ---------------- */

export async function getVisits(spaceId: string, limit = 25) {
  return db
    .select({ id: S.visitLog.id, path: S.visitLog.path, at: S.visitLog.at, name: S.user.name })
    .from(S.visitLog)
    .innerJoin(S.user, eq(S.user.id, S.visitLog.userId))
    .where(eq(S.visitLog.ownerId, spaceId))
    .orderBy(desc(S.visitLog.at))
    .limit(limit);
}

export async function getSessions(userId: string) {
  return db
    .select()
    .from(S.session)
    .where(and(eq(S.session.userId, userId), gte(S.session.expiresAt, new Date())))
    .orderBy(desc(S.session.updatedAt));
}

/* ---------------- Home: the caring bits ---------------- */

export async function getCareHome(spaceId: string) {
  const [safety, love, moods, cycle, papers] = await Promise.all([
    getSafety(spaceId),
    db
      .select()
      .from(S.loveNote)
      .where(and(eq(S.loveNote.ownerId, spaceId), gte(S.loveNote.createdAt, new Date(Date.now() - 14 * 86_400_000))))
      .orderBy(desc(S.loveNote.createdAt))
      .limit(8),
    getMoods(spaceId, 7),
    getCycle(spaceId),
    getPaperAttention(spaceId),
  ]);
  return { ...safety, love, moods, cycle: cycle.logs.length ? cycle.stats : null, papers };
}

/* ---------------- Daily check: her evening wrap up ---------------- */

export async function getDailyCheck(spaceId: string) {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const tomorrowStart = zonedToUtc(tomorrow, "00:00");
  const dayAfter = zonedToUtc(addDaysISO(today, 2), "00:00");
  const [mood, check, openTasks, doneToday, txToday, journalToday, habits, tmTasks, tmRems, tmAsg, tmExams, recentChecks] = await Promise.all([
    db.select().from(S.moodLog).where(and(eq(S.moodLog.ownerId, spaceId), eq(S.moodLog.day, today))).limit(1),
    db.select().from(S.dailyCheck).where(and(eq(S.dailyCheck.ownerId, spaceId), eq(S.dailyCheck.day, today))).limit(1),
    db
      .select()
      .from(S.task)
      .where(and(eq(S.task.ownerId, spaceId), eq(S.task.done, false), lte(S.task.dueOn, today)))
      .orderBy(asc(S.task.dueOn))
      .limit(20),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(S.task)
      .where(and(eq(S.task.ownerId, spaceId), eq(S.task.done, true), gte(S.task.doneAt, zonedToUtc(today, "00:00")))),
    db.select().from(S.transaction).where(and(eq(S.transaction.ownerId, spaceId), eq(S.transaction.occurredOn, today))).orderBy(desc(S.transaction.createdAt)),
    db
      .select({ id: S.note.id })
      .from(S.note)
      .where(and(eq(S.note.ownerId, spaceId), eq(S.note.kind, "journal"), gte(S.note.createdAt, zonedToUtc(today, "00:00"))))
      .limit(1),
    getHabitsLite(spaceId, today),
    db.select().from(S.task).where(and(eq(S.task.ownerId, spaceId), eq(S.task.done, false), eq(S.task.dueOn, tomorrow))).limit(10),
    db
      .select()
      .from(S.reminder)
      .where(and(eq(S.reminder.ownerId, spaceId), eq(S.reminder.done, false), gte(S.reminder.remindAt, tomorrowStart), lt(S.reminder.remindAt, dayAfter)))
      .orderBy(asc(S.reminder.remindAt))
      .limit(10),
    db
      .select()
      .from(S.assignment)
      .where(and(eq(S.assignment.ownerId, spaceId), sql`${S.assignment.status} <> 'done'`, gte(S.assignment.dueAt, tomorrowStart), lt(S.assignment.dueAt, dayAfter))),
    db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), gte(S.exam.at, tomorrowStart), lt(S.exam.at, dayAfter))),
    db
      .select({ day: S.dailyCheck.day })
      .from(S.dailyCheck)
      .where(and(eq(S.dailyCheck.ownerId, spaceId), isNotNull(S.dailyCheck.doneAt), gte(S.dailyCheck.day, addDaysISO(today, -60))))
      .orderBy(desc(S.dailyCheck.day)),
  ]);

  // Streak: days in a row she wrapped up (today counts if done, otherwise from yesterday).
  const doneDays = new Set(recentChecks.map((r) => r.day));
  let streak = 0;
  for (let d = doneDays.has(today) ? today : addDaysISO(today, -1); doneDays.has(d); d = addDaysISO(d, -1)) streak++;

  const habitsLeft = habits.filter((h) => !h.doneToday).length;
  const steps = {
    mood: !!mood[0],
    tasks: openTasks.length === 0,
    habits: habits.length === 0 || habitsLeft === 0,
    money: txToday.length > 0 || !!check[0]?.noSpend,
    journal: journalToday.length > 0,
  };
  return {
    today,
    tomorrow,
    mood: mood[0] ?? null,
    doneAt: check[0]?.doneAt ?? null,
    noSpend: !!check[0]?.noSpend,
    openTasks,
    doneTodayCount: doneToday[0]?.n ?? 0,
    txToday,
    habits,
    tomorrowList: [
      ...tmExams.map((e) => ({ id: e.id, icon: "exam" as const, t: `Exam: ${e.title}`, href: "/study?tab=exams" })),
      ...tmAsg.map((a) => ({ id: a.id, icon: "study" as const, t: `Due: ${a.title}`, href: "/study" })),
      ...tmRems.map((r) => ({ id: r.id, icon: "bell" as const, t: r.title, href: "/reminders" })),
      ...tmTasks.map((t) => ({ id: t.id, icon: "tasks" as const, t: t.title, href: "/tasks" })),
    ],
    steps,
    stepsDone: Object.values(steps).filter(Boolean).length,
    streak,
  };
}

async function getHabitsLite(spaceId: string, today: string) {
  const habits = await db.select().from(S.habit).where(and(eq(S.habit.ownerId, spaceId), eq(S.habit.archived, false))).orderBy(asc(S.habit.createdAt));
  if (!habits.length) return [];
  const logs = await db
    .select({ habitId: S.habitLog.habitId })
    .from(S.habitLog)
    .where(and(eq(S.habitLog.ownerId, spaceId), eq(S.habitLog.day, today)));
  const done = new Set(logs.map((l) => l.habitId));
  return habits.map((h) => ({ id: h.id, name: h.name, emoji: h.emoji, doneToday: done.has(h.id) }));
}
