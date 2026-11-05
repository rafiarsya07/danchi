import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { playlistTracks } from "@/server/spotify";

/** All songs of one of their playlists. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("playlist") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const [p] = await db.select().from(schema.playlist).where(and(eq(schema.playlist.id, id), eq(schema.playlist.ownerId, me.spaceId))).limit(1);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const tracks = await playlistTracks(me.spaceId, p.uri);
  if (tracks === null) return NextResponse.json({ error: "spotify" }, { status: 502 });
  return NextResponse.json({ tracks }, { headers: { "cache-control": "private, max-age=60" } });
}
