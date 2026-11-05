/**
 * Safety check ins. Every message here goes to the viewer (Rafi) right away,
 * rings even during quiet hours, and is saved so she can see what was sent.
 */
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { notify } from "./notify";
import { mailLayout } from "./mail";
import { prettyTime } from "../lib/time";
import { getNames } from "./names";

export type CheckinKind = "safe" | "omw" | "help";

const ownerName = async (db: Db) => (await getNames(db)).owner;
export const mapLink = (lat: number | null, lng: number | null) =>
  lat != null && lng != null ? `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}` : null;

const TEXT: Record<CheckinKind, { title: (n: string) => string; body: string; mood: "cheer" | "wave" | "worried" }> = {
  safe: { title: (n) => `🏠 ${n} is home safe`, body: "All good! She made it 💛", mood: "cheer" },
  omw: { title: (n) => `🚶 ${n} is on her way`, body: "She'll check in when she arrives.", mood: "wave" },
  help: { title: (n) => `🆘 ${n} needs you`, body: "She tapped Need you in Danchi. Call her now.", mood: "worried" },
};

export async function sendCheckin(
  db: Db,
  ownerId: string,
  kind: CheckinKind,
  opts: { message?: string | null; lat?: number | null; lng?: number | null } = {},
) {
  const N = await ownerName(db);
  const [row] = await db
    .insert(schema.checkin)
    .values({ ownerId, kind, message: opts.message || null, lat: opts.lat ?? null, lng: opts.lng ?? null, status: "sent" })
    .returning();
  // "Home safe" also ends any running timer.
  if (kind === "safe") await closeTimers(db, ownerId, "safe");

  const t = TEXT[kind];
  const map = mapLink(row.lat, row.lng);
  const lines = [opts.message ? `"${opts.message}"` : "", map ? `Where: ${map}` : "", `When: ${prettyTime(row.createdAt)}`].filter(Boolean);
  await notify(db, {
    ownerId,
    kind: "safety",
    audience: "viewer",
    inbox: false,
    urgent: true,
    title: t.title(N),
    body: [opts.message, t.body].filter(Boolean).join(" "),
    url: map ?? "/safe",
    pushExtra: { sticky: kind === "help", tag: `safety-${row.id}` },
    emailTo: "viewer",
    email:
      kind === "help"
        ? {
            subject: t.title(N),
            text: `${t.body}\n\n${lines.join("\n")}`,
            html: mailLayout({ mood: "worried", title: t.title(N), intro: t.body, blocks: [{ heading: "Details", emoji: "📍", lines }], cta: { label: "Open Danchi", path: "/safe" } }),
          }
        : null,
  });
  return row;
}

/** "I should be home by ...". If she doesn't tap I'm safe, Rafi hears about it. */
export async function startTimer(db: Db, ownerId: string, dueAt: Date, message: string | null, where?: { lat: number; lng: number } | null) {
  const N = await ownerName(db);
  await closeTimers(db, ownerId, "cancelled");
  const [row] = await db
    .insert(schema.checkin)
    .values({ ownerId, kind: "timer", status: "active", dueAt, message, lat: where?.lat ?? null, lng: where?.lng ?? null })
    .returning();
  await notify(db, {
    ownerId,
    kind: "safety",
    audience: "viewer",
    inbox: false,
    title: `🧭 ${N} started a safe arrival timer`,
    body: `${message ? `${message}. ` : ""}She should be there by ${prettyTime(dueAt)}. You'll hear if she doesn't check in.`,
    url: "/safe",
  });
  return row;
}

async function closeTimers(db: Db, ownerId: string, status: "safe" | "cancelled") {
  const open = await db
    .select()
    .from(schema.checkin)
    .where(and(eq(schema.checkin.ownerId, ownerId), eq(schema.checkin.kind, "timer"), inArray(schema.checkin.status, ["active", "alerted"])));
  if (!open.length) return [];
  await db
    .update(schema.checkin)
    .set({ status })
    .where(inArray(schema.checkin.id, open.map((o) => o.id)));
  return open;
}

/** She tapped "I'm safe" on a timer (or from the notification). */
export async function timerSafe(db: Db, ownerId: string) {
  const N = await ownerName(db);
  const closed = await closeTimers(db, ownerId, "safe");
  if (!closed.length) return false;
  const wasAlerted = closed.some((c) => c.status === "alerted");
  await notify(db, {
    ownerId,
    kind: "safety",
    audience: "viewer",
    inbox: false,
    urgent: wasAlerted,
    title: `🏠 ${N} checked in safe`,
    body: wasAlerted ? "Phew. She's okay now 💛" : "Arrived safely 💛",
    url: "/safe",
  });
  return true;
}

export async function extendTimer(db: Db, ownerId: string, minutes = 15) {
  const [t] = await db
    .select()
    .from(schema.checkin)
    .where(and(eq(schema.checkin.ownerId, ownerId), eq(schema.checkin.kind, "timer"), inArray(schema.checkin.status, ["active", "alerted"])))
    .orderBy(desc(schema.checkin.createdAt))
    .limit(1);
  if (!t) return null;
  const base = Math.max(Date.now(), t.dueAt?.getTime() ?? Date.now());
  const dueAt = new Date(base + minutes * 60_000);
  await db.update(schema.checkin).set({ dueAt, status: "active", nudgedAt: null }).where(eq(schema.checkin.id, t.id));
  return dueAt;
}

export async function cancelTimer(db: Db, ownerId: string) {
  return (await closeTimers(db, ownerId, "cancelled")).length > 0;
}

const GRACE_MS = 10 * 60_000;

/** Worker: at the due time ask her, 10 minutes later tell Rafi. */
export async function runSafetyTimers(db: Db, now = new Date()) {
  const N = await ownerName(db);
  const due = await db
    .select()
    .from(schema.checkin)
    .where(and(eq(schema.checkin.kind, "timer"), eq(schema.checkin.status, "active"), lte(schema.checkin.dueAt, now)));
  let n = 0;
  for (const t of due) {
    if (!t.nudgedAt) {
      await db.update(schema.checkin).set({ nudgedAt: now }).where(eq(schema.checkin.id, t.id));
      await notify(db, {
        ownerId: t.ownerId,
        kind: "safety",
        audience: "owner",
        inbox: false,
        urgent: true,
        title: "Did you make it? 🧭",
        body: "Tap I'm safe so Rafi doesn't worry. If you don't, he'll get a heads up in 10 minutes.",
        url: "/safe",
        pushExtra: {
          checkinId: t.id,
          sticky: true,
          tag: `timer-${t.id}`,
          actions: [
            { action: "safe", title: "✓ I'm safe" },
            { action: "later", title: "+15 min" },
          ],
        },
      });
      n++;
      continue;
    }
    if (now.getTime() - (t.dueAt?.getTime() ?? 0) < GRACE_MS) continue;
    await db.update(schema.checkin).set({ status: "alerted", alertedAt: now }).where(eq(schema.checkin.id, t.id));
    const map = mapLink(t.lat, t.lng);
    const lines = [
      t.message ? `Plan: ${t.message}` : "",
      `Expected by: ${prettyTime(t.dueAt!)}`,
      map ? `Where she started: ${map}` : "",
    ].filter(Boolean);
    await notify(db, {
      ownerId: t.ownerId,
      kind: "safety",
      audience: "viewer",
      inbox: false,
      urgent: true,
      title: `⚠️ ${N} hasn't checked in`,
      body: `She was due by ${prettyTime(t.dueAt!)}. Maybe give her a call?`,
      url: "/safe",
      pushExtra: { sticky: true, tag: `timer-alert-${t.id}` },
      emailTo: "viewer",
      email: {
        subject: `⚠️ ${N} hasn't checked in yet`,
        text: `Her safe arrival timer ran out without a check in.\n\n${lines.join("\n")}\n\nIt's probably nothing (a dead battery, a long chat), but maybe give her a call.`,
        html: mailLayout({
          mood: "worried",
          title: `${N} hasn't checked in`,
          intro: "Her safe arrival timer ran out without a check in. It's probably nothing, but maybe give her a call.",
          blocks: [{ heading: "Details", emoji: "🧭", lines }],
          cta: { label: "Open Danchi", path: "/safe" },
        }),
      },
    });
    n++;
  }
  return n;
}
