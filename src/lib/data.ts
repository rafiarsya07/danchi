import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDaysISO, monthRange, todayISO } from "@/lib/format";

const { task, item, shoppingItem, transaction, settings, reminder, notification } = schema;

export type Task = typeof task.$inferSelect;
export type Item = typeof item.$inferSelect;
export type ShopItem = typeof shoppingItem.$inferSelect;
export type Tx = typeof transaction.$inferSelect;
export type Reminder = typeof reminder.$inferSelect;
export type Notification = typeof notification.$inferSelect;

/* Settings */

export async function getSettings(spaceId: string) {
  const [row] = await db.select().from(settings).where(eq(settings.ownerId, spaceId)).limit(1);
  return (
    row ?? {
      ownerId: spaceId,
      monthlyBudgetCents: 120000,
      currency: "RM",
      emailDigest: true,
      emailReminders: true,
      digestHour: 8,
      nudgeHour: 20,
      lastDigestOn: null,
      lastNudgeOn: null,
      pinnedStatus: false,
      lastPinnedText: null,
      lastPinnedAt: null,
      hiddenSections: [] as string[],
      shareReminders: true,
      shareMood: true,
      cycleTellRafi: false,
      quietFrom: 23,
      quietTo: 7,
      lastCycleNoticeOn: null,
      emergency: null,
      homeHidden: [] as string[],
      shopBudgetCents: 0,
      updatedAt: new Date(),
    }
  );
}

/* Tasks */

/** Open tasks due today or earlier (or without a date), plus what was finished today. */
export async function getTodayTasks(spaceId: string) {
  const today = todayISO();
  return db
    .select()
    .from(task)
    .where(
      and(
        eq(task.ownerId, spaceId),
        or(
          and(eq(task.done, false), or(sql`${task.dueOn} is null`, lte(task.dueOn, today))),
          and(eq(task.done, true), gte(task.doneAt, sql`now() - interval '18 hours'`)),
        ),
      ),
    )
    .orderBy(asc(task.done), desc(task.priority), asc(task.createdAt))
    .limit(30);
}

export async function getTasks(spaceId: string) {
  const open = await db
    .select()
    .from(task)
    .where(and(eq(task.ownerId, spaceId), eq(task.done, false)))
    .orderBy(sql`${task.dueOn} asc nulls last`, desc(task.priority), asc(task.createdAt));
  const done = await db
    .select()
    .from(task)
    .where(and(eq(task.ownerId, spaceId), eq(task.done, true)))
    .orderBy(desc(task.doneAt))
    .limit(15);
  return { open, done };
}

export async function getUpcoming(spaceId: string, days = 7) {
  const today = todayISO();
  return db
    .select()
    .from(task)
    .where(
      and(
        eq(task.ownerId, spaceId),
        eq(task.done, false),
        isNotNull(task.dueOn),
        gte(task.dueOn, today),
        lte(task.dueOn, addDaysISO(today, days)),
      ),
    )
    .orderBy(asc(task.dueOn))
    .limit(8);
}

/* Inventory */

export async function getItems(spaceId: string, category?: string) {
  const where = category
    ? and(eq(item.ownerId, spaceId), eq(item.category, category))
    : eq(item.ownerId, spaceId);
  return db.select().from(item).where(where).orderBy(asc(item.name));
}

export async function getAttention(spaceId: string) {
  const soon = addDaysISO(todayISO(), 7);
  const expiring = await db
    .select()
    .from(item)
    .where(and(eq(item.ownerId, spaceId), isNotNull(item.expiresOn), lte(item.expiresOn, soon), sql`${item.quantity} > 0`))
    .orderBy(asc(item.expiresOn))
    .limit(10);
  const low = await db
    .select()
    .from(item)
    .where(and(eq(item.ownerId, spaceId), lte(item.quantity, item.lowAt)))
    .orderBy(asc(item.quantity))
    .limit(10);
  const [t] = await db.select({ n: count() }).from(item).where(eq(item.ownerId, spaceId));
  return { expiring, low, total: t?.n ?? 0 };
}

/* Shopping */

export async function getShopping(spaceId: string) {
  const open = await db
    .select()
    .from(shoppingItem)
    .where(and(eq(shoppingItem.ownerId, spaceId), eq(shoppingItem.done, false)))
    .orderBy(sql`case ${shoppingItem.priority} when 'urgent' then 0 when 'need' then 1 else 2 end`, asc(shoppingItem.createdAt));
  const done = await db
    .select()
    .from(shoppingItem)
    .where(and(eq(shoppingItem.ownerId, spaceId), eq(shoppingItem.done, true)))
    .orderBy(desc(shoppingItem.createdAt))
    .limit(10);
  return { open, done };
}

/* Money */

export async function getMonthMoney(spaceId: string) {
  const { start, end, label } = monthRange();
  const rows = await db
    .select()
    .from(transaction)
    .where(and(eq(transaction.ownerId, spaceId), gte(transaction.occurredOn, start), lt(transaction.occurredOn, end)))
    .orderBy(desc(transaction.occurredOn), desc(transaction.createdAt));
  const expenses = rows.filter((r) => r.kind === "expense");
  const spent = expenses.reduce((s, r) => s + r.amountCents, 0);
  const byCategory: Record<string, number> = {};
  for (const r of expenses) byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amountCents;
  return { rows, spent, byCategory, label };
}

/* Search across everything */

export async function searchAll(spaceId: string, q: string) {
  const term = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const S = schema;
  const [tasks, items, shop, money, reminders, notes, recipes, assignments, exams, wishes, projects, papers, debts, learning] = await Promise.all([
    db.select().from(task).where(and(eq(task.ownerId, spaceId), ilike(task.title, term))).limit(10),
    db
      .select()
      .from(item)
      .where(and(eq(item.ownerId, spaceId), or(ilike(item.name, term), ilike(item.location, term), ilike(item.brand, term), ilike(item.kind, term))))
      .limit(10),
    db.select().from(shoppingItem).where(and(eq(shoppingItem.ownerId, spaceId), ilike(shoppingItem.name, term))).limit(10),
    db
      .select()
      .from(transaction)
      .where(and(eq(transaction.ownerId, spaceId), or(ilike(transaction.note, term), ilike(transaction.category, term))))
      .orderBy(desc(transaction.occurredOn))
      .limit(10),
    db
      .select()
      .from(reminder)
      .where(and(eq(reminder.ownerId, spaceId), or(ilike(reminder.title, term), ilike(reminder.note, term))))
      .orderBy(desc(reminder.remindAt))
      .limit(10),
    db
      .select()
      .from(S.note)
      .where(and(eq(S.note.ownerId, spaceId), or(ilike(S.note.title, term), ilike(S.note.body, term), ilike(S.note.tags, term))))
      .orderBy(desc(S.note.updatedAt))
      .limit(10),
    db
      .select()
      .from(S.recipe)
      .where(and(eq(S.recipe.ownerId, spaceId), or(ilike(S.recipe.title, term), ilike(S.recipe.ingredients, term), ilike(S.recipe.tags, term))))
      .limit(10),
    db.select().from(S.assignment).where(and(eq(S.assignment.ownerId, spaceId), ilike(S.assignment.title, term))).limit(10),
    db.select().from(S.exam).where(and(eq(S.exam.ownerId, spaceId), ilike(S.exam.title, term))).limit(10),
    db.select().from(S.wish).where(and(eq(S.wish.ownerId, spaceId), or(ilike(S.wish.name, term), ilike(S.wish.note, term)))).limit(10),
    db.select().from(S.project).where(and(eq(S.project.ownerId, spaceId), or(ilike(S.project.name, term), ilike(S.project.description, term)))).limit(10),
    db
      .select()
      .from(S.paper)
      .where(and(eq(S.paper.ownerId, spaceId), or(ilike(S.paper.title, term), ilike(S.paper.org, term), ilike(S.paper.notes, term))))
      .limit(10),
    db.select().from(S.debt).where(and(eq(S.debt.ownerId, spaceId), or(ilike(S.debt.person, term), ilike(S.debt.note, term)))).limit(10),
    db.select().from(S.learning).where(and(eq(S.learning.ownerId, spaceId), or(ilike(S.learning.title, term), ilike(S.learning.notes, term)))).limit(10),
  ]);
  return { tasks, items, shop, money, reminders, notes, recipes, assignments, exams, wishes, projects, papers, debts, learning };
}

/* Reminders */

export async function getReminders(spaceId: string) {
  const upcoming = await db
    .select()
    .from(reminder)
    .where(and(eq(reminder.ownerId, spaceId), eq(reminder.done, false)))
    .orderBy(asc(reminder.remindAt))
    .limit(60);
  const past = await db
    .select()
    .from(reminder)
    .where(and(eq(reminder.ownerId, spaceId), eq(reminder.done, true)))
    .orderBy(desc(reminder.remindAt))
    .limit(15);
  return { upcoming, past };
}

/** Reminders still to come in the next `hours`. */
export async function getSoonReminders(spaceId: string, hours = 36) {
  return db
    .select()
    .from(reminder)
    .where(
      and(
        eq(reminder.ownerId, spaceId),
        eq(reminder.done, false),
        lte(reminder.remindAt, new Date(Date.now() + hours * 3600_000)),
      ),
    )
    .orderBy(asc(reminder.remindAt))
    .limit(6);
}

/* Inbox */

export async function getInbox(spaceId: string, limit = 40) {
  return db
    .select()
    .from(notification)
    .where(eq(notification.ownerId, spaceId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
}

export async function getUnreadCount(spaceId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(notification)
    .where(and(eq(notification.ownerId, spaceId), isNull(notification.readAt)));
  return r?.n ?? 0;
}

/* Chichi Island: the little live pill at the top of the screen */

export type IslandState = {
  next: { id: string; title: string; at: string; repeat: string } | null;
  todayOpen: number;
  todayDone: number;
  tasks: { id: string; title: string }[];
  expiring: number;
  low: number;
  /** newest message from the other one that isn't read yet */
  love: { from: string; text: string; count: number } | null;
  /** games waiting for my move */
  turns: { kind: string; label: string }[];
  /** SOS running right now (both see it) */
  sos: { token: string } | null;
  /** safe arrival timer running */
  timer: { dueAt: string } | null;
  /** an exam in the next 3 days */
  exam: { title: string; at: string } | null;
  /** the closest countdown, within a week */
  countdown: { title: string; emoji: string; days: number } | null;
  /** monthsary / anniversary / every 100 days, today */
  celebrate: string | null;
  /** listen together (Spotify) */
  music: {
    active: boolean;
    playlistName: string | null;
    playlistUri: string | null;
    trackUri: string | null;
    positionMs: number;
    paused: boolean;
    dj: string | null;
    djName: string;
    listeners: string[];
    updatedAt: string;
    seq: number;
    upNext: number;
  } | null;
  playlists: { id: string; name: string; uri: string }[];
  /** Spotify Web API connected (song lists + search live on the Music page) */
  spotifyLinked: boolean;
  /** my own Spotify: plays full songs in my Spotify app */
  spotifyMe: { name: string | null; app: boolean; problem: string | null } | null;
};

const GAME_NAMES: Record<string, string> = { c4: "Connect Four", gomoku: "Gomoku", ladder: "Snakes & Ladders", word: "Word Guess", ttt: "Tic tac toe", rps: "Rock paper scissors", tot: "This or That", memory: "Memory Match", boxes: "Dots and Boxes" };

export async function getIslandState(spaceId: string, meId: string = spaceId): Promise<IslandState> {
  const today = todayISO();
  const [listenRow, playlists, spLink, spMine, spPeople] = await Promise.all([
    db.select().from(schema.listen).where(eq(schema.listen.ownerId, spaceId)).limit(1),
    db.select({ id: schema.playlist.id, name: schema.playlist.name, uri: schema.playlist.uri }).from(schema.playlist).where(eq(schema.playlist.ownerId, spaceId)).orderBy(asc(schema.playlist.createdAt)),
    db.$count(schema.spotifyAuth, eq(schema.spotifyAuth.ownerId, spaceId)),
    db.select({ name: schema.spotifyMe.displayName, app: schema.spotifyMe.useApp, problem: schema.spotifyMe.problem }).from(schema.spotifyMe).where(eq(schema.spotifyMe.userId, meId)).limit(1),
    db.$count(schema.spotifyMe, eq(schema.spotifyMe.spaceId, spaceId)),
  ]);
  const [loveRows, turnRows, sosRow, timerRow, examRow, cds, set, users] = await Promise.all([
    db
      .select({ text: schema.loveNote.text, kind: schema.loveNote.kind, from: schema.loveNote.fromUserId })
      .from(schema.loveNote)
      .where(and(eq(schema.loveNote.ownerId, spaceId), sql`${schema.loveNote.fromUserId} <> ${meId}`, isNull(schema.loveNote.seenAt)))
      .orderBy(desc(schema.loveNote.createdAt))
      .limit(20),
    db
      .select({ kind: schema.game.kind })
      .from(schema.game)
      .where(and(eq(schema.game.ownerId, spaceId), eq(schema.game.status, "active"), eq(schema.game.turnUserId, meId))),
    db
      .select({ token: schema.sos.token })
      .from(schema.sos)
      .where(and(eq(schema.sos.ownerId, spaceId), eq(schema.sos.status, "active"), gte(schema.sos.createdAt, new Date(Date.now() - 12 * 3600_000))))
      .limit(1),
    db
      .select({ dueAt: schema.checkin.dueAt })
      .from(schema.checkin)
      .where(and(eq(schema.checkin.ownerId, spaceId), eq(schema.checkin.kind, "timer"), eq(schema.checkin.status, "active")))
      .limit(1),
    db
      .select({ title: schema.exam.title, at: schema.exam.at })
      .from(schema.exam)
      .where(and(eq(schema.exam.ownerId, spaceId), gte(schema.exam.at, new Date()), lt(schema.exam.at, new Date(Date.now() + 3 * 86_400_000))))
      .orderBy(asc(schema.exam.at))
      .limit(1),
    db.select().from(schema.countdown).where(eq(schema.countdown.ownerId, spaceId)),
    db.select({ since: schema.settings.togetherSince }).from(schema.settings).where(eq(schema.settings.ownerId, spaceId)).limit(1),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user),
  ]);
  const lastLove = loveRows.find((l) => l.kind !== "papask") ?? loveRows[0];
  const loveText = lastLove
    ? lastLove.kind === "sticker"
      ? "sent you a sticker ✨"
      : lastLove.kind === "pap"
        ? "sent you a pap 📸"
        : lastLove.kind === "miss"
          ? "misses you 🥺"
          : lastLove.kind === "papask"
            ? "wants a pap 📸"
            : lastLove.text
    : "";
  const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000);
  const nextCd = cds
    .map((c) => {
      let on = c.day;
      if (c.yearly && on < today) {
        const y = Number(today.slice(0, 4));
        on = `${y}-${c.day.slice(5)}` >= today ? `${y}-${c.day.slice(5)}` : `${y + 1}-${c.day.slice(5)}`;
      }
      return { title: c.title, emoji: c.emoji, days: days(today, on) };
    })
    .filter((c) => c.days >= 0 && c.days <= 7)
    .sort((a, b) => a.days - b.days)[0];
  let celebrate: string | null = null;
  const since = set[0]?.since;
  if (since && since < today) {
    const total = days(since, today);
    const sameDay = since.slice(8) === today.slice(8);
    const months = (Number(today.slice(0, 4)) - Number(since.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(since.slice(5, 7));
    if (sameDay && months % 12 === 0 && months > 0) celebrate = `🎉 ${months / 12} year${months > 12 ? "s" : ""} together today!`;
    else if (sameDay && months > 0) celebrate = `💞 Happy ${months} month${months > 1 ? "s" : ""} together!`;
    else if ((total + 1) % 100 === 0) celebrate = `💯 Day ${total + 1} together!`;
  }
  const extra = {
    love: lastLove ? { from: users.find((u) => u.id === lastLove.from)?.name ?? "", text: loveText.slice(0, 80), count: loveRows.length } : null,
    turns: turnRows.map((t) => ({ kind: t.kind, label: GAME_NAMES[t.kind] ?? t.kind })),
    sos: sosRow[0] ? { token: sosRow[0].token } : null,
    timer: timerRow[0]?.dueAt ? { dueAt: timerRow[0].dueAt.toISOString() } : null,
    exam: examRow[0] ? { title: examRow[0].title, at: examRow[0].at.toISOString() } : null,
    countdown: nextCd ?? null,
    celebrate,
    music: listenRow[0]
      ? {
          active: listenRow[0].active,
          playlistName: listenRow[0].playlistName,
          playlistUri: listenRow[0].playlistUri,
          trackUri: listenRow[0].trackUri,
          positionMs: listenRow[0].positionMs,
          paused: listenRow[0].paused,
          dj: listenRow[0].djUserId,
          djName: users.find((u) => u.id === listenRow[0].djUserId)?.name ?? "",
          listeners: listenRow[0].listeners,
          updatedAt: listenRow[0].updatedAt.toISOString(),
          seq: listenRow[0].seq,
          upNext: listenRow[0].queue.length,
        }
      : null,
    playlists,
    spotifyLinked: spLink + spPeople > 0,
    spotifyMe: spMine[0] ?? null,
  };
  const [tasks, [next], attention] = await Promise.all([
    getTodayTasks(spaceId),
    db
      .select()
      .from(reminder)
      .where(and(eq(reminder.ownerId, spaceId), eq(reminder.done, false)))
      .orderBy(asc(reminder.remindAt))
      .limit(1),
    getAttention(spaceId),
  ]);
  const open = tasks.filter((t) => !t.done);
  return {
    next: next ? { id: next.id, title: next.title, at: next.remindAt.toISOString(), repeat: next.repeat } : null,
    todayOpen: open.length,
    todayDone: tasks.length - open.length,
    tasks: open.slice(0, 4).map((t) => ({ id: t.id, title: t.title })),
    expiring: attention.expiring.length,
    low: attention.low.length,
    ...extra,
  };
}
