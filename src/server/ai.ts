/**
 * "Ask Chichi": Gemini with a snapshot of Danchi + what Chichi remembers about
 * her as context, and tools so she can actually do things: tasks, reminders,
 * shopping, money, stuff, and remembering wishes/likes/goals.
 */
import type { FunctionDeclaration } from "@google/genai";
import { and, asc, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { ITEM_CATEGORY_KEYS, MONEY_CATEGORY_KEYS } from "../lib/constants";
import { TIMEZONE, addDaysISO, monthRange, money, todayISO } from "../lib/format";
import { localTime, prettyWhen, REPEATS, zonedToUtc, type Repeat } from "../lib/time";
import { addShopping, assignmentReminders, billReminders, createReminder, createTask, debtReminders, ensureOnList, examReminders, logMoney, paperReminders } from "./mutations";
import { APP_CATEGORIES, DOC_CATEGORIES } from "../lib/papers";
import { cycleStats, PHASE_INFO } from "../lib/cycle";
import { askOnce, brains } from "./llm";

export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

export function aiConfigured() {
  return brains().length > 0;
}

const DATE = { type: "string", description: "Local date, YYYY-MM-DD" };
const TIME = { type: "string", description: "Local 24h time, HH:MM" };

export const TOOLS: FunctionDeclaration[] = [
  {
    name: "search_danchi",
    description:
      "Search inside her Danchi for things that are NOT in the DATA summary: the text of her notes and journal, saved recipes (ingredients and steps), flashcards, documents and applications notes, learning notes, project descriptions, item notes. Use it whenever she asks about something she wrote or saved before.",
    parametersJsonSchema: { type: "object", properties: { query: { type: "string", description: "one or two key words" } }, required: ["query"] },
  },
  {
    name: "add_task",
    description: "Add a to-do task. Use remind_time when she wants a ping at a certain time.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: DATE,
        priority: { type: "string", enum: ["low", "normal", "high"] },
        remind_time: TIME,
      },
      required: ["title"],
    },
  },
  {
    name: "add_reminder",
    description: "Schedule a reminder notification (push + email) at a date and time, optionally repeating.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: DATE,
        time: TIME,
        repeat: { type: "string", enum: REPEATS },
        note: { type: "string" },
      },
      required: ["title", "date", "time"],
    },
  },
  {
    name: "add_to_shopping",
    description: "Put something on the shopping list.",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string" }, priority: { type: "string", enum: ["urgent", "need", "maybe"] } },
      required: ["name"],
    },
  },
  {
    name: "log_expense",
    description: "Record money she spent today (amount in her currency).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        amount: { type: "number" },
        category: { type: "string", enum: MONEY_CATEGORY_KEYS },
        note: { type: "string" },
      },
      required: ["amount", "category"],
    },
  },
  {
    name: "remember",
    description:
      "Save something about her to Chichi's memory so you can use it later: likes, dislikes, goals, important dates (birthdays, anniversaries), or other notes. Things she wants to buy or get go to add_wish instead.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["like", "dislike", "goal", "date", "note"] },
        text: { type: "string", description: "Short, in third person, e.g. 'Wants the pink Laneige lip mask'" },
      },
      required: ["kind", "text"],
    },
  },
  {
    name: "forget",
    description: "Remove a memory that's no longer true (e.g. she bought the thing she wished for).",
    parametersJsonSchema: { type: "object", properties: { text: { type: "string", description: "words from the memory" } }, required: ["text"] },
  },
  {
    name: "complete_task",
    description: "Mark an open task as done.",
    parametersJsonSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
  },
  {
    name: "cancel_reminder",
    description: "Cancel an upcoming reminder.",
    parametersJsonSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
  },
  {
    name: "update_stuff",
    description:
      "Add an item to her stuff (inventory) or change one: set quantity, use some (negative change), restock, set expiry date or where it is kept.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        change: { type: "integer", description: "+N bought/restocked, -N used" },
        quantity: { type: "integer", description: "exact amount now" },
        expires_on: DATE,
        category: { type: "string", enum: ITEM_CATEGORY_KEYS },
        location: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_assignment",
    description: "Add a uni/school assignment with its due date. Chichi automatically reminds her the evening before and the morning it's due.",
    parametersJsonSchema: {
      type: "object",
      properties: { title: { type: "string" }, due_date: DATE, due_time: TIME, course: { type: "string", description: "course name or code if known" } },
      required: ["title"],
    },
  },
  {
    name: "add_exam",
    description: "Add an exam. Chichi reminds her 3 days before, the night before and 2 hours before.",
    parametersJsonSchema: {
      type: "object",
      properties: { title: { type: "string" }, date: DATE, time: TIME, room: { type: "string" }, course: { type: "string" } },
      required: ["title", "date"],
    },
  },
  {
    name: "log_habit",
    description: "Mark one of her habits as done today (match by name).",
    parametersJsonSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "add_note",
    description: "Save a note, or a journal entry about her day (kind journal, with mood 1 to 5).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["note", "journal"] },
        title: { type: "string" },
        body: { type: "string" },
        mood: { type: "integer", description: "journal only: 1 rough, 2 meh, 3 okay, 4 good, 5 lovely" },
      },
      required: ["kind", "body"],
    },
  },
  {
    name: "add_bill",
    description: "Track a bill or subscription. Chichi reminds her before it's due.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        amount: { type: "number" },
        next_due: DATE,
        cycle: { type: "string", enum: ["monthly", "yearly", "weekly", "once"] },
        kind: { type: "string", enum: ["bill", "subscription"] },
      },
      required: ["name", "amount", "next_due"],
    },
  },
  {
    name: "add_wish",
    description: "Add something she wishes for to her wishlist.",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string" }, price: { type: "number" }, priority: { type: "string", enum: ["need", "want", "dream"] }, link: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "add_paper",
    description: "Track a document (passport, IC, visa, insurance... with an expiry date) or an application (scholarship, internship, job... with a deadline). Never store full ID numbers.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["document", "application"] },
        title: { type: "string" },
        category: { type: "string", description: "document: passport | id | visa | student | license | insurance | health | certificate | other. application: scholarship | internship | job | program | competition | other" },
        org: { type: "string" },
        expires_on: DATE,
        deadline_on: DATE,
      },
      required: ["kind", "title"],
    },
  },
  {
    name: "add_debt",
    description: "Note money owed: someone owes her (owes_me) or she owes someone (i_owe).",
    parametersJsonSchema: {
      type: "object",
      properties: { person: { type: "string" }, amount: { type: "number" }, direction: { type: "string", enum: ["owes_me", "i_owe"] }, note: { type: "string" }, due_on: DATE },
      required: ["person", "amount", "direction"],
    },
  },
  {
    name: "add_flashcards",
    description: "Create a deck of flashcards or practice questions (for example from notes she pasted, or a topic she's studying).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        deck: { type: "string" },
        kind: { type: "string", enum: ["flashcards", "quiz", "midterm", "pastyear", "practice"] },
        cards: { type: "array", items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"] } },
      },
      required: ["deck", "cards"],
    },
  },
  {
    name: "add_learning",
    description: "Add a learning goal, online course, book, article, video, skill, certificate or resource link to her Learning page.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        kind: { type: "string", enum: ["goal", "course", "book", "article", "video", "skill", "certificate", "resource"] },
        link: { type: "string" },
        roadmap: { type: "string", description: "Optional steps, one per line" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_savings_goal",
    description: "Start a savings goal (what she is saving for and how much).",
    parametersJsonSchema: {
      type: "object",
      properties: { name: { type: "string" }, target: { type: "number" }, emoji: { type: "string" }, due_on: DATE },
      required: ["name", "target"],
    },
  },
  {
    name: "add_recipe",
    description: "Save a recipe to her Kitchen (for example one you just suggested and she liked).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        emoji: { type: "string" },
        minutes: { type: "integer" },
        ingredients: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" } },
      },
      required: ["title", "ingredients"],
    },
  },
  {
    name: "add_countdown",
    description: "Add a countdown in her Cozy corner to a day she's looking forward to (trip, birthday, anniversary, end of exams). yearly for birthdays and anniversaries.",
    parametersJsonSchema: {
      type: "object",
      properties: { title: { type: "string" }, date: DATE, emoji: { type: "string" }, yearly: { type: "boolean" } },
      required: ["title", "date"],
    },
  },
  {
    name: "add_bucket",
    description: "Add something to their shared couple bucket list (things to do together someday: trips, dates, experiences).",
    parametersJsonSchema: { type: "object", properties: { title: { type: "string" }, emoji: { type: "string" } }, required: ["title"] },
  },
  {
    name: "add_happy_memory",
    description: "Drop a happy moment into her Happy jar (something that made her smile, a nice thing that happened, a proud moment).",
    parametersJsonSchema: { type: "object", properties: { text: { type: "string" }, emoji: { type: "string" } }, required: ["text"] },
  },
  {
    name: "plan_meal",
    description: "Put a meal on her meal plan.",
    parametersJsonSchema: {
      type: "object",
      properties: { date: DATE, slot: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] }, text: { type: "string" } },
      required: ["date", "slot", "text"],
    },
  },
];

/** A compact picture of her Danchi right now. */
async function snapshot(db: Db, spaceId: string) {
  const today = todayISO();
  const { start, end, label } = monthRange();
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.ownerId, spaceId)).limit(1);
  const currency = s?.currency ?? "RM";
  const today2 = todayISO();
  const [courses, asg, exams, habits, habitLogs, bills, wishes, recipes, meals, projects, journal] = await Promise.all([
    db.select().from(schema.course).where(and(eq(schema.course.ownerId, spaceId), eq(schema.course.archived, false))),
    db.select().from(schema.assignment).where(and(eq(schema.assignment.ownerId, spaceId), sql`${schema.assignment.status} <> 'done'`)).orderBy(asc(schema.assignment.dueAt)).limit(20),
    db.select().from(schema.exam).where(and(eq(schema.exam.ownerId, spaceId), gte(schema.exam.at, new Date()))).orderBy(asc(schema.exam.at)).limit(10),
    db.select().from(schema.habit).where(and(eq(schema.habit.ownerId, spaceId), eq(schema.habit.archived, false))),
    db.select().from(schema.habitLog).where(and(eq(schema.habitLog.ownerId, spaceId), eq(schema.habitLog.day, today2))),
    db.select().from(schema.bill).where(and(eq(schema.bill.ownerId, spaceId), eq(schema.bill.active, true))).orderBy(asc(schema.bill.nextDue)).limit(20),
    db.select().from(schema.wish).where(and(eq(schema.wish.ownerId, spaceId), eq(schema.wish.got, false))).limit(30),
    db.select({ title: schema.recipe.title }).from(schema.recipe).where(eq(schema.recipe.ownerId, spaceId)).limit(60),
    db.select().from(schema.mealPlan).where(and(eq(schema.mealPlan.ownerId, spaceId), gte(schema.mealPlan.day, today2), lt(schema.mealPlan.day, addDaysISO(today2, 7)))),
    db.select().from(schema.project).where(and(eq(schema.project.ownerId, spaceId), eq(schema.project.status, "active"))).limit(10),
    db.select({ mood: schema.note.mood, at: schema.note.createdAt }).from(schema.note).where(and(eq(schema.note.ownerId, spaceId), eq(schema.note.kind, "journal"))).orderBy(desc(schema.note.createdAt)).limit(5),
  ]);
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.code ?? courses.find((c) => c.id === id)?.name ?? null;
  const [tasks, items, shop, tx, reminders, memories] = await Promise.all([
    db
      .select()
      .from(schema.task)
      .where(and(eq(schema.task.ownerId, spaceId), eq(schema.task.done, false)))
      .orderBy(sql`${schema.task.dueOn} asc nulls last`)
      .limit(30),
    db.select().from(schema.item).where(eq(schema.item.ownerId, spaceId)).orderBy(asc(schema.item.name)).limit(80),
    db
      .select()
      .from(schema.shoppingItem)
      .where(and(eq(schema.shoppingItem.ownerId, spaceId), eq(schema.shoppingItem.done, false)))
      .limit(30),
    db
      .select()
      .from(schema.transaction)
      .where(and(eq(schema.transaction.ownerId, spaceId), gte(schema.transaction.occurredOn, start), lt(schema.transaction.occurredOn, end)))
      .orderBy(desc(schema.transaction.occurredOn))
      .limit(60),
    db
      .select()
      .from(schema.reminder)
      .where(and(eq(schema.reminder.ownerId, spaceId), eq(schema.reminder.done, false)))
      .orderBy(asc(schema.reminder.remindAt))
      .limit(15),
    db.select().from(schema.aiMemory).where(eq(schema.aiMemory.ownerId, spaceId)).orderBy(asc(schema.aiMemory.createdAt)).limit(80),
  ]);
  const [countdowns, focusToday, jarCount] = await Promise.all([
    db.select().from(schema.countdown).where(eq(schema.countdown.ownerId, spaceId)).limit(30),
    db
      .select({ m: sql<number>`coalesce(sum(${schema.focusSession.minutes}), 0)::int` })
      .from(schema.focusSession)
      .where(and(eq(schema.focusSession.ownerId, spaceId), eq(schema.focusSession.day, today))),
    db.$count(schema.jarNote, eq(schema.jarNote.ownerId, spaceId)),
  ]);
  const [papers, debts, moods, cycle, timer, learningRows, goals] = await Promise.all([
    db.select().from(schema.paper).where(eq(schema.paper.ownerId, spaceId)).limit(40),
    db.select().from(schema.debt).where(and(eq(schema.debt.ownerId, spaceId), eq(schema.debt.settled, false))).limit(30),
    db.select().from(schema.moodLog).where(and(eq(schema.moodLog.ownerId, spaceId), gte(schema.moodLog.day, addDaysISO(today, -6)))).orderBy(asc(schema.moodLog.day)),
    db.select({ startOn: schema.cycleLog.startOn, endOn: schema.cycleLog.endOn }).from(schema.cycleLog).where(eq(schema.cycleLog.ownerId, spaceId)).limit(24),
    db
      .select()
      .from(schema.checkin)
      .where(and(eq(schema.checkin.ownerId, spaceId), eq(schema.checkin.kind, "timer"), eq(schema.checkin.status, "active")))
      .limit(1),
    db.select().from(schema.learning).where(eq(schema.learning.ownerId, spaceId)).limit(40),
    db.select().from(schema.savingsGoal).where(eq(schema.savingsGoal.ownerId, spaceId)).limit(20),
  ]);
  const cyc = cycle.length ? cycleStats(cycle, today) : null;
  const spent = tx.filter((t) => t.kind === "expense").reduce((a, t) => a + t.amountCents, 0);
  const byCat: Record<string, number> = {};
  for (const t of tx.filter((t) => t.kind === "expense")) {
    byCat[t.category] = Math.round(((byCat[t.category] ?? 0) + t.amountCents / 100) * 100) / 100;
  }
  return {
    today,
    currency,
    tasks: tasks.map((t) => ({ title: t.title, due: t.dueOn, priority: t.priority })),
    stuff: items.map((i) => ({
      name: i.name,
      category: i.category,
      qty: i.quantity,
      low_at: i.lowAt,
      expires: i.expiresOn,
      where: i.location,
    })),
    shopping_list: shop.map((x) => ({ name: x.name, priority: x.priority })),
    money: {
      month: label,
      budget: money(s?.monthlyBudgetCents ?? 120000, currency),
      spent: money(spent, currency),
      by_category: byCat,
      recent: tx.slice(0, 15).map((t) => ({ on: t.occurredOn, amount: t.amountCents / 100, category: t.category, note: t.note, kind: t.kind })),
    },
    reminders: reminders.map((r) => ({ title: r.title, when: prettyWhen(r.remindAt), repeat: r.repeat })),
    chichi_remembers: memories.map((m) => `${m.kind}: ${m.text}`),
    courses: courses.map((c) => ({ name: c.name, code: c.code, schedule: c.schedule, room: c.room })),
    assignments: asg.map((a) => ({ title: a.title, course: courseName(a.courseId), due: a.dueAt ? prettyWhen(a.dueAt) : null, status: a.status })),
    exams: exams.map((e) => ({ title: e.title, course: courseName(e.courseId), when: prettyWhen(e.at), room: e.room })),
    habits: habits.map((h) => ({ name: h.name, emoji: h.emoji, done_today: habitLogs.some((l) => l.habitId === h.id), per_week: h.perWeek })),
    bills: bills.map((b) => ({ name: b.name, amount: b.amountCents / 100, due: b.nextDue, cycle: b.cycle })),
    wishlist: wishes.map((w) => ({ name: w.name, price: w.priceCents ? w.priceCents / 100 : null, priority: w.priority })),
    saved_recipes: recipes.map((r) => r.title),
    meal_plan_next_7_days: meals.map((m) => ({ day: m.day, slot: m.slot, meal: m.text })),
    active_projects: projects.map((p) => ({ name: p.name, due: p.dueOn })),
    recent_journal_moods: journal.map((j) => ({ mood: j.mood, when: prettyWhen(j.at) })),
    papers: papers.map((p) =>
      p.kind === "document"
        ? { document: p.title, type: p.category, expires: p.expiresOn }
        : { application: p.title, at: p.org, deadline: p.deadlineOn, status: p.status, checklist_left: p.checklist.filter((c) => !c.done).map((c) => c.t) },
    ),
    debts: debts.map((d) => ({ person: d.person, amount: d.amountCents / 100, who_owes: d.direction === "i_owe" ? "she owes them" : "they owe her", due: d.dueOn })),
    mood_last_7_days: moods.map((m) => ({ day: m.day, mood_1_to_5: m.mood })),
    cycle: cyc ? { phase: PHASE_INFO[cyc.phase].label, day: cyc.day, next_period_around: cyc.nextStart } : null,
    learning: learningRows.map((l) => ({ title: l.title, kind: l.kind, status: l.status, progress: l.progress, level: l.level })),
    savings_goals: goals.map((g) => ({ name: g.name, saved: g.savedCents / 100, target: g.targetCents / 100, by: g.dueOn })),
    countdowns: countdowns.map((c) => ({ title: c.title, date: c.day, yearly: c.yearly })),
    focus_minutes_today: focusToday[0]?.m ?? 0,
    happy_jar_moments: jarCount,
    safe_arrival_timer_running: timer[0] ? { until: prettyWhen(timer[0].dueAt!), plan: timer[0].message } : null,
    next_7_days: Array.from({ length: 7 }, (_, i) => {
      const d = addDaysISO(today, i);
      return `${d} ${new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}`;
    }),
  };
}

/** What Chichi may tell the viewer: only what she shares. Her cycle never. */
async function forViewer(db: Db, spaceId: string, data: Awaited<ReturnType<typeof snapshot>>) {
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.ownerId, spaceId)).limit(1);
  const hidden = new Set(s?.hiddenSections ?? []);
  const out: Record<string, unknown> = { ...data, cycle: null };
  const drop = (key: string, fields: string[]) => {
    if (hidden.has(key)) for (const f of fields) delete out[f];
  };
  drop("tasks", ["tasks", "reminders"]);
  drop("stuff", ["stuff", "shopping_list"]);
  drop("money", ["money", "bills", "debts"]);
  drop("wishlist", ["wishlist"]);
  drop("study", ["courses", "assignments", "exams"]);
  drop("projects", ["active_projects"]);
  drop("kitchen", ["saved_recipes", "meal_plan_next_7_days"]);
  drop("habits", ["habits"]);
  drop("papers", ["papers"]);
  drop("learn", ["learning"]);
  drop("money", ["savings_goals"]);
  drop("journal", ["recent_journal_moods"]);
  drop("cozy", ["countdowns", "focus_minutes_today", "happy_jar_moments"]);
  if (s && !s.shareMood) delete out.mood_last_7_days;
  out.private_note = "Some sections are private to her. If asked about anything missing, say kindly that it's hers to share.";
  return out as typeof data;
}

/** The part of the instructions that never changes (cached by Claude). */
export function staticPrompt(ownerName: string, speaker: { name: string; role: "owner" | "viewer" }) {
  return `You are Chichi, a tiny round peach with a dandelion puff for hair. You live inside Danchi, ${ownerName}'s private life organizer, and you are her smart, warm best friend and personal assistant.

WHO YOU ARE
You are genuinely clever and well read, like a brilliant friend who happens to know a lot about everything: cooking, uni subjects (science, maths, economics, law, languages, IT, design...), writing, health and beauty basics, money, tech, travel, relationships, culture, and daily life. Personality: warm, playful, encouraging, a little bit cute, never cringe, never preachy.

HOW YOU ANSWER
1. Answer ANY question she asks, not only things about Danchi. Recipes, homework, "what does this word mean", "how do I...", maths, translations, emails, captions, ideas, advice: just help, fully and correctly.
2. Never reply with "I don't know", "I can't help with that" or "I only know about Danchi". If you are not sure, or the question is about something current (news, prices, opening hours, weather, schedules, products, events, people, anything that may have changed recently), USE WEB SEARCH first, then answer. If after searching something is still uncertain, give your best answer and say in one short line what to double check. Never make things up.
3. Match the length to the question. Simple question: 1 to 3 sentences. Recipes, explanations, study help, plans: complete and well organized, as long as needed.
4. Recipes: give a title, servings and time, the full ingredient list with amounts, then numbered steps, then one tip. Prefer what she already has in Stuff (food), especially items expiring soon, and say which ingredients she still needs to buy (offer to add them to her shopping list).
5. Study help: explain step by step in simple words, with a small example. For maths show the working. Check your arithmetic carefully. Offer to turn it into flashcards.
6. Language: reply in the language she writes in (English, Bahasa Indonesia or Malay are all fine). Keep the same friendly voice.
7. Formatting: short paragraphs. Use **bold** for small headings, numbered lines "1." for steps, and an emoji at the start of a line for simple lists. Never use the characters "·", "—" or "–", and never start a line with "-" or "*". At most 3 emoji in a normal answer.
8. Health, medicine, legal or money decisions: give clear, useful general information, and for anything serious or urgent tell her kindly to see a doctor, pharmacist or the right professional. In an emergency tell her to call 999 (Malaysia) or the local emergency number right away.

HER DANCHI
For facts about HER life (tasks, money, stuff, plans, notes) use only the DATA below or the search_danchi tool. Never invent her data. If it really isn't there, say so and offer to add it.
${
  speaker.role === "owner"
    ? `You are talking with ${ownerName}. When she asks you to add, remember, remind, buy or log something, CALL THE TOOLS (one call per thing) and then confirm briefly what you did with the day/time. Resolve words like "tomorrow", "tonight" (20:00), "this evening" (19:00), "morning" (09:00), "after class" (ask if unclear) using the dates in DATA. If a reminder time is missing, ask once instead of guessing.
Be a caring helper, not just a database: notice things (something expiring that she could cook, a wish that fits her budget, a busy day) and gently suggest one useful next step. When she mentions something she wants to buy or get, use add_wish. When she mentions likes, dislikes, allergies, goals or important dates, save them with "remember" (mention it lightly). When a wish comes true or isn't relevant anymore, use "forget". Use "chichi_remembers" to make answers personal (for example avoid foods she dislikes or is allergic to).
She is a uni student: help with assignments, exams (add them so Chichi reminds her), study plans, and flashcards (use add_flashcards when she pastes notes or asks for practice questions). For self growth use add_learning (with a roadmap of steps for goals) and add_savings_goal. For daily life help with habits, journal, recipes (add_recipe when she likes one), meal plans and bills. When she shares something happy, offer to put it in her Happy jar (add_happy_memory). When she mentions a day she's excited about, offer a countdown (add_countdown). If she's stressed or can't sleep, suggest the 1 minute breathing in Cozy corner; if she needs to study, suggest the Focus timer there.`
    : `You are talking with ${speaker.name}, ${ownerName}'s partner. He can look but cannot change anything, so never offer to add or edit things; you can suggest he reminds her himself. Be kind about ${ownerName}. You can still answer his general questions (recipes, ideas for dates or gifts, anything).`
}
Care and safety: if she mentions going somewhere late or alone, suggest the safe arrival timer in Safety. If her mood looks low lately, be extra gentle and suggest one small kind thing, never lecture. Never share her cycle details with anyone else.
If she sends a photo, look at it carefully and use it (a fridge photo: suggest recipes; homework: explain it; a receipt: offer to log the spending; a product: tell her about it).`;
}

/** The part that changes every message: the time and her data. */
export function dynamicPrompt(data: unknown) {
  const now = new Date();
  return `Right now it is ${now.toLocaleString("en-GB", { timeZone: TIMEZONE, dateStyle: "full", timeStyle: "short" })} (${TIMEZONE}). Current local time: ${localTime(now)}. She lives in Malaysia unless DATA says otherwise. Money is in ${(data as { currency: string }).currency}.
DATA (JSON):
${JSON.stringify(data)}`;
}

type ToolArgs = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => /^\d{2}:\d{2}$/.test(v);

export async function runTool(db: Db, spaceId: string, currency: string, name: string, a: ToolArgs): Promise<{ result: Record<string, unknown>; label?: string }> {
  try {
    if (name === "search_danchi") return { result: await searchDanchi(db, spaceId, str(a.query)) };
    if (name === "add_task") {
      const title = str(a.title).slice(0, 140);
      if (!title) return { result: { error: "title missing" } };
      const due = isDate(str(a.due_date)) ? str(a.due_date) : null;
      const rt = isTime(str(a.remind_time)) ? str(a.remind_time) : null;
      const pr = ["low", "normal", "high"].includes(str(a.priority)) ? (str(a.priority) as "low") : "normal";
      const { reminderAt } = await createTask(db, spaceId, { title, dueOn: due, priority: pr, remindTime: rt });
      return {
        result: { ok: true, due, reminder: reminderAt ? prettyWhen(reminderAt) : null },
        label: `Task added: ${title}${reminderAt ? `, ⏰ ${prettyWhen(reminderAt)}` : due ? `, ${due}` : ""}`,
      };
    }
    if (name === "add_reminder") {
      const title = str(a.title).slice(0, 140);
      const date = str(a.date);
      const time = str(a.time);
      if (!title || !isDate(date) || !isTime(time)) return { result: { error: "need title, date YYYY-MM-DD and time HH:MM" } };
      const repeat = (REPEATS as string[]).includes(str(a.repeat)) ? (str(a.repeat) as Repeat) : "none";
      const r = await createReminder(db, spaceId, { title, date, time, repeat, note: str(a.note).slice(0, 200) || null });
      return {
        result: { ok: true, when: prettyWhen(r.remindAt), repeat },
        label: `Reminder set: ${title}, ⏰ ${prettyWhen(r.remindAt)}${repeat !== "none" ? ` (${repeat})` : ""}`,
      };
    }
    if (name === "add_to_shopping") {
      const n = str(a.name).slice(0, 80);
      if (!n) return { result: { error: "name missing" } };
      const p = ["urgent", "need", "maybe"].includes(str(a.priority)) ? (str(a.priority) as "need") : "need";
      await addShopping(db, spaceId, { name: n, priority: p });
      return { result: { ok: true }, label: `Added to shopping: ${n}` };
    }
    if (name === "log_expense") {
      const amount = Number(a.amount);
      if (!(amount > 0 && amount < 1_000_000)) return { result: { error: "amount must be positive" } };
      const cat = (MONEY_CATEGORY_KEYS as string[]).includes(str(a.category)) ? str(a.category) : "other";
      await logMoney(db, spaceId, { amount, category: cat, note: str(a.note).slice(0, 120) || null });
      return { result: { ok: true }, label: `Spent ${money(Math.round(amount * 100), currency)}, ${cat}` };
    }
    if (name === "remember" && str(a.kind) === "wish") {
      return runTool(db, spaceId, currency, "add_wish", { name: a.text });
    }
    if (name === "remember") {
      const text = str(a.text).slice(0, 200);
      const kind = ["like", "dislike", "goal", "date", "note"].includes(str(a.kind)) ? str(a.kind) : "note";
      if (!text) return { result: { error: "text missing" } };
      await db.insert(schema.aiMemory).values({ ownerId: spaceId, kind, text });
      return { result: { ok: true }, label: `Remembered (${kind}): ${text}` };
    }
    if (name === "forget") {
      const q = str(a.text);
      const [m] = q
        ? await db.select().from(schema.aiMemory).where(and(eq(schema.aiMemory.ownerId, spaceId), ilike(schema.aiMemory.text, `%${q}%`))).limit(1)
        : [];
      if (!m) return { result: { error: "no memory matches" } };
      await db.delete(schema.aiMemory).where(eq(schema.aiMemory.id, m.id));
      return { result: { ok: true, forgot: m.text }, label: `Forgot: ${m.text}` };
    }
    if (name === "complete_task") {
      const q = str(a.title);
      const t = schema.task;
      const [row] = q
        ? await db.select().from(t).where(and(eq(t.ownerId, spaceId), eq(t.done, false), ilike(t.title, `%${q}%`))).limit(1)
        : [];
      if (!row) return { result: { error: "no open task matches" } };
      await db.update(t).set({ done: true, doneAt: new Date() }).where(eq(t.id, row.id));
      await db
        .update(schema.reminder)
        .set({ done: true })
        .where(and(eq(schema.reminder.taskId, row.id), eq(schema.reminder.repeat, "none")));
      return { result: { ok: true, title: row.title }, label: `Done: ${row.title} ✅` };
    }
    if (name === "cancel_reminder") {
      const q = str(a.title);
      const r = schema.reminder;
      const [row] = q
        ? await db.select().from(r).where(and(eq(r.ownerId, spaceId), eq(r.done, false), ilike(r.title, `%${q}%`))).orderBy(asc(r.remindAt)).limit(1)
        : [];
      if (!row) return { result: { error: "no upcoming reminder matches" } };
      await db.delete(r).where(eq(r.id, row.id));
      return { result: { ok: true, title: row.title }, label: `Reminder cancelled: ${row.title}` };
    }
    if (name === "update_stuff") {
      const n = str(a.name).slice(0, 80);
      if (!n) return { result: { error: "name missing" } };
      const it = schema.item;
      const [row] = await db.select().from(it).where(and(eq(it.ownerId, spaceId), ilike(it.name, n))).limit(1);
      const fuzzy = row ?? (await db.select().from(it).where(and(eq(it.ownerId, spaceId), ilike(it.name, `%${n}%`))).limit(1))[0];
      const exp = isDate(str(a.expires_on)) ? str(a.expires_on) : undefined;
      const cat = (ITEM_CATEGORY_KEYS as string[]).includes(str(a.category)) ? str(a.category) : undefined;
      const loc = str(a.location).slice(0, 60) || undefined;
      const exact = Number.isInteger(a.quantity) ? Math.max(0, Number(a.quantity)) : undefined;
      const change = Number.isInteger(a.change) ? Number(a.change) : 0;
      if (!fuzzy) {
        const qty = exact ?? Math.max(change, 1);
        await db.insert(it).values({ ownerId: spaceId, name: n, category: cat ?? "other", quantity: qty, lowAt: 1, expiresOn: exp ?? null, location: loc ?? null });
        return { result: { ok: true, created: true, quantity: qty }, label: `Added to stuff: ${n} ×${qty}` };
      }
      const qty = Math.max(0, exact ?? fuzzy.quantity + change);
      await db
        .update(it)
        .set({ quantity: qty, expiresOn: exp ?? fuzzy.expiresOn, category: cat ?? fuzzy.category, location: loc ?? fuzzy.location, updatedAt: new Date() })
        .where(eq(it.id, fuzzy.id));
      if (qty <= fuzzy.lowAt && qty < fuzzy.quantity) await ensureOnList(db, spaceId, fuzzy.id, fuzzy.name, qty === 0 ? "urgent" : "need");
      return { result: { ok: true, name: fuzzy.name, quantity: qty }, label: `${fuzzy.name}: ${qty} left` };
    }
    const findCourse = async (q: string) => {
      if (!q) return null;
      const [c] = await db
        .select({ id: schema.course.id })
        .from(schema.course)
        .where(and(eq(schema.course.ownerId, spaceId), sql`(${schema.course.name} ilike ${"%" + q + "%"} or ${schema.course.code} ilike ${"%" + q + "%"})`))
        .limit(1);
      return c?.id ?? null;
    };
    if (name === "add_assignment") {
      const title = str(a.title).slice(0, 140);
      if (!title) return { result: { error: "title missing" } };
      const dueAt = isDate(str(a.due_date)) ? zonedToUtc(str(a.due_date), isTime(str(a.due_time)) ? str(a.due_time) : "23:59") : null;
      const [row] = await db
        .insert(schema.assignment)
        .values({ ownerId: spaceId, title, dueAt, courseId: await findCourse(str(a.course)) })
        .returning();
      await assignmentReminders(db, spaceId, { id: row.id, title, dueAt, done: false });
      return { result: { ok: true, due: dueAt ? prettyWhen(dueAt) : null }, label: `Assignment added: ${title}${dueAt ? `, due ${prettyWhen(dueAt)}` : ""}` };
    }
    if (name === "add_exam") {
      const title = str(a.title).slice(0, 140);
      if (!title || !isDate(str(a.date))) return { result: { error: "need title and date" } };
      const at = zonedToUtc(str(a.date), isTime(str(a.time)) ? str(a.time) : "09:00");
      const room = str(a.room).slice(0, 60) || null;
      const [row] = await db.insert(schema.exam).values({ ownerId: spaceId, title, at, room, courseId: await findCourse(str(a.course)) }).returning();
      await examReminders(db, spaceId, { id: row.id, title, at, room });
      return { result: { ok: true, when: prettyWhen(at) }, label: `Exam added: ${title}, ${prettyWhen(at)}` };
    }
    if (name === "log_habit") {
      const q = str(a.name);
      const [h] = q
        ? await db.select().from(schema.habit).where(and(eq(schema.habit.ownerId, spaceId), ilike(schema.habit.name, `%${q}%`))).limit(1)
        : [];
      if (!h) return { result: { error: "no habit matches" } };
      await db.insert(schema.habitLog).values({ habitId: h.id, ownerId: spaceId, day: todayISO() }).onConflictDoNothing();
      return { result: { ok: true, habit: h.name }, label: `${h.emoji} ${h.name} done today` };
    }
    if (name === "add_note") {
      const kind = str(a.kind) === "journal" ? "journal" : "note";
      const body = str(a.body).slice(0, 20000);
      if (!body) return { result: { error: "body missing" } };
      const mood = Number(a.mood);
      await db.insert(schema.note).values({
        ownerId: spaceId,
        kind,
        title: str(a.title).slice(0, 140) || (kind === "note" ? body.split("\n")[0].slice(0, 60) : ""),
        body,
        mood: kind === "journal" && mood >= 1 && mood <= 5 ? Math.round(mood) : null,
      });
      return { result: { ok: true }, label: kind === "journal" ? "Saved to your journal 💗" : `Note saved: ${str(a.title) || body.slice(0, 40)}` };
    }
    if (name === "add_bill") {
      const n = str(a.name).slice(0, 80);
      const amount = Number(a.amount);
      if (!n || !(amount > 0) || !isDate(str(a.next_due))) return { result: { error: "need name, amount and next_due" } };
      const cycle = ["monthly", "yearly", "weekly", "once"].includes(str(a.cycle)) ? str(a.cycle) : "monthly";
      const [b] = await db
        .insert(schema.bill)
        .values({ ownerId: spaceId, name: n, amountCents: Math.round(amount * 100), nextDue: str(a.next_due), cycle, kind: str(a.kind) === "subscription" ? "subscription" : "bill" })
        .returning();
      await billReminders(db, spaceId, b, currency);
      return { result: { ok: true }, label: `Bill added: ${n} ${money(b.amountCents, currency)}, due ${b.nextDue}` };
    }
    if (name === "add_wish") {
      const n = str(a.name).slice(0, 100);
      if (!n) return { result: { error: "name missing" } };
      const price = Number(a.price);
      const link = str(a.link);
      await db.insert(schema.wish).values({
        ownerId: spaceId,
        name: n,
        priceCents: price > 0 ? Math.round(price * 100) : null,
        priority: ["need", "want", "dream"].includes(str(a.priority)) ? str(a.priority) : "want",
        link: /^https?:\/\//i.test(link) ? link.slice(0, 500) : null,
      });
      return { result: { ok: true }, label: `Added to your wishlist: ${n} 🎁` };
    }
    if (name === "add_paper") {
      const title = str(a.title).slice(0, 120);
      if (!title) return { result: { error: "title missing" } };
      const kind = str(a.kind) === "application" ? "application" : "document";
      const cats = kind === "document" ? DOC_CATEGORIES : APP_CATEGORIES;
      const [row] = await db
        .insert(schema.paper)
        .values({
          ownerId: spaceId,
          kind,
          title,
          category: str(a.category) in cats ? str(a.category) : "other",
          org: str(a.org).slice(0, 100) || null,
          expiresOn: kind === "document" && isDate(str(a.expires_on)) ? str(a.expires_on) : null,
          deadlineOn: kind === "application" && isDate(str(a.deadline_on)) ? str(a.deadline_on) : null,
        })
        .returning();
      await paperReminders(db, spaceId, row);
      return { result: { ok: true }, label: `Added to Papers: ${title} 🗂️` };
    }
    if (name === "add_debt") {
      const person = str(a.person).slice(0, 60);
      const amount = Math.round(Number(a.amount) * 100);
      if (!person || !(amount > 0)) return { result: { error: "person or amount missing" } };
      const [row] = await db
        .insert(schema.debt)
        .values({
          ownerId: spaceId,
          person,
          amountCents: amount,
          direction: str(a.direction) === "i_owe" ? "i_owe" : "owes_me",
          note: str(a.note).slice(0, 200) || null,
          dueOn: isDate(str(a.due_on)) ? str(a.due_on) : null,
        })
        .returning();
      await debtReminders(db, spaceId, row, currency);
      return { result: { ok: true }, label: row.direction === "i_owe" ? `Noted: you owe ${person} ${money(amount, currency)} 🤝` : `Noted: ${person} owes you ${money(amount, currency)} 🤝` };
    }
    if (name === "add_flashcards") {
      const deckName = str(a.deck).slice(0, 80);
      const cards = (Array.isArray(a.cards) ? a.cards : [])
        .map((c: { front?: unknown; back?: unknown }) => ({ front: String(c?.front ?? "").trim().slice(0, 500), back: String(c?.back ?? "").trim().slice(0, 1500) }))
        .filter((c: { front: string; back: string }) => c.front && c.back)
        .slice(0, 40);
      if (!deckName || !cards.length) return { result: { error: "deck name or cards missing" } };
      const kind = ["flashcards", "quiz", "midterm", "pastyear", "practice"].includes(str(a.kind)) ? str(a.kind) : "flashcards";
      const [d] = await db.insert(schema.deck).values({ ownerId: spaceId, name: deckName, kind }).returning();
      await db.insert(schema.card).values(cards.map((c: { front: string; back: string }) => ({ ownerId: spaceId, deckId: d.id, ...c })));
      return { result: { ok: true, cards: cards.length }, label: `Made ${cards.length} cards in "${deckName}" 🧠` };
    }
    if (name === "add_learning") {
      const title = str(a.title).slice(0, 120);
      if (!title) return { result: { error: "title missing" } };
      const kinds = ["goal", "course", "book", "article", "video", "skill", "certificate", "resource"];
      const kind = kinds.includes(str(a.kind)) ? str(a.kind) : "goal";
      const link = str(a.link);
      await db.insert(schema.learning).values({
        ownerId: spaceId,
        kind,
        title,
        link: /^https?:\/\//i.test(link) ? link.slice(0, 500) : null,
        notes: str(a.roadmap).slice(0, 5000) || null,
        status: kind === "certificate" ? "done" : "doing",
        progress: kind === "certificate" ? 100 : 0,
        level: kind === "skill" ? 1 : null,
      });
      return { result: { ok: true }, label: `Added to Learning: ${title} 🎓` };
    }
    if (name === "add_savings_goal") {
      const n = str(a.name).slice(0, 60);
      const target = Math.round(Number(a.target) * 100);
      if (!n || !(target > 0)) return { result: { error: "name or target missing" } };
      await db.insert(schema.savingsGoal).values({ ownerId: spaceId, name: n, targetCents: target, emoji: str(a.emoji).slice(0, 4) || "🐷", dueOn: isDate(str(a.due_on)) ? str(a.due_on) : null });
      return { result: { ok: true }, label: `New savings goal: ${n} ${money(target, currency)} 🐷` };
    }
    if (name === "add_recipe") {
      const title = str(a.title).slice(0, 100);
      const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
      if (!title) return { result: { error: "title missing" } };
      const minutes = Number(a.minutes);
      await db.insert(schema.recipe).values({
        ownerId: spaceId,
        title,
        emoji: str(a.emoji).slice(0, 8) || "🍳",
        ingredients: list(a.ingredients).join("\n").slice(0, 4000),
        steps: list(a.steps).join("\n").slice(0, 8000),
        minutes: minutes > 0 && minutes < 1000 ? Math.round(minutes) : null,
      });
      return { result: { ok: true }, label: `Recipe saved: ${title}` };
    }
    if (name === "add_countdown") {
      const title = str(a.title).slice(0, 80);
      const day = str(a.date);
      if (!title || !isDate(day)) return { result: { error: "need title and date" } };
      const emoji = str(a.emoji).slice(0, 8) || "🎉";
      await db.insert(schema.countdown).values({ ownerId: spaceId, title, day, emoji, yearly: a.yearly === true });
      return { result: { ok: true }, label: `Countdown added: ${emoji} ${title}, ${day}` };
    }
    if (name === "add_bucket") {
      const title = str(a.title).slice(0, 120);
      if (!title) return { result: { error: "title missing" } };
      await db.insert(schema.bucket).values({ ownerId: spaceId, title, emoji: str(a.emoji).slice(0, 8) || "✨", addedBy: spaceId });
      return { result: { ok: true }, label: `Added to your bucket list: ${title} ✨` };
    }
    if (name === "add_happy_memory") {
      const text = str(a.text).slice(0, 400);
      if (!text) return { result: { error: "text missing" } };
      await db.insert(schema.jarNote).values({ ownerId: spaceId, fromUserId: spaceId, text, emoji: str(a.emoji).slice(0, 8) || "⭐", day: todayISO() });
      return { result: { ok: true }, label: `Into your happy jar: ${text.slice(0, 50)} ⭐` };
    }
    if (name === "plan_meal") {
      const day = str(a.date);
      const slot = str(a.slot);
      const text = str(a.text).slice(0, 100);
      if (!isDate(day) || !["breakfast", "lunch", "dinner", "snack"].includes(slot) || !text) return { result: { error: "need date, slot, text" } };
      await db
        .insert(schema.mealPlan)
        .values({ ownerId: spaceId, day, slot, text })
        .onConflictDoUpdate({ target: [schema.mealPlan.ownerId, schema.mealPlan.day, schema.mealPlan.slot], set: { text } });
      return { result: { ok: true }, label: `Meal plan: ${text} for ${slot}, ${day}` };
    }
    return { result: { error: "unknown tool" } };
  } catch (e) {
    return { result: { error: (e as Error).message } };
  }
}

export type ChatTurn = { role: "user" | "model"; text: string };

/** House style: no middle dots or dashes anywhere. */
export function tidy(text: string): string {
  return text
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/^\s*[-*]\s+/gm, "🌼 ")
    .replace(/,\s*,/g, ",")
    .trim();
}

export { snapshot, forViewer };

/** Look through the long text she saved (notes, recipes, cards...). */
async function searchDanchi(db: Db, spaceId: string, q: string) {
  const term = q.trim().slice(0, 60);
  if (!term) return { error: "query missing" };
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const cut = (t: string | null | undefined, n = 600) => (t ?? "").slice(0, n);
  const [notes, recipes, cards, papers, learning, projects, items] = await Promise.all([
    db
      .select()
      .from(schema.note)
      .where(and(eq(schema.note.ownerId, spaceId), or(ilike(schema.note.title, like), ilike(schema.note.body, like))))
      .orderBy(desc(schema.note.createdAt))
      .limit(6),
    db
      .select()
      .from(schema.recipe)
      .where(and(eq(schema.recipe.ownerId, spaceId), or(ilike(schema.recipe.title, like), ilike(schema.recipe.ingredients, like))))
      .limit(4),
    db
      .select({ front: schema.card.front, back: schema.card.back })
      .from(schema.card)
      .where(and(eq(schema.card.ownerId, spaceId), or(ilike(schema.card.front, like), ilike(schema.card.back, like))))
      .limit(8),
    db
      .select()
      .from(schema.paper)
      .where(and(eq(schema.paper.ownerId, spaceId), or(ilike(schema.paper.title, like), ilike(schema.paper.notes, like), ilike(schema.paper.org, like))))
      .limit(5),
    db
      .select()
      .from(schema.learning)
      .where(and(eq(schema.learning.ownerId, spaceId), or(ilike(schema.learning.title, like), ilike(schema.learning.notes, like))))
      .limit(5),
    db
      .select()
      .from(schema.project)
      .where(and(eq(schema.project.ownerId, spaceId), or(ilike(schema.project.name, like), ilike(schema.project.description, like))))
      .limit(5),
    db
      .select()
      .from(schema.item)
      .where(and(eq(schema.item.ownerId, spaceId), or(ilike(schema.item.name, like), ilike(schema.item.notes, like), ilike(schema.item.brand, like))))
      .limit(8),
  ]);
  const found = {
    notes: notes.map((n) => ({ kind: n.kind, title: n.title, written: n.createdAt.toISOString().slice(0, 10), text: cut(n.body, 1500) })),
    recipes: recipes.map((r) => ({ title: r.title, minutes: r.minutes, ingredients: cut(r.ingredients, 1200), steps: cut(r.steps, 2000) })),
    flashcards: cards,
    papers: papers.map((p) => ({ title: p.title, kind: p.kind, org: p.org, status: p.status, expires: p.expiresOn, deadline: p.deadlineOn, notes: cut(p.notes) })),
    learning: learning.map((l) => ({ title: l.title, status: l.status, progress: l.progress, notes: cut(l.notes) })),
    projects: projects.map((p) => ({ name: p.name, status: p.status, due: p.dueOn, about: cut(p.description) })),
    stuff: items.map((i) => ({ name: i.name, qty: i.quantity, where: i.location, brand: i.brand, notes: cut(i.notes, 300) })),
  };
  const total = Object.values(found).reduce((a, v) => a + v.length, 0);
  return total ? found : { nothing_found: true, tip: "Try another word, or tell her it isn't saved yet." };
}

/**
 * A short, warm good-morning note for the daily summary.
 * Returns null when AI isn't set up or anything goes wrong (the template is used instead).
 */
export async function morningNote(db: Db, spaceId: string, ownerName: string): Promise<string | null> {
  if (!aiConfigured()) return null;
  try {
    const data = await snapshot(db, spaceId);
    const prompt = `Write ${ownerName}'s good-morning message from Chichi (a tiny cute peach mascot) for today. 2-3 short sentences, max 45 words, English, warm and specific: mention the most important thing today (a task, reminder, or something expiring), and if it fits, one wish/goal/like from chichi_remembers or an idea to use food that's expiring. One emoji max. Never use dashes or the · character. No greeting like "Good morning" (it's already in the title). Reply with the message only. DATA: ${JSON.stringify(data)}`;
    const text = await askOnce([{ text: prompt }], { maxTokens: 300, temperature: 0.9 });
    return text ? tidy(text).slice(0, 400) : null;
  } catch (e) {
    console.error("[ai] morning note", (e as Error).message);
  }
  return null;
}
