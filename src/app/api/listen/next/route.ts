import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";

/** The DJ's song ended: move on to the next one in the queue (once per song). */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { seq?: number };
  const [l] = await db.select().from(schema.listen).where(eq(schema.listen.ownerId, me.spaceId)).limit(1);
  if (!l?.active || l.djUserId !== me.id || l.seq !== Number(b.seq) || !l.queue.length) return NextResponse.json({ ok: false });
  const [next, ...rest] = l.queue;
  await db.update(schema.listen).set({ trackUri: next, queue: rest, positionMs: 0, paused: false, seq: l.seq + 1, updatedAt: new Date() }).where(eq(schema.listen.ownerId, me.spaceId));
  return NextResponse.json({ ok: true });
}
