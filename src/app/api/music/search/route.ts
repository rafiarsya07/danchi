import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { allow } from "@/lib/rate";
import { playlistTracks, searchTracks } from "@/server/spotify";

/** Search: songs in their own playlists first, then all of Spotify. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  if (!allow(`msearch:${me.id}`, 40, 60_000)) return NextResponse.json({ error: "slow down" }, { status: 429 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ ours: [], spotify: [] });
  const lists = await db.select().from(schema.playlist).where(eq(schema.playlist.ownerId, me.spaceId));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const ours: { playlistId: string; playlist: string; index: number; uri: string; name: string; artists: string; image: string | null; ms: number }[] = [];
  for (const p of lists) {
    const tracks = (await playlistTracks(me.spaceId, p.uri)) ?? [];
    tracks.forEach((t, index) => {
      const hay = `${t.name} ${t.artists}`.toLowerCase();
      if (words.every((w) => hay.includes(w))) ours.push({ ...t, playlistId: p.id, playlist: p.name, index });
    });
  }
  const spotify = (await searchTracks(me.spaceId, q)) ?? [];
  return NextResponse.json({ ours: ours.slice(0, 30), spotify: spotify.filter((s) => !ours.some((o) => o.uri === s.uri)) });
}
