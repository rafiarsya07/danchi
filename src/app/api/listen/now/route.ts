import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { allow } from "@/lib/rate";
import { appUsers, expectedPosOf, nowFor, playFor, whatOfDj } from "@/server/spotify-player";

/**
 * What my Spotify app is playing right now (for the Danchi card). When I'm the DJ,
 * this also keeps the shared session up to date; when I'm not and my phone
 * drifted to another song, it puts me back on the DJ's song.
 */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  if (!allow(`listen-now:${me.id}`, 20, 60_000)) return NextResponse.json({ now: null }, { status: 429 });
  const [mine] = await db.select({ problem: schema.spotifyMe.problem, app: schema.spotifyMe.useApp }).from(schema.spotifyMe).where(eq(schema.spotifyMe.userId, me.id)).limit(1);
  const now = await nowFor(me.id);
  // playing fine again (Spotify opened, Premium back): forget the old problem
  if (now?.playing && mine?.app && mine.problem) await db.update(schema.spotifyMe).set({ problem: null }).where(eq(schema.spotifyMe.userId, me.id));
  const [l] = await db.select().from(schema.listen).where(eq(schema.listen.ownerId, me.spaceId)).limit(1);
  if (now && l?.active && l.listeners.includes(me.id)) {
    if (l.djUserId === me.id) {
      const set: Partial<typeof schema.listen.$inferInsert> = { positionMs: now.progress, paused: !now.playing, updatedAt: new Date() };
      if (now.uri !== l.trackUri) {
        set.trackUri = now.uri;
        const at = l.queue.indexOf(now.uri);
        if (at >= 0) set.queue = l.queue.slice(at + 1);
      }
      // only write real changes (every write refreshes both phones)
      const drift = Math.abs(expectedPosOf(l) - now.progress) > 10_000;
      if (set.trackUri || set.paused !== l.paused || drift) await db.update(schema.listen).set(set).where(eq(schema.listen.ownerId, me.spaceId));
    } else if (now.playing && !l.paused && l.djUserId && (await appUsers([l.djUserId])).length) {
      const dj = await nowFor(l.djUserId);
      if (dj?.playing && dj.uri !== now.uri) {
        const w = await whatOfDj(l);
        if (w) await playFor(me.id, w);
      }
    }
  }
  return NextResponse.json({ now, problem: now?.playing ? null : (mine?.problem ?? null) });
}
