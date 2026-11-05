import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { forgetPlaylistCache } from "@/server/spotify";

/** Disconnect my Spotify. The shared song list keeps working through the other person's, if they connected. */
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  await db.delete(schema.spotifyMe).where(eq(schema.spotifyMe.userId, me.id));
  await db.delete(schema.spotifyAuth).where(and(eq(schema.spotifyAuth.ownerId, me.spaceId), eq(schema.spotifyAuth.connectedBy, me.id)));
  forgetPlaylistCache(me.spaceId);
  return NextResponse.json({ ok: true });
}
