import "server-only";
/**
 * Spotify Web API, through Rafi's own Spotify developer app (Development Mode).
 * Since Feb 2026 Spotify only returns playlist songs to someone who owns or
 * collaborates on the playlist, so he connects his account once (OAuth) and
 * Danchi keeps an encrypted refresh token.
 *
 * .env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
 * Redirect URI in the Spotify dashboard: <APP_URL>/api/spotify/callback
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const ACCOUNTS = () => process.env.SPOTIFY_ACCOUNTS_BASE || "https://accounts.spotify.com";
const API = () => process.env.SPOTIFY_API_BASE || "https://api.spotify.com";
// read your playlists + play songs in your own Spotify app (Spotify Connect, needs Premium)
export const SPOTIFY_SCOPES = "playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state";

export function spotifyReady() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}
export const appUrl = () => (process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
export const redirectUri = () => `${appUrl()}/api/spotify/callback`;

/* ---- tokens are stored encrypted (key derived from the app secret) ---- */
const key = () => createHash("sha256").update(`danchi-spotify:${process.env.BETTER_AUTH_SECRET || "dev"}`).digest();
export function seal(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function unseal(blob: string) {
  const [iv, tag, enc] = blob.split(".");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

const basic = () => "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");

export async function exchangeCode(code: string) {
  const r = await fetch(`${ACCOUNTS()}/api/token`, {
    method: "POST",
    headers: { authorization: basic(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !d.access_token || !d.refresh_token) throw new Error(d.error_description || `Spotify said ${r.status}`);
  return d as { access_token: string; refresh_token: string; expires_in: number };
}

type TokRow = { refreshToken: string; accessToken: string | null; expiresAt: Date | null };

/** A fresh access token for a stored connection, refreshing (and saving) it when it is about to expire. */
async function fresh(row: TokRow | undefined, save: (v: { accessToken: string; expiresAt: Date; refreshToken?: string }) => Promise<unknown>, drop: () => Promise<unknown>) {
  if (!row) return null;
  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000) return unseal(row.accessToken);
  const r = await fetch(`${ACCOUNTS()}/api/token`, {
    method: "POST",
    headers: { authorization: basic(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: unseal(row.refreshToken) }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!r.ok || !d.access_token) {
    if (d.error === "invalid_grant") await drop();
    return null;
  }
  await save({
    accessToken: seal(d.access_token),
    expiresAt: new Date(Date.now() + (d.expires_in ?? 3600) * 1000),
    ...(d.refresh_token ? { refreshToken: seal(d.refresh_token) } : {}),
  });
  return d.access_token;
}

/** The couple's shared connection (reads playlists and searches). Falls back to either person's own. */
async function token(spaceId: string): Promise<string | null> {
  const A = schema.spotifyAuth;
  const [a] = await db.select().from(A).where(eq(A.ownerId, spaceId)).limit(1);
  if (a)
    return fresh(
      a,
      (v) => db.update(A).set({ ...v, updatedAt: new Date() }).where(eq(A.ownerId, spaceId)),
      () => db.delete(A).where(eq(A.ownerId, spaceId)),
    );
  const [m] = await db.select({ userId: schema.spotifyMe.userId }).from(schema.spotifyMe).where(eq(schema.spotifyMe.spaceId, spaceId)).limit(1);
  return m ? userToken(m.userId) : null;
}

/** One person's own connection (plays in their Spotify app). */
export async function userToken(userId: string): Promise<string | null> {
  const M = schema.spotifyMe;
  const [m] = await db.select().from(M).where(eq(M.userId, userId)).limit(1);
  return fresh(
    m,
    (v) => db.update(M).set({ ...v, updatedAt: new Date() }).where(eq(M.userId, userId)),
    () => db.delete(M).where(eq(M.userId, userId)),
  );
}

export async function spotifyGet<T>(spaceId: string, path: string): Promise<T | null> {
  const t = await token(spaceId);
  if (!t) return null;
  const r = await fetch(`${API()}${path}`, { headers: { authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) {
    console.error("[spotify]", r.status, path);
    return null;
  }
  return (await r.json()) as T;
}

export const apiBase = API;
export type Track = { uri: string; name: string; artists: string; image: string | null; ms: number };
type ApiTrack = { uri?: string; name?: string; type?: string; duration_ms?: number; artists?: { name: string }[]; album?: { images?: { url: string; width?: number }[] } };
export const toTrack = (t: ApiTrack | null | undefined): Track | null =>
  t?.uri && t.name && /^spotify:(track|episode):/.test(t.uri)
    ? {
        uri: t.uri,
        name: t.name,
        artists: (t.artists ?? []).map((a) => a.name).join(", "),
        image: [...(t.album?.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url ?? null,
        ms: t.duration_ms ?? 0,
      }
    : null;

/* playlists change rarely: keep their songs for 10 minutes */
const cache = new Map<string, { at: number; tracks: Track[] }>();

export async function playlistTracks(spaceId: string, playlistUri: string): Promise<Track[] | null> {
  const id = playlistUri.split(":")[2];
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return [];
  const hit = cache.get(`${spaceId}:${id}`);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.tracks;
  const out: Track[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    // Feb 2026: /tracks became /items, and each entry's song sits in "item" (older shape: "track")
    const d = await spotifyGet<{ items?: { item?: ApiTrack; track?: ApiTrack }[]; next?: string | null; total?: number }>(spaceId, `/v1/playlists/${id}/items?limit=50&offset=${offset}`);
    if (!d) return out.length ? out : null;
    for (const it of d.items ?? []) {
      const t = toTrack(it.item ?? it.track);
      if (t) out.push(t);
    }
    if (!d.next || !(d.items ?? []).length) break;
    offset += 50;
  }
  cache.set(`${spaceId}:${id}`, { at: Date.now(), tracks: out });
  return out;
}

export async function searchTracks(spaceId: string, q: string): Promise<Track[] | null> {
  const query = q.trim().slice(0, 100);
  if (!query) return [];
  const out: Track[] = [];
  // Development Mode: max 10 per page, so take two pages
  for (const offset of [0, 10]) {
    const d = await spotifyGet<{ tracks?: { items?: ApiTrack[] } }>(spaceId, `/v1/search?type=track&limit=10&offset=${offset}&q=${encodeURIComponent(query)}`);
    if (!d) return out.length ? out : null;
    for (const it of d.tracks?.items ?? []) {
      const t = toTrack(it);
      if (t && !out.some((x) => x.uri === t.uri)) out.push(t);
    }
  }
  return out;
}

export function forgetPlaylistCache(spaceId: string) {
  for (const k of cache.keys()) if (k.startsWith(`${spaceId}:`)) cache.delete(k);
}
