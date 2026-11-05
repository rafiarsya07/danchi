"use server";

/**
 * Privacy, security, safety and comfort actions.
 * Every write checks who is asking: most are hers only, love notes are his.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMe, requireOwner } from "@/lib/session";
import { SHAREABLE } from "@/lib/privacy";
import { checkPin, clearUnlock, getLock, grantUnlock, hashPin } from "@/lib/lock";
import { addDaysISO, todayISO } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";
import { SYMPTOMS } from "@/lib/cycle";
import { notify } from "@/server/notify";
import { cancelTimer, extendTimer, sendCheckin, startTimer, timerSafe, type CheckinKind } from "@/server/safety";
import type { ActionResult } from "./actions";
import type { EmergencyCard } from "@/db/schema";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const fail = (error: string): ActionResult => ({ ok: false, error });
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

async function patchSettings(spaceId: string, values: Partial<typeof S.settings.$inferInsert>) {
  await db
    .insert(S.settings)
    .values({ ownerId: spaceId, ...values })
    .onConflictDoUpdate({ target: S.settings.ownerId, set: { ...values, updatedAt: new Date() } });
}

/* ================= Privacy ================= */

export async function savePrivacy(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const shown = new Set(f.getAll("show").map(String));
  await patchSettings(me.spaceId, {
    hiddenSections: SHAREABLE.map((s) => s.key).filter((k) => !shown.has(k)),
    shareReminders: f.get("shareReminders") === "on",
    shareMood: f.get("shareMood") === "on",
    cycleTellRafi: f.get("cycleTellRafi") === "on",
  });
  refresh();
  return { ok: true };
}

export async function saveQuietHours(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const h = (k: string) => {
    const n = Number(f.get(k));
    return Number.isInteger(n) && n >= -1 && n <= 23 ? n : -1;
  };
  const on = f.get("quiet") === "on";
  await patchSettings(me.spaceId, { quietFrom: on ? h("quietFrom") : -1, quietTo: on ? h("quietTo") : -1 });
  refresh();
  return { ok: true };
}

/** The viewer opened a page. Called from the app, throttled per page. */
export async function logVisit(path: string) {
  const me = await getMe();
  if (me.role !== "viewer") return;
  const clean = path.split("?")[0].slice(0, 120);
  // Same page within 10 minutes counts once.
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(S.visitLog)
    .where(and(eq(S.visitLog.userId, me.id), eq(S.visitLog.path, clean), gt(S.visitLog.at, sql`now() - interval '10 minutes'`)));
  if ((recent?.n ?? 0) > 0) return;
  await db.insert(S.visitLog).values({ ownerId: me.spaceId, userId: me.id, path: clean });
}

/* ================= PIN lock ================= */

const FRESH_FOR_CHANGES = 10 * 60_000;

export async function setPin(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const pin = str(f, "pin", 12);
  const pin2 = str(f, "pin2", 12);
  const minutes = [1, 5, 15, 60].includes(Number(f.get("minutes"))) ? Number(f.get("minutes")) : 15;
  if (!/^\d{4,6}$/.test(pin)) return fail("Use 4 to 6 numbers");
  if (pin !== pin2) return fail("The two PINs don't match");
  const lock = await getLock(me.id);
  if (lock) {
    const fresh = Date.now() - me.sessionCreatedAt.getTime() < FRESH_FOR_CHANGES;
    if (!fresh && !checkPin(str(f, "current", 12), lock.pinHash)) return fail("Your current PIN isn't right");
  }
  const values = { pinHash: hashPin(pin), lockMinutes: minutes, failed: 0, lockedUntil: null, updatedAt: new Date() };
  await db
    .insert(S.userLock)
    .values({ userId: me.id, ...values })
    .onConflictDoUpdate({ target: S.userLock.userId, set: values });
  await grantUnlock(me, minutes);
  refresh();
  return { ok: true };
}

export async function setLockMinutes(minutes: number) {
  const me = await getMe();
  if (![1, 5, 15, 60].includes(minutes)) return;
  await db.update(S.userLock).set({ lockMinutes: minutes }).where(eq(S.userLock.userId, me.id));
  await grantUnlock(me, minutes);
  refresh();
}

export async function removePin(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const lock = await getLock(me.id);
  if (!lock) return { ok: true };
  const fresh = Date.now() - me.sessionCreatedAt.getTime() < FRESH_FOR_CHANGES;
  if (!fresh && !checkPin(str(f, "current", 12), lock.pinHash)) return fail("That PIN isn't right");
  await db.delete(S.userLock).where(eq(S.userLock.userId, me.id));
  await clearUnlock();
  refresh();
  return { ok: true };
}

export async function unlock(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const lock = await getLock(me.id);
  if (!lock) return { ok: true };
  if (lock.lockedUntil && lock.lockedUntil > new Date()) {
    const mins = Math.ceil((lock.lockedUntil.getTime() - Date.now()) / 60_000);
    return fail(`Too many tries. Wait ${mins} min, or sign in with Google again.`);
  }
  const pin = str(f, "pin", 12);
  if (checkPin(pin, lock.pinHash)) {
    await db.update(S.userLock).set({ failed: 0, lockedUntil: null }).where(eq(S.userLock.userId, me.id));
    await grantUnlock(me, lock.lockMinutes);
    refresh();
    return { ok: true };
  }
  const failed = lock.failed + 1;
  if (failed >= 10) {
    // Someone is guessing. End this session; Google sign in is needed again.
    await db.update(S.userLock).set({ failed: 0, lockedUntil: null }).where(eq(S.userLock.userId, me.id));
    await db.delete(S.session).where(eq(S.session.id, me.sessionId));
    await notify(db, {
      ownerId: me.spaceId,
      kind: "security",
      title: "🔐 Too many wrong PINs",
      body: "Danchi signed that device out to keep you safe. Sign in with Google to come back.",
      pushUserIds: [me.id],
      inbox: false,
      urgent: true,
    });
    redirect("/login");
  }
  await db
    .update(S.userLock)
    .set({ failed, lockedUntil: failed % 5 === 0 ? new Date(Date.now() + 5 * 60_000) : null })
    .where(eq(S.userLock.userId, me.id));
  return fail(failed % 5 === 0 ? "Too many tries. Wait 5 minutes." : `Not quite. ${5 - (failed % 5)} tries left before a short pause.`);
}

/* ================= Devices ================= */

export async function signOutDevice(id: string) {
  const me = await getMe();
  if (id === me.sessionId) return;
  await db.delete(S.session).where(and(eq(S.session.id, id), eq(S.session.userId, me.id)));
  refresh();
}

export async function signOutOthers() {
  const me = await getMe();
  await db.delete(S.session).where(and(eq(S.session.userId, me.id), ne(S.session.id, me.sessionId)));
  refresh();
}

/* ================= Safety ================= */

const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export async function checkIn(kind: CheckinKind, message?: string, lat?: number, lng?: number): Promise<ActionResult> {
  const me = await requireOwner();
  if (!["safe", "omw", "help"].includes(kind)) return fail("Unknown check in");
  const la = num(lat, -90, 90);
  const ln = num(lng, -180, 180);
  await sendCheckin(db, me.spaceId, kind, {
    message: (message ?? "").trim().slice(0, 140) || null,
    lat: la != null && ln != null ? la : null,
    lng: la != null && ln != null ? ln : null,
  });
  refresh();
  return { ok: true };
}

export async function startSafeTimer(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const mode = str(f, "mode");
  let dueAt: Date | null = null;
  if (mode === "at") {
    const t = str(f, "at");
    if (!/^\d{2}:\d{2}$/.test(t)) return fail("Pick a time");
    dueAt = zonedToUtc(todayISO(), t);
    if (dueAt.getTime() < Date.now()) dueAt = new Date(dueAt.getTime() + 86_400_000);
  } else {
    const m = num(f.get("minutes"), 5, 12 * 60);
    if (!m) return fail("Pick how long");
    dueAt = new Date(Date.now() + m * 60_000);
  }
  const la = num(f.get("lat"), -90, 90);
  const ln = num(f.get("lng"), -180, 180);
  await startTimer(db, me.spaceId, dueAt, str(f, "message", 120) || null, la != null && ln != null ? { lat: la, lng: ln } : null);
  refresh();
  return { ok: true };
}

export async function imSafe() {
  const me = await requireOwner();
  await timerSafe(db, me.spaceId);
  refresh();
}

export async function addFifteen() {
  const me = await requireOwner();
  await extendTimer(db, me.spaceId, 15);
  refresh();
}

export async function stopTimer() {
  const me = await requireOwner();
  await cancelTimer(db, me.spaceId);
  refresh();
}

export async function saveEmergency(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const contacts: EmergencyCard["contacts"] = [];
  for (let i = 0; i < 3; i++) {
    const name = str(f, `c${i}name`, 60);
    const phone = str(f, `c${i}phone`, 30).replace(/[^\d+ ()-]/g, "");
    if (name && phone) contacts.push({ name, phone, relation: str(f, `c${i}rel`, 30) || undefined });
  }
  const card: EmergencyCard = {
    bloodType: str(f, "bloodType", 6) || undefined,
    allergies: str(f, "allergies", 300) || undefined,
    medications: str(f, "medications", 300) || undefined,
    conditions: str(f, "conditions", 300) || undefined,
    notes: str(f, "notes", 500) || undefined,
    contacts,
  };
  await patchSettings(me.spaceId, { emergency: card });
  refresh();
  return { ok: true };
}

export async function saveSosNumbers(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const { toIntl } = await import("@/server/phone");
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const raw = str(f, `n${i}`, 30);
    if (!raw) continue;
    const n = toIntl(raw);
    if (!n) return fail(`Number ${i + 1} doesn't look right. Start with 01 (Malaysia), 08 (Indonesia) or +country code.`);
    if (!out.includes(n)) out.push(n);
  }
  await patchSettings(me.spaceId, { sosNumbers: out });
  refresh();
  return { ok: true };
}

/** "Test SOS call": rings the SOS numbers with a calm test message. Either of them can run it. */
export async function testSosCall() {
  const me = await getMe();
  const { allow } = await import("@/lib/rate");
  if (!allow(`sostest:${me.spaceId}`, 3, 10 * 60_000)) return { ready: true, results: [], error: "Wait a few minutes before testing again" };
  const { testSosCalls } = await import("@/server/sos");
  const { maskPhone } = await import("@/server/phone");
  const r = await testSosCalls(db, me.spaceId);
  return { ready: r.ready, results: r.results.map((x) => ({ ...x, to: maskPhone(x.to) })), error: null as string | null };
}

/** SOS camera is off unless she turns it on. */
export async function setSosCamera(on: boolean) {
  const me = await requireOwner();
  await patchSettings(me.spaceId, { sosCamera: !!on });
  refresh();
  return { ok: true };
}

/** She can wipe an SOS completely: photos, location trail, the record and its live link. */
export async function deleteSos(id: string) {
  const me = await requireOwner();
  const [row] = await db
    .select({ id: S.sos.id, status: S.sos.status })
    .from(S.sos)
    .where(and(eq(S.sos.id, id), eq(S.sos.ownerId, me.spaceId)))
    .limit(1);
  if (!row || row.status === "active") return { ok: false };
  const files = await db
    .delete(S.file)
    .where(and(eq(S.file.refType, "sos"), eq(S.file.refId, row.id)))
    .returning({ storedName: S.file.storedName });
  const { removeStored } = await import("@/server/files");
  for (const f of files) await removeStored(f.storedName);
  await db.delete(S.sos).where(eq(S.sos.id, row.id)); // points cascade
  refresh();
  return { ok: true };
}

/** Delete only the photos of one SOS. */
export async function deleteSosPhotos(id: string) {
  const me = await requireOwner();
  const [row] = await db.select({ id: S.sos.id }).from(S.sos).where(and(eq(S.sos.id, id), eq(S.sos.ownerId, me.spaceId))).limit(1);
  if (!row) return { ok: false };
  const files = await db
    .delete(S.file)
    .where(and(eq(S.file.refType, "sos"), eq(S.file.refId, row.id)))
    .returning({ storedName: S.file.storedName });
  const { removeStored } = await import("@/server/files");
  for (const f of files) await removeStored(f.storedName);
  refresh();
  return { ok: true };
}

/* ================= Love notes ================= */

const LOVE_EMOJI = ["💌", "💛", "🌼", "🍑", "🫶", "🧸", "☕", "🌙"];

export async function sendLoveNote(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const text = str(f, "text", 500);
  if (!text) return fail("Write something sweet first");
  const emoji = LOVE_EMOJI.includes(str(f, "emoji")) ? str(f, "emoji") : "💌";
  await db.insert(S.loveNote).values({ ownerId: me.spaceId, fromUserId: me.id, text, emoji });
  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: `${emoji} ${me.name} left you a note`,
    body: text,
    url: "/love",
  });
  refresh();
  return { ok: true };
}

/** One tap "I miss you" (kangen), either way. At most once a minute. */
export async function sendMiss(): Promise<ActionResult> {
  const me = await getMe();
  const [last] = await db
    .select({ at: S.loveNote.createdAt })
    .from(S.loveNote)
    .where(and(eq(S.loveNote.ownerId, me.spaceId), eq(S.loveNote.fromUserId, me.id), eq(S.loveNote.kind, "miss"), gt(S.loveNote.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (last) return { ok: true };
  await db.insert(S.loveNote).values({ ownerId: me.spaceId, fromUserId: me.id, text: "I miss you 🥺", emoji: "🥺", kind: "miss" });
  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: `🥺 ${me.name} misses you`,
    body: "Send a little something back 💛",
    url: "/love",
  }).catch(() => {});
  refresh();
  return { ok: true };
}

/** "Send me a pap?" (a photo of you right now). */
export async function askPap(): Promise<ActionResult> {
  const me = await getMe();
  const { allow } = await import("@/lib/rate");
  if (!allow(`papask:${me.id}`, 1, 60_000)) return { ok: true };
  await db.insert(S.loveNote).values({ ownerId: me.spaceId, fromUserId: me.id, text: "Send me a pap? 📸", emoji: "📸", kind: "papask" });
  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: `📸 ${me.name} wants a pap`,
    body: "A little photo of you right now 💛",
    url: "/love?pap=1",
  }).catch(() => {});
  refresh();
  return { ok: true };
}

/** React to the other person's note. */
export async function reactLove(id: string, reaction: string) {
  const me = await getMe();
  const r = ["❤️", "🥹", "😂", "🫶", "😍", "😢"].includes(reaction) ? reaction : "❤️";
  const [n] = await db
    .update(S.loveNote)
    .set({ reaction: r, seenAt: new Date() })
    .where(and(eq(S.loveNote.id, id), eq(S.loveNote.ownerId, me.spaceId), ne(S.loveNote.fromUserId, me.id)))
    .returning();
  if (n) {
    await notify(db, {
      ownerId: me.spaceId,
      kind: "love",
      audience: me.role === "owner" ? "viewer" : "owner",
      inbox: false,
      title: `${r} ${me.name} loved your ${n.kind === "pap" ? "pap" : "note"}`,
      body: n.text.slice(0, 90),
      url: "/love",
    });
  }
  refresh();
}

export async function deleteLove(id: string) {
  const me = await getMe();
  const cond = me.role === "owner" ? eq(S.loveNote.ownerId, me.spaceId) : and(eq(S.loveNote.ownerId, me.spaceId), eq(S.loveNote.fromUserId, me.id));
  const [n] = await db.delete(S.loveNote).where(and(eq(S.loveNote.id, id), cond)).returning({ id: S.loveNote.id });
  if (n) {
    const files = await db.delete(S.file).where(and(eq(S.file.refType, "love"), eq(S.file.refId, n.id))).returning({ storedName: S.file.storedName });
    const { removeStored } = await import("@/server/files");
    for (const f of files) await removeStored(f.storedName);
  }
  refresh();
}

/** She (or he) opened the chat: the other one's messages are now "seen". */
/** "Together since": the day they got together. Either of them can set it. */
export async function setTogetherSince(day: string | null) {
  const me = await getMe();
  const v = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= todayISO() ? day : null;
  await patchSettings(me.spaceId, { togetherSince: v });
  revalidatePath("/love");
  revalidatePath("/");
  return { ok: true };
}

export async function markLoveSeen() {
  const me = await getMe();
  const rows = await db
    .update(S.loveNote)
    .set({ seenAt: new Date() })
    .where(and(eq(S.loveNote.ownerId, me.spaceId), ne(S.loveNote.fromUserId, me.id), sql`${S.loveNote.seenAt} is null`))
    .returning({ id: S.loveNote.id });
  return rows.length;
}

export async function deleteSticker(id: string) {
  const me = await getMe();
  const cond = me.role === "owner" ? eq(S.loveSticker.ownerId, me.spaceId) : and(eq(S.loveSticker.ownerId, me.spaceId), eq(S.loveSticker.createdBy, me.id));
  const [st] = await db.delete(S.loveSticker).where(and(eq(S.loveSticker.id, id), cond)).returning();
  if (st) {
    const [f] = await db.delete(S.file).where(eq(S.file.id, st.fileId)).returning({ storedName: S.file.storedName });
    if (f) {
      const { removeStored } = await import("@/server/files");
      await removeStored(f.storedName);
    }
  }
  revalidatePath("/love");
}

/* ================= Mood ================= */

export async function setMood(mood: number, note?: string) {
  const me = await requireOwner();
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return;
  const day = todayISO();
  const values = { mood, note: note?.trim().slice(0, 200) || null, updatedAt: new Date() };
  await db
    .insert(S.moodLog)
    .values({ ownerId: me.spaceId, day, ...values })
    .onConflictDoUpdate({ target: [S.moodLog.ownerId, S.moodLog.day], set: values });
  refresh();
}

export async function askForHug() {
  const me = await requireOwner();
  await notify(db, {
    ownerId: me.spaceId,
    kind: "mood",
    audience: "viewer",
    inbox: false,
    urgent: true,
    title: `🫂 ${me.name} could use a hug`,
    body: "Not an emergency. Just a hard day. A call, a voice note or a little note in Danchi would mean a lot.",
    url: "/",
  });
  return true;
}

/* ================= Cycle ================= */

export async function logPeriod(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const start = str(f, "startOn") || todayISO();
  if (!isDate(start) || start > todayISO()) return fail("Pick a day up to today");
  const flow = ["light", "medium", "heavy"].includes(str(f, "flow")) ? str(f, "flow") : null;
  await db.insert(S.cycleLog).values({ ownerId: me.spaceId, startOn: start, flow }).onConflictDoNothing();
  refresh();
  return { ok: true };
}

export async function endPeriod(id: string) {
  const me = await requireOwner();
  await db
    .update(S.cycleLog)
    .set({ endOn: todayISO() })
    .where(and(eq(S.cycleLog.id, id), eq(S.cycleLog.ownerId, me.spaceId)));
  refresh();
}

export async function saveCycle(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireOwner();
  const id = str(f, "id", 40);
  const endOn = str(f, "endOn");
  const symptoms = f
    .getAll("symptoms")
    .map(String)
    .filter((s) => (SYMPTOMS as readonly string[]).includes(s))
    .join(", ");
  await db
    .update(S.cycleLog)
    .set({
      endOn: isDate(endOn) ? endOn : null,
      flow: ["light", "medium", "heavy"].includes(str(f, "flow")) ? str(f, "flow") : null,
      symptoms: symptoms || null,
      note: str(f, "note", 300) || null,
    })
    .where(and(eq(S.cycleLog.id, id), eq(S.cycleLog.ownerId, me.spaceId)));
  refresh();
  return { ok: true };
}

export async function deleteCycle(id: string) {
  const me = await requireOwner();
  await db.delete(S.cycleLog).where(and(eq(S.cycleLog.id, id), eq(S.cycleLog.ownerId, me.spaceId)));
  refresh();
}

/* ================= Name ================= */

export async function setMyName(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const name = str(f, "name", 30).replace(/[<>]/g, "");
  if (name.length < 2) return fail("At least 2 letters");
  await db.update(S.user).set({ name, updatedAt: new Date() }).where(eq(S.user.id, me.id));
  refresh();
  return { ok: true };
}

/* ================= Daily check ================= */

export async function moveToTomorrow(id: string) {
  const me = await requireOwner();
  await db
    .update(S.task)
    .set({ dueOn: addDaysISO(todayISO(), 1) })
    .where(and(eq(S.task.id, id), eq(S.task.ownerId, me.spaceId)));
  refresh();
}

export async function moveAllToTomorrow() {
  const me = await requireOwner();
  await db
    .update(S.task)
    .set({ dueOn: addDaysISO(todayISO(), 1) })
    .where(and(eq(S.task.ownerId, me.spaceId), eq(S.task.done, false), sql`${S.task.dueOn} <= ${todayISO()}`));
  refresh();
}

export async function setNoSpend(on: boolean) {
  const me = await requireOwner();
  await db
    .insert(S.dailyCheck)
    .values({ ownerId: me.spaceId, day: todayISO(), noSpend: on })
    .onConflictDoUpdate({ target: [S.dailyCheck.ownerId, S.dailyCheck.day], set: { noSpend: on } });
  refresh();
}

export async function wrapUpDay() {
  const me = await requireOwner();
  await db
    .insert(S.dailyCheck)
    .values({ ownerId: me.spaceId, day: todayISO(), doneAt: new Date() })
    .onConflictDoUpdate({ target: [S.dailyCheck.ownerId, S.dailyCheck.day], set: { doneAt: new Date() } });
  refresh();
}
