"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/session";
import { getSettings } from "@/lib/data";
import { debtReminders, paperReminders } from "@/server/mutations";
import { removeStored } from "@/server/files";
import { DOC_CATEGORIES, APP_CATEGORIES, APP_STATUSES } from "@/lib/papers";
import type { ActionResult } from "./actions";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const opt = (f: FormData, k: string, max = 200) => str(f, k, max) || null;
const date = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? str(f, k) : null);
const fail = (error: string): ActionResult => ({ ok: false, error });
const url = (v: string | null) => (v && /^https?:\/\//i.test(v) ? v : null);

/* ================= Papers ================= */

export async function addPaper(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const kind = str(f, "kind") === "application" ? "application" : "document";
  const title = str(f, "title", 120);
  if (!title) return fail(kind === "document" ? "Which document is it?" : "What are you applying for?");
  const cats = kind === "document" ? DOC_CATEGORIES : APP_CATEGORIES;
  const category = str(f, "category") in cats ? str(f, "category") : "other";
  // Only a short hint is kept. A full IC or passport number never goes in Danchi.
  const hint = str(f, "refHint", 40).replace(/\s/g, "").slice(-4) || null;
  const [row] = await db
    .insert(S.paper)
    .values({
      ownerId: me.spaceId,
      kind,
      category,
      title,
      org: opt(f, "org", 100),
      refHint: hint,
      expiresOn: kind === "document" ? date(f, "expiresOn") : null,
      deadlineOn: kind === "application" ? date(f, "deadlineOn") : null,
      status: kind === "application" ? "idea" : "idea",
      link: url(opt(f, "link", 500)),
      notes: opt(f, "notes", 2000),
    })
    .returning();
  await paperReminders(db, me.spaceId, row);
  refresh();
  return { ok: true };
}

export async function savePaper(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const [cur] = await db.select().from(S.paper).where(and(eq(S.paper.id, id), eq(S.paper.ownerId, me.spaceId))).limit(1);
  if (!cur) return fail("Not found");
  const title = str(f, "title", 120);
  if (!title) return fail("Give it a name");
  const hint = str(f, "refHint", 40).replace(/\s/g, "").slice(-4) || null;
  const [row] = await db
    .update(S.paper)
    .set({
      title,
      org: opt(f, "org", 100),
      refHint: hint,
      expiresOn: cur.kind === "document" ? date(f, "expiresOn") : null,
      deadlineOn: cur.kind === "application" ? date(f, "deadlineOn") : null,
      link: url(opt(f, "link", 500)),
      notes: opt(f, "notes", 2000),
      updatedAt: new Date(),
    })
    .where(eq(S.paper.id, id))
    .returning();
  await paperReminders(db, me.spaceId, row);
  refresh();
  return { ok: true };
}

export async function setPaperStatus(id: string, status: string) {
  const me = await requireOwner();
  if (!APP_STATUSES.some((s) => s.key === status)) return;
  const [row] = await db
    .update(S.paper)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(S.paper.id, id), eq(S.paper.ownerId, me.spaceId)))
    .returning();
  if (row) await paperReminders(db, me.spaceId, row);
  refresh();
}

export async function deletePaper(id: string) {
  const me = await requireOwner();
  const files = await db
    .select()
    .from(S.file)
    .where(and(eq(S.file.ownerId, me.spaceId), eq(S.file.refType, "paper"), eq(S.file.refId, id)));
  await Promise.all(files.map((x) => removeStored(x.storedName)));
  if (files.length) await db.delete(S.file).where(inArray(S.file.id, files.map((x) => x.id)));
  await db.delete(S.paper).where(and(eq(S.paper.id, id), eq(S.paper.ownerId, me.spaceId)));
  refresh();
  redirect("/papers");
}

async function editChecklist(id: string, fn: (list: { t: string; done: boolean }[]) => { t: string; done: boolean }[]) {
  const me = await requireOwner();
  const [p] = await db.select().from(S.paper).where(and(eq(S.paper.id, id), eq(S.paper.ownerId, me.spaceId))).limit(1);
  if (!p) return;
  await db
    .update(S.paper)
    .set({ checklist: fn(p.checklist ?? []).slice(0, 40), updatedAt: new Date() })
    .where(eq(S.paper.id, id));
  refresh();
}

export async function addCheck(_: ActionResult, f: FormData): Promise<ActionResult> {
  const t = str(f, "t", 120);
  if (!t) return fail("What needs doing?");
  await editChecklist(str(f, "id", 40), (l) => [...l, { t, done: false }]);
  return { ok: true };
}

export async function toggleCheck(id: string, i: number) {
  await editChecklist(id, (l) => l.map((c, j) => (j === i ? { ...c, done: !c.done } : c)));
}

export async function removeCheck(id: string, i: number) {
  await editChecklist(id, (l) => l.filter((_, j) => j !== i));
}

/* ================= Files ================= */

export async function deleteFile(id: string) {
  const me = await requireOwner();
  const [row] = await db.delete(S.file).where(and(eq(S.file.id, id), eq(S.file.ownerId, me.spaceId))).returning();
  if (row) await removeStored(row.storedName);
  refresh();
}

/* ================= Debts ================= */

export async function addDebt(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const person = str(f, "person", 60);
  if (!person) return fail("Who is it with?");
  const amount = Math.round(Number(str(f, "amount")) * 100);
  if (!Number.isFinite(amount) || amount <= 0) return fail("How much?");
  const [row] = await db
    .insert(S.debt)
    .values({
      ownerId: me.spaceId,
      person,
      direction: str(f, "direction") === "i_owe" ? "i_owe" : "owes_me",
      amountCents: amount,
      note: opt(f, "note", 200),
      dueOn: date(f, "dueOn"),
    })
    .returning();
  const s = await getSettings(me.spaceId);
  await debtReminders(db, me.spaceId, row, s.currency);
  refresh();
  return { ok: true };
}

export async function settleDebt(id: string) {
  const me = await requireOwner();
  const [cur] = await db.select().from(S.debt).where(and(eq(S.debt.id, id), eq(S.debt.ownerId, me.spaceId))).limit(1);
  if (!cur) return;
  const [row] = await db
    .update(S.debt)
    .set({ settled: !cur.settled, settledAt: cur.settled ? null : new Date() })
    .where(eq(S.debt.id, id))
    .returning();
  const s = await getSettings(me.spaceId);
  await debtReminders(db, me.spaceId, row, s.currency);
  refresh();
}

export async function deleteDebt(id: string) {
  const me = await requireOwner();
  await db.delete(S.debt).where(and(eq(S.debt.id, id), eq(S.debt.ownerId, me.spaceId)));
  refresh();
}
