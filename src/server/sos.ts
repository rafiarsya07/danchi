/**
 * SOS: the serious one. Three taps + 5 second countdown on her phone, then:
 *  1. Rafi's Danchi rings (urgent push, even in quiet hours) + email
 *  2. Every SOS number gets a real phone call and an SMS with the live link
 *  3. Her phone keeps sending its location (sos_point) and photos from both
 *     cameras while the SOS screen is open
 *  4. "I'm safe now" ends it and tells everyone
 */
import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { notify } from "./notify";
import { mailLayout } from "./mail";
import { getNames } from "./names";
import { callWithMessage, phoneReady, sendSms, toIntl } from "./phone";
import { prettyTime } from "../lib/time";

export const SOS_LINK_HOURS = 48;
const appUrl = () => (process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
export const sosUrl = (token: string) => `${appUrl()}/sos/${token}`;
const mapLink = (lat: number | null, lng: number | null) => (lat != null && lng != null ? `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}` : null);

export async function sosNumbers(db: Db, ownerId: string): Promise<string[]> {
  const [s] = await db.select({ n: schema.settings.sosNumbers }).from(schema.settings).where(eq(schema.settings.ownerId, ownerId)).limit(1);
  const raw = s?.n?.length ? s.n : (process.env.SOS_NUMBERS || "").split(/[,;\s]+/);
  const out: string[] = [];
  for (const r of raw) {
    const n = toIntl(r);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, 6);
}

export async function activeSos(db: Db, ownerId: string) {
  const [row] = await db
    .select()
    .from(schema.sos)
    .where(and(eq(schema.sos.ownerId, ownerId), eq(schema.sos.status, "active"), gte(schema.sos.createdAt, new Date(Date.now() - 12 * 3600_000))))
    .orderBy(desc(schema.sos.createdAt))
    .limit(1);
  return row ?? null;
}

type Where = { lat?: number | null; lng?: number | null; accuracy?: number | null; battery?: number | null };

/** Create (or reuse the running) SOS. Returns { row, fresh } — fresh means people still need to be alerted. */
export async function startSos(db: Db, ownerId: string, where: Where) {
  const running = await activeSos(db, ownerId);
  if (running) {
    if (where.lat != null && where.lng != null) await addPoint(db, ownerId, running.id, where);
    return { row: running, fresh: false };
  }
  const [row] = await db
    .insert(schema.sos)
    .values({
      ownerId,
      token: randomBytes(24).toString("base64url"),
      lat: where.lat ?? null,
      lng: where.lng ?? null,
      accuracy: where.accuracy ?? null,
      battery: where.battery ?? null,
      lastAt: where.lat != null ? new Date() : null,
    })
    .returning();
  if (where.lat != null && where.lng != null) {
    await db.insert(schema.sosPoint).values({ ownerId, sosId: row.id, lat: where.lat, lng: where.lng, accuracy: where.accuracy ?? null });
  }
  return { row, fresh: true };
}

/** Push, email, phone calls and SMS. Runs right after the SOS is created. */
export async function alertEveryone(db: Db, row: typeof schema.sos.$inferSelect) {
  const N = (await getNames(db)).owner;
  const link = sosUrl(row.token);
  const map = mapLink(row.lat, row.lng);
  const title = `🆘 SOS from ${N}`;
  const body = `${N} pressed SOS. Open now to see her live location and photos.`;

  const tasks: Promise<unknown>[] = [
    notify(db, {
      ownerId: row.ownerId,
      kind: "safety",
      audience: "viewer",
      inbox: true,
      urgent: true,
      title,
      body,
      url: `/sos/${row.token}`,
      pushExtra: { sticky: true, tag: `sos-${row.id}` },
      emailTo: "viewer",
      email: {
        subject: title,
        text: `${body}\n\nLive page: ${link}\n${map ? `Map: ${map}\n` : ""}When: ${prettyTime(row.createdAt)}`,
        html: mailLayout({
          mood: "worried",
          title,
          intro: body,
          blocks: [{ heading: "Right now", emoji: "📍", lines: [`Live page: ${link}`, map ? `Map: ${map}` : "Location is coming in", `When: ${prettyTime(row.createdAt)}`] }],
          cta: { label: "Open live location", path: `/sos/${row.token}` },
        }),
      },
    }).catch((e) => console.error("[sos] notify", e)),
  ];

  const results: (typeof schema.sos.$inferSelect)["calls"] = [];
  if (phoneReady()) {
    const numbers = await sosNumbers(db, row.ownerId);
    const say = `Emergency. ${N} pressed S O S on Danchi. Check your messages now for her live location. ${N} needs you.`;
    const sms = `🆘 SOS from ${N} (Danchi). Live location + photos: ${link}${map ? `\nMap: ${map}` : ""}\nCall her now.`;
    for (const to of numbers) {
      tasks.push(
        callWithMessage(to, say)
          .then((sid) => results.push({ to, kind: "call", ok: true, info: sid }))
          .catch((e) => results.push({ to, kind: "call", ok: false, info: String((e as Error).message).slice(0, 160) })),
        sendSms(to, sms)
          .then((sid) => results.push({ to, kind: "sms", ok: true, info: sid }))
          .catch((e) => results.push({ to, kind: "sms", ok: false, info: String((e as Error).message).slice(0, 160) })),
      );
    }
  }
  await Promise.all(tasks);
  if (results.length) await db.update(schema.sos).set({ calls: results }).where(eq(schema.sos.id, row.id));
  return results;
}

export async function addPoint(db: Db, ownerId: string, sosId: string, w: Where) {
  if (w.lat == null || w.lng == null || !Number.isFinite(w.lat) || !Number.isFinite(w.lng)) return false;
  const [row] = await db
    .select({ id: schema.sos.id, status: schema.sos.status })
    .from(schema.sos)
    .where(and(eq(schema.sos.id, sosId), eq(schema.sos.ownerId, ownerId)))
    .limit(1);
  if (!row || row.status !== "active") return false;
  await db.insert(schema.sosPoint).values({ ownerId, sosId, lat: w.lat, lng: w.lng, accuracy: w.accuracy ?? null });
  await db
    .update(schema.sos)
    .set({ lat: w.lat, lng: w.lng, accuracy: w.accuracy ?? null, lastAt: new Date(), ...(w.battery != null ? { battery: w.battery } : {}) })
    .where(eq(schema.sos.id, sosId));
  return true;
}

/** "I'm safe now". Everyone who was alerted hears it. */
export async function endSos(db: Db, ownerId: string, sosId: string) {
  const [row] = await db
    .update(schema.sos)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(schema.sos.id, sosId), eq(schema.sos.ownerId, ownerId), eq(schema.sos.status, "active")))
    .returning();
  if (!row) return false;
  const N = (await getNames(db)).owner;
  const tasks: Promise<unknown>[] = [
    notify(db, {
      ownerId,
      kind: "safety",
      audience: "viewer",
      urgent: true,
      title: `💛 ${N} says she's safe now`,
      body: "She ended the SOS. Maybe give her a call anyway.",
      url: "/safe",
      pushExtra: { tag: `sos-${row.id}` },
    }).catch(() => {}),
  ];
  if (phoneReady() && row.calls.length) {
    for (const to of await sosNumbers(db, ownerId)) tasks.push(sendSms(to, `💛 ${N} ended her SOS and says she's safe now (Danchi).`).catch(() => {}));
  }
  await Promise.all(tasks);
  return true;
}

/** For the no-login live page: only with the secret token, only while fresh. */
export async function sosByToken(db: Db, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [row] = await db.select().from(schema.sos).where(eq(schema.sos.token, token)).limit(1);
  if (!row) return null;
  if (row.status === "ended" && row.endedAt && Date.now() - row.endedAt.getTime() > SOS_LINK_HOURS * 3600_000) return null;
  if (Date.now() - row.createdAt.getTime() > 7 * 24 * 3600_000) return null;
  return row;
}

export async function sosDetails(db: Db, row: typeof schema.sos.$inferSelect) {
  const [points, photos] = await Promise.all([
    db.select().from(schema.sosPoint).where(eq(schema.sosPoint.sosId, row.id)).orderBy(desc(schema.sosPoint.at)).limit(40),
    db
      .select({ id: schema.file.id, name: schema.file.name, at: schema.file.createdAt })
      .from(schema.file)
      .where(and(eq(schema.file.refType, "sos"), eq(schema.file.refId, row.id)))
      .orderBy(desc(schema.file.createdAt))
      .limit(12),
  ]);
  return { points, photos };
}

/** Everything the Safety page needs about SOS. */
export async function getSosInfo(db: Db, ownerId: string) {
  const [numbers, active, recent, st] = await Promise.all([
    sosNumbers(db, ownerId),
    activeSos(db, ownerId),
    db.select().from(schema.sos).where(eq(schema.sos.ownerId, ownerId)).orderBy(desc(schema.sos.createdAt)).limit(5),
    db.select({ cam: schema.settings.sosCamera }).from(schema.settings).where(eq(schema.settings.ownerId, ownerId)).limit(1),
  ]);
  return { numbers, active, recent, phoneReady: phoneReady(), camera: !!st[0]?.cam };
}

/** SOS photos never stay longer than a week. Runs from the worker. */
export async function purgeOldSosPhotos(db: Db) {
  // (no "server-only" files.ts here: the worker runs outside Next)
  const { unlink } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads"));
  const removeStored = async (n: string) => {
    if (/^[a-f0-9]{36}\.[a-z]{2,4}$/.test(n)) await unlink(path.join(/* turbopackIgnore: true */ dir, n)).catch(() => {});
  };
  const old = await db
    .delete(schema.file)
    .where(and(eq(schema.file.refType, "sos"), lt(schema.file.createdAt, new Date(Date.now() - 7 * 86_400_000))))
    .returning({ storedName: schema.file.storedName });
  for (const f of old) await removeStored(f.storedName);
  return old.length;
}

/** Ring every SOS number once with a calm test message, and say exactly what went wrong if it fails. */
export async function testSosCalls(db: Db, ownerId: string) {
  if (!phoneReady()) return { ready: false as const, results: [] };
  const N = (await getNames(db)).owner;
  const numbers = await sosNumbers(db, ownerId);
  const results = await Promise.all(
    numbers.map(async (to) => {
      try {
        await callWithMessage(to, `Hello. This is only a test of ${N}'s Danchi S O S. Nothing is wrong. If you hear this, S O S calls work.`);
        return { to, ok: true, info: "Ringing now" };
      } catch (e) {
        return { to, ok: false, info: String((e as Error).message).slice(0, 220) };
      }
    }),
  );
  return { ready: true as const, results };
}
