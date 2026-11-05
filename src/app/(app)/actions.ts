"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getMe, requireOwner } from "@/lib/session";
import { ITEM_CATEGORY_KEYS, MONEY_CATEGORY_KEYS } from "@/lib/constants";
import { addDaysISO, todayISO } from "@/lib/format";
import { REPEATS } from "@/lib/time";
import { createReminder, createTask, ensureOnList as ensureOnListCore, logMoney } from "@/server/mutations";

const { task, item, shoppingItem, transaction, settings, reminder, notification, aiMemory } = schema;

export type ActionResult = { ok: boolean; error?: string };

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Tasks ---------------- */

const optionalTime = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/)
  .optional()
  .or(z.literal("").transform(() => undefined));

const taskInput = z.object({
  title: z.string().trim().min(1, "Give it a name").max(140),
  dueOn: optionalDate,
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  remindTime: optionalTime,
  repeat: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
});

export async function addTask(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = taskInput.safeParse({
    title: form.get("title"),
    dueOn: form.get("dueOn") ?? "",
    priority: form.get("priority") || "normal",
    remindTime: form.get("remindTime") ?? "",
    repeat: form.get("repeat") || "none",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { task: t } = await createTask(db, me.spaceId, parsed.data);
  if (parsed.data.repeat !== "none") {
    await db.update(task).set({ repeat: parsed.data.repeat, dueOn: t.dueOn ?? todayISO() }).where(eq(task.id, t.id));
  }
  refresh();
  return { ok: true };
}

export async function toggleTask(id: string) {
  const me = await requireOwner();
  const [row] = await db
    .update(task)
    .set({
      done: sql`not ${task.done}`,
      doneAt: sql`case when ${task.done} then null else now() end`,
    })
    .where(and(eq(task.id, id), eq(task.ownerId, me.spaceId)))
    .returning();
  // Repeating task: finishing it puts the next one on the list (laundry every week...).
  if (row?.done && row.repeat !== "none") {
    const base = row.dueOn ?? todayISO();
    const next = row.repeat === "daily" ? addDaysISO(base, 1) : row.repeat === "weekly" ? addDaysISO(base, 7) : nextMonth(base);
    const due = next <= todayISO() ? addDaysISO(todayISO(), row.repeat === "daily" ? 1 : row.repeat === "weekly" ? 7 : 30) : next;
    const [exists] = await db
      .select({ id: task.id })
      .from(task)
      .where(and(eq(task.ownerId, me.spaceId), eq(task.title, row.title), eq(task.done, false), eq(task.repeat, row.repeat)))
      .limit(1);
    if (!exists) {
      await db.insert(task).values({ ownerId: me.spaceId, title: row.title, dueOn: due, priority: row.priority, repeat: row.repeat, projectId: row.projectId });
    }
  }
  // A finished task doesn't need its one-off reminder anymore.
  if (row?.done) {
    await db
      .update(reminder)
      .set({ done: true })
      .where(and(eq(reminder.taskId, id), eq(reminder.repeat, "none"), eq(reminder.ownerId, me.spaceId)));
  }
  refresh();
}

export async function deleteTask(id: string) {
  const me = await requireOwner();
  await db.delete(task).where(and(eq(task.id, id), eq(task.ownerId, me.spaceId)));
  refresh();
}

/* ---------------- Inventory ---------------- */

const itemInput = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  category: z.enum(ITEM_CATEGORY_KEYS as [string, ...string[]]),
  location: z.string().trim().max(60).optional(),
  quantity: z.coerce.number().int().min(0).max(9999),
  lowAt: z.coerce.number().int().min(0).max(9999),
  expiresOn: optionalDate,
  kind: z.string().trim().max(30).optional(),
  brand: z.string().trim().max(60).optional(),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
});

export async function addItem(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = itemInput.safeParse({
    name: form.get("name"),
    category: form.get("category") || "other",
    location: form.get("location") || undefined,
    quantity: form.get("quantity") || 1,
    lowAt: form.get("lowAt") || 1,
    expiresOn: form.get("expiresOn") ?? "",
    kind: form.get("kind") || undefined,
    brand: form.get("brand") || undefined,
    price: form.get("price") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  await db.insert(item).values({
    kind: d.kind || null,
    brand: d.brand || null,
    priceCents: d.price ? Math.round(d.price * 100) : null,
    boughtOn: todayISO(),
    ownerId: me.spaceId,
    name: d.name,
    category: d.category,
    location: d.location || null,
    quantity: d.quantity,
    lowAt: d.lowAt,
    expiresOn: d.expiresOn ?? null,
  });
  refresh();
  return { ok: true };
}

/** +1 / -1 on an item. When it drops to its low mark it lands on the shopping list. */
export async function bumpItem(id: string, delta: 1 | -1) {
  const me = await requireOwner();
  const [row] = await db
    .update(item)
    .set({ quantity: sql`greatest(0, ${item.quantity} + ${delta})`, updatedAt: new Date() })
    .where(and(eq(item.id, id), eq(item.ownerId, me.spaceId)))
    .returning();
  if (row) await db.insert(schema.itemUse).values({ ownerId: me.spaceId, itemId: row.id, delta });
  if (row && delta < 0 && row.quantity <= row.lowAt) {
    await ensureOnList(me.spaceId, row.id, row.name, row.quantity === 0 ? "urgent" : "need");
  }
  refresh();
}

export async function deleteItem(id: string) {
  const me = await requireOwner();
  await db.delete(item).where(and(eq(item.id, id), eq(item.ownerId, me.spaceId)));
  refresh();
}

export async function addItemToList(id: string) {
  const me = await requireOwner();
  const [row] = await db.select().from(item).where(and(eq(item.id, id), eq(item.ownerId, me.spaceId))).limit(1);
  if (row) await ensureOnList(me.spaceId, row.id, row.name, row.quantity === 0 ? "urgent" : "need");
  refresh();
}

async function ensureOnList(spaceId: string, itemId: string, name: string, priority: "urgent" | "need") {
  await ensureOnListCore(db, spaceId, itemId, name, priority);
}

/* ---------------- Shopping ---------------- */

const shopInput = z.object({
  name: z.string().trim().min(1, "What do you need?").max(80),
  priority: z.enum(["urgent", "need", "maybe"]).default("need"),
});

export async function addShop(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = shopInput.safeParse({ name: form.get("name"), priority: form.get("priority") || "need" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  await db.insert(shoppingItem).values({ ownerId: me.spaceId, ...parsed.data });
  refresh();
  return { ok: true };
}

/**
 * Ticking a bought item restocks the linked inventory item by one. With a
 * price it also logs the spending (Shopping) and remembers the price per store.
 */
export async function toggleShop(id: string, paid?: { price?: string; store?: string }) {
  const me = await requireOwner();
  const price = paid?.price ? Math.round(Number(paid.price) * 100) : 0;
  const store = paid?.store?.trim().slice(0, 40) || null;
  const [row] = await db
    .update(shoppingItem)
    .set({
      done: sql`not ${shoppingItem.done}`,
      boughtAt: sql`case when ${shoppingItem.done} then null else now() end`,
      ...(price > 0 ? { priceCents: price, store } : {}),
    })
    .where(and(eq(shoppingItem.id, id), eq(shoppingItem.ownerId, me.spaceId)))
    .returning();
  if (row?.done && price > 0 && price < 100_000_000) {
    await logMoney(db, me.spaceId, { amount: price / 100, category: "shop", note: row.name, on: todayISO() });
    await db.insert(schema.priceLog).values({ ownerId: me.spaceId, name: row.name.trim().toLowerCase(), store, priceCents: price });
    if (row.itemId) await db.update(item).set({ priceCents: price, boughtOn: todayISO() }).where(eq(item.id, row.itemId));
  }
  if (row?.itemId) {
    await db.insert(schema.itemUse).values({ ownerId: me.spaceId, itemId: row.itemId, delta: row.done ? 1 : -1 });
    const delta = row.done ? 1 : -1;
    await db
      .update(item)
      .set({ quantity: sql`greatest(0, ${item.quantity} + ${delta})`, updatedAt: new Date() })
      .where(and(eq(item.id, row.itemId), eq(item.ownerId, me.spaceId)));
  }
  refresh();
}

export async function deleteShop(id: string) {
  const me = await requireOwner();
  await db.delete(shoppingItem).where(and(eq(shoppingItem.id, id), eq(shoppingItem.ownerId, me.spaceId)));
  refresh();
}

/* ---------------- Money ---------------- */

const txInput = z.object({
  amount: z.coerce.number().positive("Type an amount").max(1_000_000),
  category: z.enum(MONEY_CATEGORY_KEYS as [string, ...string[]]),
  kind: z.enum(["expense", "income"]).default("expense"),
  note: z.string().trim().max(120).optional(),
});

export async function addTx(input: { amount: string; category: string; kind?: string; note?: string }): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = txInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the amount" };
  const d = parsed.data;
  await logMoney(db, me.spaceId, { amount: d.amount, category: d.category, kind: d.kind, note: d.note, on: todayISO() });
  refresh();
  return { ok: true };
}

export async function deleteTx(id: string) {
  const me = await requireOwner();
  await db.delete(transaction).where(and(eq(transaction.id, id), eq(transaction.ownerId, me.spaceId)));
  refresh();
}

export async function setBudget(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = z.coerce.number().positive().max(1_000_000).safeParse(form.get("budget"));
  if (!parsed.success) return { ok: false, error: "Type a budget amount" };
  const cents = Math.round(parsed.data * 100);
  await db
    .insert(settings)
    .values({ ownerId: me.spaceId, monthlyBudgetCents: cents })
    .onConflictDoUpdate({ target: settings.ownerId, set: { monthlyBudgetCents: cents, updatedAt: new Date() } });
  refresh();
  return { ok: true };
}

/* ---------------- Reminders ---------------- */

const reminderInput = z.object({
  title: z.string().trim().min(1, "What should Chichi remind you about?").max(140),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a day"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  repeat: z.enum(REPEATS as [string, ...string[]]).default("none"),
  note: z.string().trim().max(200).optional(),
});

export async function addReminder(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const parsed = reminderInput.safeParse({
    title: form.get("title"),
    date: form.get("date"),
    time: form.get("time"),
    repeat: form.get("repeat") || "none",
    note: form.get("note") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  await createReminder(db, me.spaceId, { ...d, repeat: d.repeat as (typeof REPEATS)[number] });
  refresh();
  return { ok: true };
}

export async function deleteReminder(id: string) {
  const me = await requireOwner();
  await db.delete(reminder).where(and(eq(reminder.id, id), eq(reminder.ownerId, me.spaceId)));
  refresh();
}

/* ---------------- Inbox ---------------- */

export async function markAllRead() {
  const me = await getMe();
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.ownerId, me.spaceId), isNull(notification.readAt)));
  refresh();
}

/* ---------------- Notification settings ---------------- */

export async function saveNotifySettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const hour = (v: FormDataEntryValue | null) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= -1 && n <= 23 ? n : -1;
  };
  const values = {
    digestHour: hour(form.get("digestHour")),
    nudgeHour: hour(form.get("nudgeHour")),
    emailDigest: form.get("emailDigest") === "on",
    emailReminders: form.get("emailReminders") === "on",
    pinnedStatus: form.get("pinnedStatus") === "on",
  };
  await db
    .insert(settings)
    .values({ ownerId: me.spaceId, ...values })
    .onConflictDoUpdate({ target: settings.ownerId, set: { ...values, updatedAt: new Date() } });
  refresh();
  return { ok: true };
}

/* ---------------- Chichi's memory ---------------- */

export async function deleteMemory(id: string) {
  const me = await requireOwner();
  await db.delete(aiMemory).where(and(eq(aiMemory.id, id), eq(aiMemory.ownerId, me.spaceId)));
  refresh();
}

function nextMonth(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
