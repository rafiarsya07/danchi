import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { appUrl, exchangeCode, forgetPlaylistCache, seal } from "@/server/spotify";

export async function GET(req: NextRequest) {
  const me = await currentUser();
  const back = (q: string) => NextResponse.redirect(new URL(`/music?${q}`, appUrl()));
  if (!me) return NextResponse.redirect(new URL("/login", appUrl()));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get("danchi_sp_state")?.value;
  if (req.nextUrl.searchParams.get("error")) return back("spotify=denied");
  if (!code || !state || !saved || state !== saved) return back("spotify=failed");
  try {
    const t = await exchangeCode(code);
    let name: string | null = null;
    try {
      const r = await fetch(`${process.env.SPOTIFY_API_BASE || "https://api.spotify.com"}/v1/me`, { headers: { authorization: `Bearer ${t.access_token}` } });
      name = ((await r.json()) as { display_name?: string }).display_name ?? null;
    } catch {}
    const values = {
      connectedBy: me.id,
      displayName: name,
      refreshToken: seal(t.refresh_token),
      accessToken: seal(t.access_token),
      expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
      updatedAt: new Date(),
    };
    // my own Spotify (plays in my Spotify app)
    const mine = { spaceId: me.spaceId, displayName: name, refreshToken: values.refreshToken, accessToken: values.accessToken, expiresAt: values.expiresAt, problem: null, updatedAt: new Date() };
    await db.insert(schema.spotifyMe).values({ userId: me.id, ...mine }).onConflictDoUpdate({ target: schema.spotifyMe.userId, set: mine });
    // the shared one for song lists + search: the first person who connects (or them again)
    const [shared] = await db.select({ by: schema.spotifyAuth.connectedBy }).from(schema.spotifyAuth).where(eq(schema.spotifyAuth.ownerId, me.spaceId)).limit(1);
    if (!shared || !shared.by || shared.by === me.id)
      await db.insert(schema.spotifyAuth).values({ ownerId: me.spaceId, ...values }).onConflictDoUpdate({ target: schema.spotifyAuth.ownerId, set: values });
    forgetPlaylistCache(me.spaceId);
    const res = back("spotify=connected");
    res.cookies.delete({ name: "danchi_sp_state", path: "/api/spotify" });
    return res;
  } catch (e) {
    console.error("[spotify] connect", (e as Error).message);
    return back("spotify=failed");
  }
}
