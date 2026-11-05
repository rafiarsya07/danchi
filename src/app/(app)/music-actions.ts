"use server";

/**
 * Listen together: one shared Spotify session per couple. Whoever presses play
 * is the DJ; the other phone only plays after they tap Join (their choice).
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMe } from "@/lib/session";
import { isTrackUri, spotifyUri } from "@/lib/spotify";
import { playlistTracks } from "@/server/spotify";
import { appUsers, nextFor, pauseFor, playFor, pushLoad, pushPause, whatOfDj, nowFor, type Problem } from "@/server/spotify-player";
import { notify } from "@/server/notify";
import type { ActionResult } from "./actions";

const S = schema;
const refresh = () => revalidatePath("/", "layout");
const listenOf = async (spaceId: string) => (await db.select().from(S.listen).where(eq(S.listen.ownerId, spaceId)).limit(1))[0];

export async function addPlaylist(_: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await getMe();
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  const uri = spotifyUri(String(f.get("url") ?? ""));
  if (!uri) return { ok: false, error: "Paste a Spotify playlist link (Share, Copy link)" };
  const count = await db.$count(S.playlist, eq(S.playlist.ownerId, me.spaceId));
  if (count >= 8) return { ok: false, error: "That's a lot of playlists! Remove one first" };
  await db.insert(S.playlist).values({ ownerId: me.spaceId, name: name || "Our playlist", uri, addedBy: me.id });
  refresh();
  return { ok: true };
}

export async function removePlaylist(id: string) {
  const me = await getMe();
  await db.delete(S.playlist).where(and(eq(S.playlist.id, id), eq(S.playlist.ownerId, me.spaceId)));
  refresh();
}

/** Start playing a playlist for both. The partner gets an invite, nothing plays on their phone until they join. */
export async function startListen(playlistId: string) {
  const me = await getMe();
  const [p] = await db.select().from(S.playlist).where(and(eq(S.playlist.id, playlistId), eq(S.playlist.ownerId, me.spaceId))).limit(1);
  if (!p) return { ok: false };
  const [cur] = await db.select().from(S.listen).where(eq(S.listen.ownerId, me.spaceId)).limit(1);
  const keep = cur?.active ? cur.listeners : [];
  const values = {
    active: true,
    playlistName: p.name,
    playlistUri: p.uri,
    trackUri: null,
    positionMs: 0,
    paused: false,
    djUserId: me.id,
    listeners: [...new Set([...keep, me.id])],
    queue: [],
    seq: (cur?.seq ?? 0) + 1,
    updatedAt: new Date(),
  };
  await db.insert(S.listen).values({ ownerId: me.spaceId, ...values }).onConflictDoUpdate({ target: S.listen.ownerId, set: values });
  const row = await listenOf(me.spaceId);
  if (row) await pushLoad(row);
  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: `🎧 ${me.name} wants to listen together`,
    body: `${p.name}. Open Danchi and tap Join on Chichi Island.`,
    url: "/music",
  }).catch(() => {});
  refresh();
  return { ok: true };
}

/**
 * Play one song for both (from a playlist list or a search). Whoever picks becomes
 * the DJ. From a playlist, the rest of that playlist plays after it.
 */
export async function playTrack(uri: string, playlistId?: string | null, index?: number | null) {
  const me = await getMe();
  if (!isTrackUri(uri)) return { ok: false };
  let queue: string[] = [];
  let name = "Picked songs";
  let listUri: string | null = null;
  if (playlistId && /^[0-9a-f-]{36}$/i.test(playlistId)) {
    const [p] = await db.select().from(S.playlist).where(and(eq(S.playlist.id, playlistId), eq(S.playlist.ownerId, me.spaceId))).limit(1);
    if (p) {
      name = p.name;
      listUri = p.uri;
      const tracks = (await playlistTracks(me.spaceId, p.uri)) ?? [];
      const at = Number.isInteger(index) && tracks[index!]?.uri === uri ? index! : tracks.findIndex((t) => t.uri === uri);
      if (at >= 0) queue = tracks.slice(at + 1, at + 301).map((t) => t.uri);
    }
  }
  const [cur] = await db.select().from(S.listen).where(eq(S.listen.ownerId, me.spaceId)).limit(1);
  const fresh = !cur?.active;
  const values = {
    active: true,
    playlistName: name,
    playlistUri: listUri,
    trackUri: uri,
    positionMs: 0,
    paused: false,
    djUserId: me.id,
    listeners: [...new Set([...(cur?.active ? cur.listeners : []), me.id])],
    queue,
    seq: (cur?.seq ?? 0) + 1,
    updatedAt: new Date(),
  };
  await db.insert(S.listen).values({ ownerId: me.spaceId, ...values }).onConflictDoUpdate({ target: S.listen.ownerId, set: values });
  const row = await listenOf(me.spaceId);
  if (row) await pushLoad(row);
  if (fresh) {
    await notify(db, {
      ownerId: me.spaceId,
      kind: "love",
      audience: me.role === "owner" ? "viewer" : "owner",
      inbox: false,
      title: `🎧 ${me.name} wants to listen together`,
      body: "Open Danchi and tap Join on Chichi Island.",
      url: "/music",
    }).catch(() => {});
  }
  refresh();
  return { ok: true };
}

export async function joinListen() {
  const me = await getMe();
  const [l] = await db.select().from(S.listen).where(eq(S.listen.ownerId, me.spaceId)).limit(1);
  if (!l?.active) return { ok: false };
  if (!l.listeners.includes(me.id)) {
    await db.update(S.listen).set({ listeners: [...l.listeners, me.id] }).where(eq(S.listen.ownerId, me.spaceId));
    await notify(db, {
      ownerId: me.spaceId,
      kind: "love",
      audience: me.role === "owner" ? "viewer" : "owner",
      inbox: false,
      title: `🎧 ${me.name} joined. You're listening together 💞`,
      url: "/",
    }).catch(() => {});
  }
  if ((await appUsers([me.id])).length && !l.paused) {
    const w = await whatOfDj(l);
    if (w) await playFor(me.id, w);
  }
  refresh();
  return { ok: true };
}

export async function leaveListen() {
  const me = await getMe();
  const [l] = await db.select().from(S.listen).where(eq(S.listen.ownerId, me.spaceId)).limit(1);
  if (!l) return { ok: false };
  const listeners = l.listeners.filter((x) => x !== me.id);
  await db
    .update(S.listen)
    .set({ listeners, active: listeners.length > 0 && l.active, ...(l.djUserId === me.id && listeners[0] ? { djUserId: listeners[0] } : {}) })
    .where(eq(S.listen.ownerId, me.spaceId));
  if ((await appUsers([me.id])).length) await pauseFor(me.id);
  refresh();
  return { ok: true };
}

export async function stopListen() {
  const me = await getMe();
  const l = await listenOf(me.spaceId);
  if (l?.active) await pushPause(l, true);
  await db.update(S.listen).set({ active: false, paused: true, listeners: [] }).where(eq(S.listen.ownerId, me.spaceId));
  refresh();
  return { ok: true };
}

/**
 * Buttons on the Spotify app player: pause or play for both, next song for both,
 * or "sync" (put my phone back on the same song and second as the DJ).
 */
export async function musicControl(kind: "pause" | "resume" | "next" | "sync"): Promise<{ ok: boolean; problem?: Problem | null }> {
  const me = await getMe();
  const l = await listenOf(me.spaceId);
  if (!l?.active || !l.listeners.includes(me.id)) return { ok: false };
  if (kind === "sync") {
    const w = await whatOfDj(l);
    const problem = w ? await playFor(me.id, w) : "error";
    refresh();
    return { ok: !problem, problem };
  }
  if (kind === "pause" || kind === "resume") {
    const paused = kind === "pause";
    let positionMs = l.positionMs;
    if (l.djUserId && (await appUsers([l.djUserId])).length) positionMs = (await nowFor(l.djUserId))?.progress ?? positionMs;
    await db.update(S.listen).set({ paused, positionMs, updatedAt: new Date() }).where(eq(S.listen.ownerId, me.spaceId));
    await pushPause(l, paused);
    refresh();
    return { ok: true };
  }
  // next song for both: Danchi players follow the queue, Spotify apps skip
  if (l.queue.length) {
    const [next, ...rest] = l.queue;
    await db.update(S.listen).set({ trackUri: next, queue: rest, positionMs: 0, paused: false, seq: l.seq + 1, updatedAt: new Date() }).where(eq(S.listen.ownerId, me.spaceId));
  }
  const who = await appUsers(l.listeners);
  await Promise.all(who.map((u) => nextFor(u)));
  refresh();
  return { ok: true };
}

/** Play in my Spotify app (full songs) or in the small Danchi player (previews on phones). */
export async function setSpotifyApp(useApp: boolean) {
  const me = await getMe();
  await db.update(S.spotifyMe).set({ useApp, problem: null }).where(eq(S.spotifyMe.userId, me.id));
  const l = await listenOf(me.spaceId);
  if (l?.active && l.listeners.includes(me.id)) {
    if (useApp) {
      const w = await whatOfDj(l);
      if (w && !l.paused) await playFor(me.id, w);
    } else await pauseFor(me.id);
  }
  refresh();
  return { ok: true };
}

