"use server";

/**
 * v0.8 actions: item details, shopping budget, savings goals, learning,
 * course revision checklist, project team / links / checklist, home cards,
 * and Chichi reading files.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/session";
import { ITEM_CATEGORY_KEYS } from "@/lib/constants";
import { addDaysISO, todayISO } from "@/lib/format";
import { aiConfigured } from "@/server/ai";
import { questionsFromFile, READABLE, summarizeFile } from "@/server/ai-files";
import type { ActionResult } from "./actions";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const opt = (f: FormData, k: string, max = 200) => str(f, k, max) || null;
const date = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? str(f, k) : null);
const int = (f: FormData, k: string, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(f.get(k)));
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
};
const cents = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) : null;
};
const fail = (error: string): ActionResult => ({ ok: false, error });
const url = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);

/* ================= Stuff: full details ================= */

export async function saveItem(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const name = str(f, "name", 80);
  if (!name) return fail("Give it a name");
  const category = (ITEM_CATEGORY_KEYS as string[]).includes(str(f, "category")) ? str(f, "category") : "other";
  await db
    .update(S.item)
    .set({
      name,
      category,
      kind: opt(f, "kind", 30),
      brand: opt(f, "brand", 60),
      location: opt(f, "location", 60),
      quantity: int(f, "quantity", 0, 9999, 1),
      lowAt: int(f, "lowAt", 0, 9999, 1),
      expiresOn: date(f, "expiresOn"),
      boughtOn: date(f, "boughtOn"),
      priceCents: cents(f, "price"),
      notes: opt(f, "notes", 500),
      updatedAt: new Date(),
    })
    .where(and(eq(S.item.id, id), eq(S.item.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

export async function deleteItemAndBack(id: string) {
  const me = await requireOwner();
  await db.delete(S.item).where(and(eq(S.item.id, id), eq(S.item.ownerId, me.spaceId)));
  refresh();
  redirect("/stuff");
}

/* ================= Shopping budget ================= */

export async function setShopBudget(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const v = Number(str(f, "amount"));
  const c = Number.isFinite(v) && v >= 0 && v < 10_000_000 ? Math.round(v * 100) : 0;
  await db
    .insert(S.settings)
    .values({ ownerId: me.spaceId, shopBudgetCents: c })
    .onConflictDoUpdate({ target: S.settings.ownerId, set: { shopBudgetCents: c } });
  refresh();
  return { ok: true };
}

/* ================= Savings goals ================= */

export async function addGoal(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const name = str(f, "name", 60);
  const target = cents(f, "target");
  if (!name || !target) return fail("What are you saving for, and how much?");
  await db.insert(S.savingsGoal).values({ ownerId: me.spaceId, name, emoji: str(f, "emoji", 8) || "🐷", targetCents: target, dueOn: date(f, "dueOn") });
  refresh();
  return { ok: true };
}

export async function addToGoal(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const sign = str(f, "dir") === "out" ? -1 : 1;
  const amount = cents(f, "amount");
  if (!amount) return fail("How much?");
  await db
    .update(S.savingsGoal)
    .set({ savedCents: sql`greatest(0, ${S.savingsGoal.savedCents} + ${sign * amount})` })
    .where(and(eq(S.savingsGoal.id, id), eq(S.savingsGoal.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

export async function deleteGoal(id: string) {
  const me = await requireOwner();
  await db.delete(S.savingsGoal).where(and(eq(S.savingsGoal.id, id), eq(S.savingsGoal.ownerId, me.spaceId)));
  refresh();
}

/* ================= Learning ================= */

const KINDS = ["goal", "course", "book", "article", "video", "skill", "certificate", "resource"];

export async function addLearning(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const title = str(f, "title", 120);
  if (!title) return fail("What do you want to learn?");
  const kind = KINDS.includes(str(f, "kind")) ? str(f, "kind") : "goal";
  await db.insert(S.learning).values({
    ownerId: me.spaceId,
    kind,
    title,
    link: url(opt(f, "link", 500)),
    status: kind === "certificate" ? "done" : str(f, "status") === "want" ? "want" : "doing",
    progress: kind === "certificate" ? 100 : 0,
    level: kind === "skill" ? int(f, "level", 1, 5, 1) : null,
    dueOn: date(f, "dueOn"),
  });
  refresh();
  return { ok: true };
}

export async function saveLearning(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const title = str(f, "title", 120);
  if (!title) return fail("Give it a name");
  const progress = int(f, "progress", 0, 100, 0);
  const status = ["want", "doing", "done"].includes(str(f, "status")) ? str(f, "status") : "doing";
  await db
    .update(S.learning)
    .set({
      title,
      link: url(opt(f, "link", 500)),
      status: progress >= 100 ? "done" : status,
      progress: status === "done" ? 100 : progress,
      level: f.get("level") ? int(f, "level", 1, 5, 1) : null,
      notes: opt(f, "notes", 20000),
      dueOn: date(f, "dueOn"),
      updatedAt: new Date(),
    })
    .where(and(eq(S.learning.id, id), eq(S.learning.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

export async function bumpProgress(id: string, by: number) {
  const me = await requireOwner();
  await db
    .update(S.learning)
    .set({
      progress: sql`least(100, greatest(0, ${S.learning.progress} + ${by}))`,
      status: sql`case when ${S.learning.progress} + ${by} >= 100 then 'done' else 'doing' end`,
      updatedAt: new Date(),
    })
    .where(and(eq(S.learning.id, id), eq(S.learning.ownerId, me.spaceId)));
  refresh();
}

export async function deleteLearning(id: string) {
  const me = await requireOwner();
  await db.delete(S.learning).where(and(eq(S.learning.id, id), eq(S.learning.ownerId, me.spaceId)));
  refresh();
  redirect("/learn");
}

export async function logLearning(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const minutes = int(f, "minutes", 1, 1440, 0);
  if (!minutes) return fail("How many minutes?");
  const lid = str(f, "learningId", 40);
  await db.insert(S.learningLog).values({
    ownerId: me.spaceId,
    learningId: /^[0-9a-f-]{36}$/i.test(lid) ? lid : null,
    day: todayISO(),
    minutes,
    note: opt(f, "note", 300),
  });
  refresh();
  return { ok: true };
}

/* ================= Little lists (course revision, project checklist, team, links) ================= */

type ListTable = "course" | "project";
type ListField = "checklist" | "team" | "links";

async function editList(table: ListTable, id: string, field: ListField, fn: (l: Record<string, unknown>[]) => Record<string, unknown>[]) {
  const me = await requireOwner();
  const t = table === "course" ? S.course : S.project;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.ownerId, me.spaceId)))
    .limit(1);
  if (!row) return;
  const current = ((row as Record<string, unknown>)[field] as Record<string, unknown>[]) ?? [];
  await db
    .update(t)
    .set({ [field]: fn(current).slice(0, 60) })
    .where(eq(t.id, id));
  refresh();
}

export async function addListItem(_: ActionResult, f: FormData): Promise<ActionResult> {
  const table = str(f, "table") === "course" ? "course" : "project";
  const field = (["checklist", "team", "links"] as const).find((x) => x === str(f, "field")) ?? "checklist";
  const id = str(f, "id", 40);
  if (field === "checklist") {
    const t = str(f, "t", 140);
    if (!t) return fail("Write a step");
    await editList(table, id, field, (l) => [...l, { t, done: false }]);
  } else if (field === "team") {
    const name = str(f, "name", 60);
    if (!name) return fail("Who?");
    await editList(table, id, field, (l) => [...l, { name, role: str(f, "role", 60) || undefined, contact: str(f, "contact", 80) || undefined }]);
  } else {
    const link = url(opt(f, "url", 500));
    if (!link) return fail("Paste a link starting with https://");
    await editList(table, id, field, (l) => [...l, { title: str(f, "title", 80) || link.replace(/^https?:\/\//, "").slice(0, 40), url: link }]);
  }
  return { ok: true };
}

export async function toggleListItem(table: ListTable, id: string, i: number) {
  await editList(table, id, "checklist", (l) => l.map((c, j) => (j === i ? { ...c, done: !c.done } : c)));
}

export async function removeListItem(table: ListTable, id: string, field: ListField, i: number) {
  await editList(table, id, field, (l) => l.filter((_, j) => j !== i));
}

/* ================= Home cards ================= */

export async function saveHomeCards(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const shown = new Set(f.getAll("show").map(String));
  const all = f.getAll("all").map(String);
  const hidden = all.filter((k) => !shown.has(k));
  await db
    .insert(S.settings)
    .values({ ownerId: me.spaceId, homeHidden: hidden })
    .onConflictDoUpdate({ target: S.settings.ownerId, set: { homeHidden: hidden } });
  refresh();
  return { ok: true };
}

/* ================= Chichi reads a file ================= */

async function readableFile(fileId: string) {
  const me = await requireOwner();
  const [f] = await db
    .select()
    .from(S.file)
    .where(and(eq(S.file.id, fileId), eq(S.file.ownerId, me.spaceId)))
    .limit(1);
  if (!f) throw new Error("File not found");
  if (!READABLE.has(f.mime)) throw new Error("Chichi can read PDFs, photos and text files");
  if (!aiConfigured()) throw new Error("Chichi's brain isn't plugged in yet");
  return { me, f };
}

export async function summarizeAttachment(fileId: string): Promise<{ ok: boolean; error?: string; noteId?: string }> {
  try {
    const { me, f } = await readableFile(fileId);
    const body = await summarizeFile(f);
    const [n] = await db
      .insert(S.note)
      .values({
        ownerId: me.spaceId,
        kind: "note",
        title: `Summary: ${f.name.replace(/\.[a-z0-9]+$/i, "")}`.slice(0, 140),
        body,
        tags: "summary",
        courseId: f.refType === "course" ? f.refId : null,
        projectId: f.refType === "project" ? f.refId : null,
      })
      .returning({ id: S.note.id });
    refresh();
    return { ok: true, noteId: n.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chichi couldn't read it" };
  }
}

export async function cardsFromAttachment(fileId: string, kind: "flashcards" | "practice"): Promise<{ ok: boolean; error?: string; deckId?: string; n?: number }> {
  try {
    const { me, f } = await readableFile(fileId);
    const cards = await questionsFromFile(f, kind);
    if (!cards.length) return { ok: false, error: "Chichi couldn't find enough to make cards from" };
    const [d] = await db
      .insert(S.deck)
      .values({
        ownerId: me.spaceId,
        name: `${kind === "flashcards" ? "Cards" : "Practice"}: ${f.name.replace(/\.[a-z0-9]+$/i, "")}`.slice(0, 80),
        kind: kind === "flashcards" ? "flashcards" : "practice",
        courseId: f.refType === "course" ? f.refId : null,
      })
      .returning({ id: S.deck.id });
    await db.insert(S.card).values(cards.map((c) => ({ ownerId: me.spaceId, deckId: d.id, front: c.front, back: c.back })));
    refresh();
    return { ok: true, deckId: d.id, n: cards.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chichi couldn't read it" };
  }
}

/* ================= Edit a task ================= */

export async function saveTask(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const title = str(f, "title", 140);
  if (!title) return fail("Give it a name");
  const repeat = ["none", "daily", "weekly", "monthly"].includes(str(f, "repeat")) ? str(f, "repeat") : "none";
  await db
    .update(S.task)
    .set({
      title,
      dueOn: date(f, "dueOn") ?? (repeat !== "none" ? todayISO() : null),
      priority: ["low", "normal", "high"].includes(str(f, "priority")) ? str(f, "priority") : "normal",
      repeat,
    })
    .where(and(eq(S.task.id, id), eq(S.task.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

/* ================= Revision planner ================= */

/** Spread the unticked revision steps over the days until the next exam, as tasks. */
export async function planRevision(courseId: string): Promise<number> {
  const me = await requireOwner();
  const [c] = await db.select().from(S.course).where(and(eq(S.course.id, courseId), eq(S.course.ownerId, me.spaceId))).limit(1);
  if (!c) return 0;
  const steps = c.checklist.filter((x) => !x.done).map((x) => x.t);
  if (!steps.length) return 0;
  const [exam] = await db
    .select()
    .from(S.exam)
    .where(and(eq(S.exam.courseId, courseId), sql`${S.exam.at} > now()`))
    .orderBy(S.exam.at)
    .limit(1);
  const today = todayISO();
  const examDay = exam ? todayISO(exam.at) : addDaysISO(today, 8);
  const days = Math.max(1, Math.round((Date.parse(examDay) - Date.parse(today)) / 86_400_000) - 1);
  const existing = new Set(
    (await db.select({ t: S.task.title }).from(S.task).where(and(eq(S.task.ownerId, me.spaceId), eq(S.task.done, false)))).map((r) => r.t),
  );
  const label = c.code || c.name;
  const rows = steps
    .map((t, i) => ({ title: `📚 ${label}: ${t}`.slice(0, 140), dueOn: addDaysISO(today, 1 + Math.floor((i * days) / steps.length)) }))
    .filter((r) => !existing.has(r.title))
    .map((r) => ({ ownerId: me.spaceId, ...r, priority: "normal" }));
  if (rows.length) await db.insert(S.task).values(rows);
  refresh();
  return rows.length;
}

/* ================= Note to tasks ================= */

/** Turns the to-do looking lines of a note ("- buy", "[ ] email", "1. read") into tasks. */
export async function tasksFromNote(noteId: string): Promise<number> {
  const me = await requireOwner();
  const [n] = await db.select().from(S.note).where(and(eq(S.note.id, noteId), eq(S.note.ownerId, me.spaceId))).limit(1);
  if (!n) return 0;
  const lines = n.body.split("\n").map((l) => l.trim());
  const marked = lines.filter((l) => /^([-*•]|\[ ?\]|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^([-*•]|\[ ?\]|\d+[.)])\s+/, ""));
  const picked = (marked.length ? marked : lines).filter((l) => l.length > 1).slice(0, 20);
  const existing = new Set(
    (await db.select({ t: S.task.title }).from(S.task).where(and(eq(S.task.ownerId, me.spaceId), eq(S.task.done, false)))).map((r) => r.t),
  );
  const rows = picked
    .map((t) => t.slice(0, 140))
    .filter((t) => !existing.has(t))
    .map((title) => ({ ownerId: me.spaceId, title, projectId: n.projectId }));
  if (rows.length) await db.insert(S.task).values(rows);
  refresh();
  return rows.length;
}
