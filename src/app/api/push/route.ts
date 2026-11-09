import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  /** The subscription this one replaces (browser renewed it) */
  oldEndpoint: z.string().url().max(1000).optional(),
});

async function countDevices(userId: string) {
  const rows = await db.select({ id: schema.pushSubscription.id }).from(schema.pushSubscription).where(eq(schema.pushSubscription.userId, userId));
  return rows.length;
}

/** The public push key + how many devices this person has (used to repair subscriptions). */
export async function GET() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, devices: await countDevices(s.user.id) });
}

/** Save (or refresh) this device's push subscription for the signed in user. */
export async function POST(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const parsed = sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  const { endpoint, keys, oldEndpoint } = parsed.data;

  if (oldEndpoint && oldEndpoint !== endpoint) {
    await db
      .delete(schema.pushSubscription)
      .where(and(eq(schema.pushSubscription.endpoint, oldEndpoint), eq(schema.pushSubscription.userId, s.user.id)));
  }
  const [row] = await db
    .insert(schema.pushSubscription)
    .values({ userId: s.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) })
    .onConflictDoUpdate({
      target: schema.pushSubscription.endpoint,
      set: { userId: s.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) },
    })
    .returning({ lastOkAt: schema.pushSubscription.lastOkAt });

  // Same browser, older dead subscription from before an update: drop it so
  // the worker doesn't keep trying it.
  const ua = req.headers.get("user-agent")?.slice(0, 200);
  if (ua) {
    await db
      .delete(schema.pushSubscription)
      .where(
        and(
          eq(schema.pushSubscription.userId, s.user.id),
          eq(schema.pushSubscription.userAgent, ua),
          ne(schema.pushSubscription.endpoint, endpoint),
        ),
      );
  }

  return NextResponse.json({ ok: true, lastOkAt: row?.lastOkAt?.toISOString() ?? null, devices: await countDevices(s.user.id) });
}

/** Forget this device. */
export async function DELETE(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (body?.endpoint) {
    await db
      .delete(schema.pushSubscription)
      .where(and(eq(schema.pushSubscription.endpoint, body.endpoint), eq(schema.pushSubscription.userId, s.user.id)));
  }
  return NextResponse.json({ ok: true });
}
