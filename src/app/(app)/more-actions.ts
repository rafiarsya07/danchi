"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/session";
import { MONEY_CATEGORY_KEYS } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";
import {
  addShopping,
  assignmentReminders,
  billReminders,
  examReminders,
  habitReminder,
  logMoney,
  matchIngredients,
  nextDueDate,
  scheduleCard,
} from "@/server/mutations";
import type { ActionResult } from "./actions";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const opt = (f: FormData, k: string, max = 200) => str(f, k, max) || null;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: string) => /^\d{2}:\d{2}$/.test(v);
const fail = (error: string): ActionResult => ({ ok: false, error });
const uuidOrNull = (v: string) => (/^[0-9a-f-]{36}$/i.test(v) ? v : null);
const COLORS = ["peach", "sun", "mint", "sky", "lilac", "pink"];

/* ================= Study ================= */

export async function addCourse(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 80);
  if (!name) return fail("Give the course a name");
  await db.insert(S.course).values({
    ownerId: me.spaceId,
    name,
    code: opt(f, "code", 20),
    color: COLORS.includes(str(f, "color")) ? str(f, "color") : "sky",
    semester: opt(f, "semester", 40),
    lecturer: opt(f, "lecturer", 80),
    room: opt(f, "room", 40),
    schedule: opt(f, "schedule", 120),
  });
  refresh();
  return { ok: true };
}

export async function archiveCourse(id: string) {
  const me = await requireOwner();
  await db
    .update(S.course)
    .set({ archived: sql`not ${S.course.archived}` })
    .where(and(eq(S.course.id, id), eq(S.course.ownerId, me.spaceId)));
  refresh();
}

export async function addAssignment(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const title = str(f, "title", 140);
  if (!title) return fail("What's the assignment?");
  const date = str(f, "date");
  const time = str(f, "time") || "23:59";
  const dueAt = isDate(date) ? zonedToUtc(date, isTime(time) ? time : "23:59") : null;
  const [row] = await db
    .insert(S.assignment)
    .values({ ownerId: me.spaceId, title, courseId: uuidOrNull(str(f, "courseId")), dueAt, weight: opt(f, "weight", 30), notes: opt(f, "notes", 500) })
    .returning();
  await assignmentReminders(db, me.spaceId, { id: row.id, title, dueAt, done: false });
  refresh();
  return { ok: true };
}

export async function setAssignmentStatus(id: string, status: "todo" | "doing" | "done") {
  const me = await requireOwner();
  const [row] = await db
    .update(S.assignment)
    .set({ status, doneAt: status === "done" ? new Date() : null })
    .where(and(eq(S.assignment.id, id), eq(S.assignment.ownerId, me.spaceId)))
    .returning();
  if (row) await assignmentReminders(db, me.spaceId, { id: row.id, title: row.title, dueAt: row.dueAt, done: status === "done" });
  refresh();
}

export async function deleteAssignment(id: string) {
  const me = await requireOwner();
  await db.delete(S.assignment).where(and(eq(S.assignment.id, id), eq(S.assignment.ownerId, me.spaceId)));
  refresh();
}

export async function addExam(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const title = str(f, "title", 140);
  const date = str(f, "date");
  const time = str(f, "time") || "09:00";
  if (!title) return fail("Which exam?");
  if (!isDate(date)) return fail("Pick the exam day");
  const at = zonedToUtc(date, isTime(time) ? time : "09:00");
  const room = opt(f, "room", 60);
  const [row] = await db
    .insert(S.exam)
    .values({ ownerId: me.spaceId, title, courseId: uuidOrNull(str(f, "courseId")), at, room, notes: opt(f, "notes", 500) })
    .returning();
  await examReminders(db, me.spaceId, { id: row.id, title, at, room });
  refresh();
  return { ok: true };
}

export async function deleteExam(id: string) {
  const me = await requireOwner();
  await db.delete(S.exam).where(and(eq(S.exam.id, id), eq(S.exam.ownerId, me.spaceId)));
  refresh();
}

export async function addDeck(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 80);
  if (!name) return fail("Name the deck");
  const kind = ["flashcards", "quiz", "midterm", "pastyear", "practice"].includes(str(f, "kind")) ? str(f, "kind") : "flashcards";
  await db.insert(S.deck).values({ ownerId: me.spaceId, name, kind, year: opt(f, "year", 10), courseId: uuidOrNull(str(f, "courseId")) });
  refresh();
  return { ok: true };
}

export async function deleteDeck(id: string) {
  const me = await requireOwner();
  await db.delete(S.deck).where(and(eq(S.deck.id, id), eq(S.deck.ownerId, me.spaceId)));
  refresh();
  redirect("/study?tab=cards");
}

export async function addCard(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const deckId = uuidOrNull(str(f, "deckId"));
  const front = str(f, "front", 500);
  const back = str(f, "back", 1000);
  if (!deckId || !front || !back) return fail("Fill both sides of the card");
  const [d] = await db.select({ id: S.deck.id }).from(S.deck).where(and(eq(S.deck.id, deckId), eq(S.deck.ownerId, me.spaceId))).limit(1);
  if (!d) return fail("Deck not found");
  await db.insert(S.card).values({ ownerId: me.spaceId, deckId, front, back });
  refresh();
  return { ok: true };
}

export async function deleteCard(id: string) {
  const me = await requireOwner();
  await db.delete(S.card).where(and(eq(S.card.id, id), eq(S.card.ownerId, me.spaceId)));
  refresh();
}

export async function reviewCard(id: string, grade: 0 | 1 | 2 | 3) {
  const me = await requireOwner();
  const [c] = await db.select().from(S.card).where(and(eq(S.card.id, id), eq(S.card.ownerId, me.spaceId))).limit(1);
  if (!c) return;
  await db.update(S.card).set(scheduleCard(c, grade)).where(eq(S.card.id, id));
}

/* ================= Habits ================= */

export async function addHabit(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 60);
  if (!name) return fail("Name the habit");
  const per = Math.min(7, Math.max(1, Number(f.get("perWeek")) || 7));
  const remindTime = isTime(str(f, "remindTime")) ? str(f, "remindTime") : null;
  const [h] = await db
    .insert(S.habit)
    .values({ ownerId: me.spaceId, name, emoji: str(f, "emoji", 8) || "🌱", color: COLORS.includes(str(f, "color")) ? str(f, "color") : "mint", perWeek: per, remindTime })
    .returning();
  await habitReminder(db, me.spaceId, h);
  refresh();
  return { ok: true };
}

export async function toggleHabitDay(habitId: string, day: string) {
  const me = await requireOwner();
  if (!isDate(day) || day > todayISO()) return;
  const [h] = await db.select({ id: S.habit.id }).from(S.habit).where(and(eq(S.habit.id, habitId), eq(S.habit.ownerId, me.spaceId))).limit(1);
  if (!h) return;
  const del = await db
    .delete(S.habitLog)
    .where(and(eq(S.habitLog.habitId, habitId), eq(S.habitLog.day, day)))
    .returning();
  if (del.length === 0) await db.insert(S.habitLog).values({ habitId, ownerId: me.spaceId, day });
  refresh();
}

export async function archiveHabit(id: string) {
  const me = await requireOwner();
  const [h] = await db
    .update(S.habit)
    .set({ archived: sql`not ${S.habit.archived}` })
    .where(and(eq(S.habit.id, id), eq(S.habit.ownerId, me.spaceId)))
    .returning();
  if (h) await habitReminder(db, me.spaceId, h);
  refresh();
}

export async function deleteHabit(id: string) {
  const me = await requireOwner();
  await db.delete(S.habit).where(and(eq(S.habit.id, id), eq(S.habit.ownerId, me.spaceId)));
  refresh();
}

/* ================= Notes & journal ================= */

export async function addNote(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const kind = str(f, "kind") === "journal" ? "journal" : "note";
  const title = str(f, "title", 140);
  const body = str(f, "body", 20000);
  if (!title && !body) return fail("Write something first ✍️");
  const mood = Number(f.get("mood"));
  await db.insert(S.note).values({
    ownerId: me.spaceId,
    kind,
    title: title || (kind === "journal" ? "" : body.split("\n")[0].slice(0, 60)),
    body,
    mood: kind === "journal" && mood >= 1 && mood <= 5 ? mood : null,
    tags: opt(f, "tags", 120),
    private: f.get("private") === "on",
    projectId: uuidOrNull(str(f, "projectId")),
    courseId: uuidOrNull(str(f, "courseId")),
  });
  refresh();
  return { ok: true };
}

export async function saveNote(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = uuidOrNull(str(f, "id"));
  if (!id) return fail("Note not found");
  await db
    .update(S.note)
    .set({
      title: str(f, "title", 140),
      body: str(f, "body", 20000),
      tags: opt(f, "tags", 120),
      pinned: f.get("pinned") === "on",
      private: f.get("private") === "on",
      updatedAt: new Date(),
    })
    .where(and(eq(S.note.id, id), eq(S.note.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

export async function deleteNote(id: string) {
  const me = await requireOwner();
  await db.delete(S.note).where(and(eq(S.note.id, id), eq(S.note.ownerId, me.spaceId)));
  refresh();
  redirect("/notes");
}

/* ================= Kitchen ================= */

export async function addRecipe(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const title = str(f, "title", 100);
  if (!title) return fail("Name the recipe");
  const minutes = Number(f.get("minutes"));
  const [r] = await db
    .insert(S.recipe)
    .values({
      ownerId: me.spaceId,
      title,
      emoji: str(f, "emoji", 8) || "🍳",
      ingredients: str(f, "ingredients", 4000),
      steps: str(f, "steps", 8000),
      minutes: minutes > 0 && minutes < 1000 ? Math.round(minutes) : null,
      tags: opt(f, "tags", 120),
    })
    .returning();
  refresh();
  redirect(`/kitchen/${r.id}`);
}

export async function toggleFavorite(id: string) {
  const me = await requireOwner();
  await db
    .update(S.recipe)
    .set({ favorite: sql`not ${S.recipe.favorite}` })
    .where(and(eq(S.recipe.id, id), eq(S.recipe.ownerId, me.spaceId)));
  refresh();
}

export async function deleteRecipe(id: string) {
  const me = await requireOwner();
  await db.delete(S.recipe).where(and(eq(S.recipe.id, id), eq(S.recipe.ownerId, me.spaceId)));
  refresh();
  redirect("/kitchen");
}

/** Put what's missing for a recipe on the shopping list. */
export async function shopMissing(recipeId: string) {
  const me = await requireOwner();
  const [r] = await db.select().from(S.recipe).where(and(eq(S.recipe.id, recipeId), eq(S.recipe.ownerId, me.spaceId))).limit(1);
  if (!r) return 0;
  const food = await db
    .select({ name: S.item.name })
    .from(S.item)
    .where(and(eq(S.item.ownerId, me.spaceId), eq(S.item.category, "food"), sql`${S.item.quantity} > 0`));
  const missing = matchIngredients(r.ingredients, food.map((x) => x.name)).filter((x) => !x.have);
  for (const m of missing) await addShopping(db, me.spaceId, { name: m.line.slice(0, 80), priority: "need" });
  refresh();
  return missing.length;
}

const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

export async function setMeal(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const day = str(f, "day");
  const slot = str(f, "slot");
  const text = str(f, "text", 100);
  if (!isDate(day) || !SLOTS.includes(slot)) return fail("Pick a day and meal");
  if (!text) {
    await db.delete(S.mealPlan).where(and(eq(S.mealPlan.ownerId, me.spaceId), eq(S.mealPlan.day, day), eq(S.mealPlan.slot, slot)));
  } else {
    const [match] = await db
      .select({ id: S.recipe.id })
      .from(S.recipe)
      .where(and(eq(S.recipe.ownerId, me.spaceId), sql`lower(${S.recipe.title}) = lower(${text})`))
      .limit(1);
    await db
      .insert(S.mealPlan)
      .values({ ownerId: me.spaceId, day, slot, text, recipeId: match?.id ?? null })
      .onConflictDoUpdate({ target: [S.mealPlan.ownerId, S.mealPlan.day, S.mealPlan.slot], set: { text, recipeId: match?.id ?? null } });
  }
  refresh();
  return { ok: true };
}

/* ================= Bills & subscriptions ================= */

export async function addBill(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 80);
  const amount = Number(f.get("amount"));
  const nextDue = str(f, "nextDue");
  if (!name) return fail("What's the bill?");
  if (!(amount > 0)) return fail("How much is it?");
  if (!isDate(nextDue)) return fail("When is it due next?");
  const cycle = ["weekly", "monthly", "yearly", "once"].includes(str(f, "cycle")) ? str(f, "cycle") : "monthly";
  const before = Math.min(14, Math.max(0, Number(f.get("remindDaysBefore")) || 2));
  const [b] = await db
    .insert(S.bill)
    .values({
      ownerId: me.spaceId,
      name,
      kind: str(f, "kind") === "subscription" ? "subscription" : "bill",
      amountCents: Math.round(amount * 100),
      category: (MONEY_CATEGORY_KEYS as string[]).includes(str(f, "category")) ? str(f, "category") : "bills",
      cycle,
      nextDue,
      remindDaysBefore: before,
    })
    .returning();
  await billReminders(db, me.spaceId, b);
  refresh();
  return { ok: true };
}

/** Paid: log the expense and move the bill to its next due date. */
export async function payBill(id: string) {
  const me = await requireOwner();
  const [b] = await db.select().from(S.bill).where(and(eq(S.bill.id, id), eq(S.bill.ownerId, me.spaceId))).limit(1);
  if (!b) return;
  await logMoney(db, me.spaceId, { amount: b.amountCents / 100, category: b.category, note: b.name });
  const next = nextDueDate(b.nextDue, b.cycle);
  const [u] = await db
    .update(S.bill)
    .set(next ? { nextDue: next } : { active: false })
    .where(eq(S.bill.id, id))
    .returning();
  await billReminders(db, me.spaceId, u);
  refresh();
}

export async function toggleBill(id: string) {
  const me = await requireOwner();
  const [u] = await db
    .update(S.bill)
    .set({ active: sql`not ${S.bill.active}` })
    .where(and(eq(S.bill.id, id), eq(S.bill.ownerId, me.spaceId)))
    .returning();
  if (u) await billReminders(db, me.spaceId, u);
  refresh();
}

export async function deleteBill(id: string) {
  const me = await requireOwner();
  await db.delete(S.bill).where(and(eq(S.bill.id, id), eq(S.bill.ownerId, me.spaceId)));
  refresh();
}

/* ================= Projects ================= */

export async function addProject(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 80);
  if (!name) return fail("Name the project");
  const due = str(f, "dueOn");
  const [p] = await db
    .insert(S.project)
    .values({
      ownerId: me.spaceId,
      name,
      emoji: str(f, "emoji", 8) || "📁",
      color: COLORS.includes(str(f, "color")) ? str(f, "color") : "sun",
      dueOn: isDate(due) ? due : null,
      description: opt(f, "description", 500),
    })
    .returning();
  refresh();
  redirect(`/projects/${p.id}`);
}

export async function setProjectStatus(id: string, status: "active" | "paused" | "done") {
  const me = await requireOwner();
  await db.update(S.project).set({ status }).where(and(eq(S.project.id, id), eq(S.project.ownerId, me.spaceId)));
  refresh();
}

export async function deleteProject(id: string) {
  const me = await requireOwner();
  await db.delete(S.project).where(and(eq(S.project.id, id), eq(S.project.ownerId, me.spaceId)));
  refresh();
  redirect("/projects");
}

export async function addProjectTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const projectId = uuidOrNull(str(f, "projectId"));
  const title = str(f, "title", 140);
  if (!projectId || !title) return fail("What needs doing?");
  const due = str(f, "dueOn");
  await db.insert(S.task).values({ ownerId: me.spaceId, title, projectId, dueOn: isDate(due) ? due : null });
  refresh();
  return { ok: true };
}

export async function addProjectExpense(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const projectId = uuidOrNull(str(f, "projectId"));
  const amount = Number(f.get("amount"));
  if (!projectId || !(amount > 0)) return fail("How much?");
  await db.insert(S.transaction).values({
    ownerId: me.spaceId,
    amountCents: Math.round(amount * 100),
    category: "other",
    note: opt(f, "note", 120),
    projectId,
    occurredOn: todayISO(),
  });
  refresh();
  return { ok: true };
}

/* ================= Wishlist ================= */

export async function addWish(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 100);
  if (!name) return fail("What do you wish for?");
  const price = Number(f.get("price"));
  const link = str(f, "link", 500);
  await db.insert(S.wish).values({
    ownerId: me.spaceId,
    name,
    priceCents: price > 0 ? Math.round(price * 100) : null,
    link: /^https?:\/\//i.test(link) ? link : null,
    priority: ["dream", "want", "need"].includes(str(f, "priority")) ? str(f, "priority") : "want",
    note: opt(f, "note", 300),
  });
  refresh();
  return { ok: true };
}

export async function gotWish(id: string) {
  const me = await requireOwner();
  await db
    .update(S.wish)
    .set({ got: sql`not ${S.wish.got}`, gotAt: sql`case when ${S.wish.got} then null else now() end` })
    .where(and(eq(S.wish.id, id), eq(S.wish.ownerId, me.spaceId)));
  refresh();
}

export async function deleteWish(id: string) {
  const me = await requireOwner();
  await db.delete(S.wish).where(and(eq(S.wish.id, id), eq(S.wish.ownerId, me.spaceId)));
  refresh();
}
