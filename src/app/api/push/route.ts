import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

const sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** Save this device's push subscription for the signed in user. */
export async function POST(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const parsed = sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db
    .insert(schema.pushSubscription)
    .values({ userId: s.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) })
    .onConflictDoUpdate({
      target: schema.pushSubscription.endpoint,
      set: { userId: s.user.id, p256dh: keys.p256dh, auth: keys.auth },
    });
  return NextResponse.json({ ok: true });
}

/** Forget this device. */
export async function DELETE(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (body?.endpoint) {
    await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.endpoint, body.endpoint));
  }
  return NextResponse.json({ ok: true });
}
