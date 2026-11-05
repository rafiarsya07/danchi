"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMe, requireOwner } from "@/lib/session";
import { canSee } from "@/lib/privacy";
import { todayISO } from "@/lib/format";
import { notify } from "@/server/notify";
import type { ActionResult } from "./actions";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const EMOJI = /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*$/u;

export async function addCountdown(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const title = str(f, "title", 80);
  const day = str(f, "day", 10);
  if (!title || !isDate(day)) return { ok: false, error: "Give it a name and a date" };
  const emoji = str(f, "emoji", 8);
  await db.insert(S.countdown).values({ ownerId: me.spaceId, title, day, yearly: f.get("yearly") === "on", emoji: EMOJI.test(emoji) ? emoji : "🎉" });
  refresh();
  return { ok: true };
}

export async function deleteCountdown(id: string) {
  const me = await requireOwner();
  await db.delete(S.countdown).where(and(eq(S.countdown.id, id), eq(S.countdown.ownerId, me.spaceId)));
  refresh();
}

/** Both of them can drop a happy moment in the jar. */
export async function addToJar(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  if (me.role !== "owner" && !(await canSee(me, "cozy"))) return { ok: false, error: "This is hers to share" };
  const text = str(f, "text", 400);
  if (!text) return { ok: false, error: "Write the happy moment first" };
  const emoji = str(f, "emoji", 8);
  await db.insert(S.jarNote).values({ ownerId: me.spaceId, fromUserId: me.id, text, emoji: EMOJI.test(emoji) ? emoji : "⭐", day: todayISO() });
  if (me.role === "viewer") {
    await notify(db, { ownerId: me.spaceId, kind: "love", audience: "owner", title: `⭐ ${me.name} added a happy moment to your jar`, body: text.slice(0, 120), url: "/cozy?tab=jar" }).catch(() => {});
  }
  refresh();
  return { ok: true };
}

export async function deleteJar(id: string) {
  const me = await getMe();
  const mine = me.role === "owner" ? eq(S.jarNote.ownerId, me.spaceId) : and(eq(S.jarNote.ownerId, me.spaceId), eq(S.jarNote.fromUserId, me.id));
  await db.delete(S.jarNote).where(and(eq(S.jarNote.id, id), or(mine)));
  refresh();
}

export async function logFocus(minutes: number, label: string | null, courseId: string | null) {
  const me = await requireOwner();
  const m = Math.round(Number(minutes));
  if (!(m >= 1 && m <= 240)) return { ok: false };
  let course: string | null = null;
  if (courseId && /^[0-9a-f-]{36}$/i.test(courseId)) {
    const [c] = await db.select({ id: S.course.id }).from(S.course).where(and(eq(S.course.id, courseId), eq(S.course.ownerId, me.spaceId))).limit(1);
    course = c?.id ?? null;
  }
  await db.insert(S.focusSession).values({ ownerId: me.spaceId, minutes: m, label: (label ?? "").trim().slice(0, 80) || null, courseId: course, day: todayISO() });
  refresh();
  return { ok: true };
}

/* ---------------- Our bucket list (both of them) ---------------- */

export async function addBucket(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  if (me.role !== "owner" && !(await canSee(me, "cozy"))) return { ok: false, error: "This is hers to share" };
  const title = str(f, "title", 120);
  if (!title) return { ok: false, error: "What do you want to do together?" };
  const emoji = str(f, "emoji", 8);
  await db.insert(S.bucket).values({ ownerId: me.spaceId, title, emoji: EMOJI.test(emoji) ? emoji : "✨", addedBy: me.id });
  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: `✨ ${me.name} added to your bucket list`,
    body: title,
    url: "/cozy?tab=bucket",
  }).catch(() => {});
  refresh();
  return { ok: true };
}

export async function toggleBucket(id: string) {
  const me = await getMe();
  const [b] = await db.select().from(S.bucket).where(and(eq(S.bucket.id, id), eq(S.bucket.ownerId, me.spaceId))).limit(1);
  if (!b) return;
  await db.update(S.bucket).set({ doneAt: b.doneAt ? null : new Date() }).where(eq(S.bucket.id, id));
  refresh();
}

export async function deleteBucket(id: string) {
  const me = await getMe();
  const mineOnly = me.role === "owner" ? undefined : eq(S.bucket.addedBy, me.id);
  await db.delete(S.bucket).where(and(eq(S.bucket.id, id), eq(S.bucket.ownerId, me.spaceId), mineOnly));
  refresh();
}
