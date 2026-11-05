import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { allow } from "@/lib/rate";
import { isTrackUri } from "@/lib/spotify";
import { after } from "next/server";
import { pushLoad, pushPause } from "@/server/spotify-player";

/**
 * Playback updates from a phone that is listening. The DJ sends track, position
 * and pause; the other one may only pause or resume for both.
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  if (!allow(`listen:${me.id}`, 60, 60_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { trackUri?: string; positionMs?: number; paused?: boolean };
  const [l] = await db.select().from(schema.listen).where(eq(schema.listen.ownerId, me.spaceId)).limit(1);
  if (!l?.active || !l.listeners.includes(me.id)) return NextResponse.json({ ok: false });
  const pos = Math.max(0, Math.min(3_600_000, Math.round(Number(b.positionMs) || 0)));
  const set: Partial<typeof schema.listen.$inferInsert> = { updatedAt: new Date(), positionMs: pos };
  if (typeof b.paused === "boolean") set.paused = b.paused;
  if (l.djUserId === me.id && isTrackUri(b.trackUri)) set.trackUri = b.trackUri!;
  await db.update(schema.listen).set(set).where(eq(schema.listen.ownerId, me.spaceId));
  // anyone listening in their Spotify app follows what happened in this Danchi player
  const newSong = !!set.trackUri && set.trackUri !== l.trackUri;
  const pauseFlip = typeof set.paused === "boolean" && set.paused !== l.paused;
  if (newSong || pauseFlip) {
    after(async () => {
      const others = l.listeners.filter((x) => x !== me.id);
      if (newSong) await pushLoad({ ...l, ...set } as typeof l, others);
      else await pushPause(l, set.paused!, me.id);
    });
  }
  return NextResponse.json({ ok: true });
}
