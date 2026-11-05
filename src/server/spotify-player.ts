import "server-only";
/**
 * Spotify Connect: Danchi tells each person's own Spotify app what to play.
 * Full songs, keeps playing with the screen off. Needs Spotify Premium and the
 * person's own connection (spotify_me). Embeds on phones only play 30s previews,
 * so this is how phones get whole songs.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiBase, toTrack, userToken, type Track } from "@/server/spotify";

export type Problem = "no-device" | "premium" | "not-added" | "auth" | "error";
type Listen = typeof schema.listen.$inferSelect;
export type Now = (Track & { progress: number; playing: boolean; context: string | null; device: string | null }) | null;

const M = schema.spotifyMe;

async function call(tok: string, method: string, path: string, body?: unknown) {
  return fetch(`${apiBase()}${path}`, {
    method,
    headers: { authorization: `Bearer ${tok}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
}

async function problemOf(r: Response): Promise<Problem> {
  if (r.status === 401) return "auth";
  if (r.status === 404) return "no-device";
  if (r.status === 403) {
    const t = await r.text().catch(() => "");
    if (/registered/i.test(t)) return "not-added";
    if (/premium/i.test(t)) return "premium";
    return "premium";
  }
  return "error";
}

async function remember(userId: string, problem: Problem | null) {
  // a Free account can't be played from Danchi: fall back to the small Danchi player
  await db
    .update(M)
    .set({ problem, ...(problem === "premium" ? { useApp: false } : {}) })
    .where(eq(M.userId, userId))
    .catch(() => {});
}

/** Run a player command; when no phone is active yet, wake the best device and try once more. */
async function command(userId: string, method: string, path: string, body?: unknown): Promise<Problem | null> {
  const tok = await userToken(userId);
  if (!tok) {
    await remember(userId, "auth");
    return "auth";
  }
  try {
    let r = await call(tok, method, path, body);
    if (r.status === 404) {
      const d = await call(tok, "GET", "/v1/me/player/devices");
      const list = d.ok ? (((await d.json()) as { devices?: { id: string | null; is_active?: boolean; type?: string; is_restricted?: boolean }[] }).devices ?? []) : [];
      const usable = list.filter((x) => x.id && !x.is_restricted);
      const dev = usable.find((x) => x.is_active) ?? usable.find((x) => /smartphone/i.test(x.type ?? "")) ?? usable[0];
      if (!dev) {
        await remember(userId, "no-device");
        return "no-device";
      }
      r = await call(tok, method, `${path}${path.includes("?") ? "&" : "?"}device_id=${encodeURIComponent(dev.id!)}`, body);
    }
    if (r.ok) {
      await remember(userId, null);
      return null;
    }
    const p = await problemOf(r);
    console.error("[spotify-player]", method, path, r.status);
    await remember(userId, p);
    return p;
  } catch (e) {
    console.error("[spotify-player]", (e as Error).message);
    return "error";
  }
}

export type PlayWhat = { context?: string | null; offsetUri?: string | null; uris?: string[]; positionMs?: number };

export async function playFor(userId: string, w: PlayWhat) {
  const body: Record<string, unknown> = { position_ms: Math.max(0, Math.round(w.positionMs ?? 0)) };
  if (w.context) {
    body.context_uri = w.context;
    body.offset = w.offsetUri ? { uri: w.offsetUri } : { position: 0 };
  } else if (w.uris?.length) body.uris = w.uris.slice(0, 50);
  else return "error" as Problem;
  const p = await command(userId, "PUT", "/v1/me/player/play", body);
  // same order on both phones
  if (!p) await command(userId, "PUT", "/v1/me/player/shuffle?state=false");
  return p;
}
export const resumeFor = (userId: string) => command(userId, "PUT", "/v1/me/player/play");
export const pauseFor = (userId: string) => command(userId, "PUT", "/v1/me/player/pause");
export const nextFor = (userId: string) => command(userId, "POST", "/v1/me/player/next");

export async function nowFor(userId: string): Promise<Now> {
  const tok = await userToken(userId);
  if (!tok) return null;
  try {
    const r = await call(tok, "GET", "/v1/me/player");
    if (r.status === 204 || !r.ok) return null;
    const d = (await r.json()) as { is_playing?: boolean; progress_ms?: number; item?: Parameters<typeof toTrack>[0]; context?: { uri?: string } | null; device?: { name?: string } };
    const t = toTrack(d.item);
    if (!t) return null;
    return { ...t, progress: d.progress_ms ?? 0, playing: !!d.is_playing, context: d.context?.uri ?? null, device: d.device?.name ?? null };
  } catch {
    return null;
  }
}

/** Who of these listeners plays through their own Spotify app. */
export async function appUsers(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await db.select({ id: M.userId }).from(M).where(and(inArray(M.userId, ids), eq(M.useApp, true)));
  return rows.map((r) => r.id);
}

export const expectedPosOf = (l: Pick<Listen, "paused" | "positionMs" | "updatedAt">) =>
  l.paused ? l.positionMs : l.positionMs + Math.max(0, Date.now() - l.updatedAt.getTime());

/** What the shared session says should be playing right now. */
export function whatOf(l: Listen): PlayWhat | null {
  const positionMs = l.trackUri ? expectedPosOf(l) : 0;
  if (l.playlistUri?.startsWith("spotify:playlist:") && l.trackUri) return { context: l.playlistUri, offsetUri: l.trackUri, positionMs };
  if (l.trackUri) return { uris: [l.trackUri, ...l.queue.slice(0, 49)], positionMs };
  if (l.playlistUri) return { context: l.playlistUri, positionMs: 0 };
  return null;
}

/** Copy the DJ's Spotify app exactly (song + second), when the DJ plays in the app. */
export async function whatOfDj(l: Listen): Promise<PlayWhat | null> {
  if (l.djUserId && (await appUsers([l.djUserId])).length) {
    const n = await nowFor(l.djUserId);
    if (n) {
      if (n.context?.startsWith("spotify:playlist:") || n.context?.startsWith("spotify:album:")) return { context: n.context, offsetUri: n.uri, positionMs: n.progress };
      const at = l.queue.indexOf(n.uri);
      return { uris: [n.uri, ...(at >= 0 ? l.queue.slice(at + 1) : l.queue).slice(0, 49)], positionMs: n.progress };
    }
  }
  return whatOf(l);
}

/** Send the session to everyone (or some) who listens in their Spotify app. */
export async function pushLoad(l: Listen, only?: string[]) {
  const who = await appUsers(only ?? l.listeners);
  const w = whatOf(l);
  if (!w || !who.length) return;
  await Promise.all(who.map((u) => (l.paused ? null : playFor(u, w))));
}

export async function pushPause(l: Listen, paused: boolean, except?: string) {
  const who = (await appUsers(l.listeners)).filter((u) => u !== except);
  await Promise.all(who.map((u) => (paused ? pauseFor(u) : resumeFor(u))));
}
