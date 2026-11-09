/**
 * Background jobs, run every 30 seconds by scripts/worker.ts:
 *   - due reminders  -> push + inbox (+ email)
 *   - morning digest -> push + inbox (+ email)
 *   - evening nudge  -> push + inbox when tasks are still open
 */
import { and, asc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { addDaysISO, money, prettyDay, todayISO } from "../lib/format";
import { localParts, nextOccurrence, prettyTime, prettyWhen, type Repeat } from "../lib/time";
import { mailLayout } from "./mail";
import { notify } from "./notify";
import { morningNote } from "./ai";

const { reminder, task, item, settings, transaction } = schema;

async function settingsFor(db: Db, ownerId: string) {
  const [s] = await db.select().from(settings).where(eq(settings.ownerId, ownerId)).limit(1);
  return s;
}

export async function runDueReminders(db: Db, now = new Date()) {
  const due = await db
    .select({ r: reminder, taskDone: task.done })
    .from(reminder)
    .leftJoin(task, eq(reminder.taskId, task.id))
    .where(and(eq(reminder.done, false), lte(reminder.remindAt, now)))
    .orderBy(asc(reminder.remindAt))
    .limit(50);

  let sent = 0;
  for (const { r, taskDone } of due) {
    const next = nextOccurrence(r.remindAt, r.repeat as Repeat, now);
    // Claim it first so a crash can never send the same reminder twice.
    await db
      .update(reminder)
      .set(next ? { remindAt: next, lastSentAt: now } : { done: true, lastSentAt: now })
      .where(eq(reminder.id, r.id));
    if (taskDone) continue;
    if (r.habitId) {
      const [logged] = await db
        .select({ d: schema.habitLog.day })
        .from(schema.habitLog)
        .where(and(eq(schema.habitLog.habitId, r.habitId), eq(schema.habitLog.day, todayISO(now))))
        .limit(1);
      if (logged) continue; // already did it today, no nagging
    }

    const s = await settingsFor(db, r.ownerId);
    const body = r.note || (r.taskId ? "Little task time! You got this 💪" : "Chichi is reminding you 🌼");
    await notify(db, {
      ownerId: r.ownerId,
      kind: "reminder",
      title: `⏰ ${r.title}`,
      body,
      url: r.taskId ? "/tasks" : "/reminders",
      pushExtra: {
        reminderId: r.id,
        sticky: true,
        actions: [
          { action: "done", title: "✓ Done" },
          { action: "snooze", title: "⏰ 10 min" },
        ],
      },
      email:
        s?.emailReminders === false
          ? null
          : {
              subject: `⏰ ${r.title}`,
              text: `${r.title}\n${body}\n${prettyWhen(r.remindAt)}${next ? `\nNext: ${prettyWhen(next)}` : ""}`,
              html: mailLayout({
                mood: "remind",
                title: r.title,
                intro: `${body}, ${prettyTime(r.remindAt)}`,
                blocks: next ? [{ lines: [`Next time: ${prettyWhen(next)}`] }] : [],
                cta: { label: r.taskId ? "Open my tasks" : "Open Danchi", path: r.taskId ? "/tasks" : "/reminders" },
              }),
            },
    });
    sent++;
  }
  return sent;
}

async function summary(db: Db, ownerId: string) {
  const today = todayISO();
  const [tasks, expiring, low, todays, s] = await Promise.all([
    db
      .select()
      .from(task)
      .where(and(eq(task.ownerId, ownerId), eq(task.done, false), or(sql`${task.dueOn} is null`, lte(task.dueOn, today))))
      .orderBy(sql`${task.dueOn} asc nulls last`)
      .limit(20),
    db
      .select()
      .from(item)
      .where(and(eq(item.ownerId, ownerId), isNotNull(item.expiresOn), lte(item.expiresOn, addDaysISO(today, 3)), sql`${item.quantity} > 0`))
      .orderBy(asc(item.expiresOn))
      .limit(10),
    db.select().from(item).where(and(eq(item.ownerId, ownerId), lte(item.quantity, item.lowAt))).limit(10),
    db
      .select()
      .from(reminder)
      .where(
        and(
          eq(reminder.ownerId, ownerId),
          eq(reminder.done, false),
          gte(reminder.remindAt, new Date()),
          lte(reminder.remindAt, new Date(Date.now() + 24 * 3600_000)),
        ),
      )
      .orderBy(asc(reminder.remindAt))
      .limit(10),
    settingsFor(db, ownerId),
  ]);
  const S = schema;
  const [asg, exams, bills, habits] = await Promise.all([
    db
      .select()
      .from(S.assignment)
      .where(and(eq(S.assignment.ownerId, ownerId), sql`${S.assignment.status} <> 'done'`, isNotNull(S.assignment.dueAt), lte(S.assignment.dueAt, new Date(Date.now() + 2 * 86_400_000))))
      .orderBy(asc(S.assignment.dueAt)),
    db
      .select()
      .from(S.exam)
      .where(and(eq(S.exam.ownerId, ownerId), gte(S.exam.at, new Date()), lte(S.exam.at, new Date(Date.now() + 3 * 86_400_000))))
      .orderBy(asc(S.exam.at)),
    db
      .select()
      .from(S.bill)
      .where(and(eq(S.bill.ownerId, ownerId), eq(S.bill.active, true), lte(S.bill.nextDue, addDaysISO(today, 3))))
      .orderBy(asc(S.bill.nextDue)),
    db.select().from(S.habit).where(and(eq(S.habit.ownerId, ownerId), eq(S.habit.archived, false))),
  ]);
  return { today, tasks, expiring, low, todays, s, asg, exams, bills, habits };
}

export async function runDigest(db: Db, now = new Date()) {
  const owners = await db.select().from(settings);
  let sent = 0;
  for (const s of owners) {
    if (s.digestHour < 0) continue;
    const h = localParts(now).hour;
    const today = todayISO(now);
    if (s.lastDigestOn === today || h < s.digestHour) continue;
    await db.update(settings).set({ lastDigestOn: today }).where(eq(settings.ownerId, s.ownerId));
    if (h > s.digestHour + 3) continue; // worker was off all morning: don't send a "good morning" at night

    const d = await summary(db, s.ownerId);
    const late = d.tasks.filter((t) => t.dueOn && t.dueOn < d.today);
    const bits = [
      d.tasks.length ? `${d.tasks.length} task${d.tasks.length > 1 ? "s" : ""} today` : "No tasks today",
      d.expiring.length ? `${d.expiring[0].name}${d.expiring.length > 1 ? ` +${d.expiring.length - 1}` : ""} expiring` : null,
      d.low.length ? `${d.low.length} running low` : null,
      d.todays.length ? `${d.todays.length} reminder${d.todays.length > 1 ? "s" : ""}` : null,
      d.exams.length ? `📖 ${d.exams[0].title} soon` : null,
      d.asg.length ? `📚 ${d.asg.length} due soon` : null,
      d.bills.length ? `💸 ${d.bills.length} bill${d.bills.length > 1 ? "s" : ""}` : null,
    ].filter(Boolean);

    const [{ spent }] = await db
      .select({ spent: sql<number>`coalesce(sum(${transaction.amountCents}), 0)::int` })
      .from(transaction)
      .where(and(eq(transaction.ownerId, s.ownerId), eq(transaction.kind, "expense"), gte(transaction.occurredOn, d.today.slice(0, 8) + "01")));

    const [owner] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, s.ownerId)).limit(1);
    const note = await morningNote(db, s.ownerId, owner?.name ?? "Adis");

    await notify(db, {
      ownerId: s.ownerId,
      kind: "digest",
      title: "Good morning! ☀️ Here's your day",
      body: note ? `${note}\n${bits.join(", ")}` : bits.join(", "),
      url: "/",
      email: s.emailDigest
        ? {
            subject: `☀️ Your Danchi day: ${bits.join(", ")}`,
            text: [
              note ?? "Good morning! Here's your day.",
              ...d.tasks.map((t) => `- ${t.title}${t.dueOn && t.dueOn < d.today ? " (late)" : ""}`),
              ...d.expiring.map((i) => `- ${i.name} expires ${prettyDay(i.expiresOn!)}`),
              ...d.low.map((i) => `- ${i.name}: ${i.quantity} left`),
            ].join("\n"),
            html: mailLayout({
              mood: "wave",
              title: "Good morning, sunshine!",
              intro: note ?? bits.join(", "),
              blocks: [
                { heading: "Today", emoji: "✅", lines: d.tasks.map((t) => `${t.title}${late.includes(t) ? ", late!" : ""}`) },
                { heading: "Reminders", emoji: "⏰", lines: d.todays.map((r) => `${prettyTime(r.remindAt)}, ${r.title}`) },
                { heading: "Exams coming", emoji: "📖", lines: d.exams.map((e) => `${e.title}, ${prettyWhen(e.at)}${e.room ? `, ${e.room}` : ""}`) },
                { heading: "Assignments due", emoji: "📚", lines: d.asg.map((a) => `${a.title}, ${prettyWhen(a.dueAt!)}`) },
                { heading: "Bills", emoji: "💸", lines: d.bills.map((b) => `${b.name}, ${money(b.amountCents, s.currency)}, ${prettyDay(b.nextDue)}`) },
                { heading: "Little habits", emoji: "🌱", lines: d.habits.map((h) => `${h.emoji} ${h.name}`) },
                { heading: "Expiring soon", emoji: "🥛", lines: d.expiring.map((i) => `${i.name}, ${prettyDay(i.expiresOn!)}`) },
                { heading: "Running low", emoji: "🛍️", lines: d.low.map((i) => `${i.name}, ${i.quantity} left`) },
                {
                  heading: "Money this month",
                  emoji: "🐷",
                  lines: [`${money(spent, s.currency)} of ${money(s.monthlyBudgetCents, s.currency)} spent`],
                },
              ],
              cta: { label: "Open Danchi", path: "/" },
            }),
          }
        : null,
    });
    sent++;
  }
  return sent;
}

export async function runNudge(db: Db, now = new Date()) {
  const owners = await db.select().from(settings);
  let sent = 0;
  for (const s of owners) {
    if (s.nudgeHour < 0) continue;
    const h = localParts(now).hour;
    const today = todayISO(now);
    if (s.lastNudgeOn === today || h < s.nudgeHour) continue;
    await db.update(settings).set({ lastNudgeOn: today }).where(eq(settings.ownerId, s.ownerId));
    if (h > s.nudgeHour + 2) continue;

    const [checked] = await db
      .select({ doneAt: schema.dailyCheck.doneAt })
      .from(schema.dailyCheck)
      .where(and(eq(schema.dailyCheck.ownerId, s.ownerId), eq(schema.dailyCheck.day, today)))
      .limit(1);
    if (checked?.doneAt) continue;
    const open = await db
      .select({ title: task.title })
      .from(task)
      .where(and(eq(task.ownerId, s.ownerId), eq(task.done, false), isNotNull(task.dueOn), lte(task.dueOn, today)))
      .limit(10);
    await notify(db, {
      ownerId: s.ownerId,
      kind: "nudge",
      audience: "owner",
      title: open.length ? `${open.length} little thing${open.length > 1 ? "s" : ""} left today 🌙` : "Time for your 2 minute daily check 🌙",
      body: open.length
        ? `${open.slice(0, 3).map((t) => t.title).join(", ")}${open.length > 3 ? " and more" : ""}. Tap to wrap up your day.`
        : "Mood, habits, spending and one line of journal. Then sleep well 💤",
      url: "/check",
    });
    sent++;
  }
  return sent;
}

/**
 * Pinned status ("Chichi Island" for the phone's notification shade / Android
 * dynamic-island apps): one quiet notification that updates itself whenever
 * what's next changes. Off by default (Settings).
 */
export async function pinnedText(db: Db, ownerId: string, now = new Date()) {
  const today = todayISO(now);
  const [[next], open, expiring] = await Promise.all([
    db
      .select()
      .from(reminder)
      .where(and(eq(reminder.ownerId, ownerId), eq(reminder.done, false), lte(reminder.remindAt, new Date(now.getTime() + 6 * 3600_000))))
      .orderBy(asc(reminder.remindAt))
      .limit(1),
    db
      .select({ id: task.id })
      .from(task)
      .where(and(eq(task.ownerId, ownerId), eq(task.done, false), or(sql`${task.dueOn} is null`, lte(task.dueOn, today)))),
    db
      .select({ id: item.id })
      .from(item)
      .where(and(eq(item.ownerId, ownerId), isNotNull(item.expiresOn), lte(item.expiresOn, addDaysISO(today, 1)), sql`${item.quantity} > 0`)),
  ]);
  const parts = [
    next ? `⏰ ${next.title}, ${prettyTime(next.remindAt)}` : null,
    open.length ? `✅ ${open.length} left today` : "🌼 All done today",
    expiring.length ? `🥛 ${expiring.length} expiring` : null,
  ].filter(Boolean);
  return parts.join(",  ");
}

export async function runPinned(db: Db, now = new Date()) {
  const owners = await db.select().from(settings);
  let sent = 0;
  for (const s of owners) {
    if (!s.pinnedStatus) {
      if (s.lastPinnedText) {
        // Switched off. The phone removes it itself when the switch is flipped
        // (Settings). We no longer send an invisible "clear" push: browsers
        // treat pushes that show nothing as abuse and can drop the subscription,
        // which made notifications turn themselves off.
        await db.update(settings).set({ lastPinnedText: null }).where(eq(settings.ownerId, s.ownerId));
      }
      continue;
    }
    const text = await pinnedText(db, s.ownerId, now);
    if (text === s.lastPinnedText) continue;
    await db.update(settings).set({ lastPinnedText: text, lastPinnedAt: now }).where(eq(settings.ownerId, s.ownerId));
    await notify(db, {
      ownerId: s.ownerId,
      kind: "info",
      title: "Today with Chichi",
      body: text,
      url: "/",
      audience: "owner",
      inbox: false,
      pushExtra: { tag: "danchi-island", silent: true, sticky: true },
    });
    sent++;
  }
  return sent;
}
