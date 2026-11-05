import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Me } from "@/lib/session";

/**
 * Optional PIN lock on top of Google sign in. If her phone is unlocked in
 * someone else's hands, Danchi still asks for her PIN after a few quiet minutes.
 *
 * The unlock lives in a signed, httpOnly cookie tied to this session and
 * expires `lockMinutes` after the last activity (the app keeps it fresh while
 * she's using it). A brand new Google sign in counts as unlocked for a moment,
 * so "forgot my PIN" is just: sign in with Google again.
 */
export const UNLOCK_COOKIE = "danchi_unlock";
export const FRESH_SIGNIN_MS = 3 * 60_000;

const secret = () => process.env.BETTER_AUTH_SECRET || "danchi-dev-secret";

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(pin, salt, 32).toString("base64url");
  return `${salt}:${hash}`;
}

export function checkPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "base64url");
  const b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function unlockToken(userId: string, sessionId: string, exp: number) {
  const payload = Buffer.from(`${userId}|${sessionId}|${exp}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): { userId: string; sessionId: string; exp: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = sign(payload);
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const [userId, sessionId, exp] = Buffer.from(payload, "base64url").toString().split("|");
  return { userId, sessionId, exp: Number(exp) };
}

export async function getLock(userId: string) {
  const [row] = await db.select().from(schema.userLock).where(eq(schema.userLock.userId, userId)).limit(1);
  return row ?? null;
}

/** True when this person has a PIN and hasn't unlocked recently. */
export async function isLocked(me: Me): Promise<boolean> {
  const lock = await getLock(me.id);
  if (!lock) return false;
  if (Date.now() - me.sessionCreatedAt.getTime() < FRESH_SIGNIN_MS) return false;
  const t = readToken((await cookies()).get(UNLOCK_COOKIE)?.value);
  return !(t && t.userId === me.id && t.sessionId === me.sessionId && t.exp > Date.now());
}

/** Give (or refresh) the unlock cookie. Only call from Server Actions / Route Handlers. */
export async function grantUnlock(me: Me, minutes: number) {
  const exp = Date.now() + minutes * 60_000;
  (await cookies()).set(UNLOCK_COOKIE, unlockToken(me.id, me.sessionId, exp), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export async function clearUnlock() {
  (await cookies()).delete(UNLOCK_COOKIE);
}
