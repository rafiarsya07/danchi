import type { Metadata } from "next";
import { eq, asc } from "drizzle-orm";
import { MusicBrowser } from "@/components/music-browser";
import { PageTitle } from "@/components/ui";
import { db, schema } from "@/db";
import { getMe } from "@/lib/session";
import { spotifyReady } from "@/server/spotify";

export const metadata: Metadata = { title: "Our music" };

export default async function MusicPage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const me = await getMe();
  const [lists, auth, listen, users, people] = await Promise.all([
    db.select({ id: schema.playlist.id, name: schema.playlist.name, uri: schema.playlist.uri }).from(schema.playlist).where(eq(schema.playlist.ownerId, me.spaceId)).orderBy(asc(schema.playlist.createdAt)),
    db.select({ name: schema.spotifyAuth.displayName, by: schema.spotifyAuth.connectedBy }).from(schema.spotifyAuth).where(eq(schema.spotifyAuth.ownerId, me.spaceId)).limit(1),
    db.select().from(schema.listen).where(eq(schema.listen.ownerId, me.spaceId)).limit(1),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user),
    db.select({ userId: schema.spotifyMe.userId, name: schema.spotifyMe.displayName, app: schema.spotifyMe.useApp, problem: schema.spotifyMe.problem }).from(schema.spotifyMe).where(eq(schema.spotifyMe.spaceId, me.spaceId)),
  ]);
  const mine = people.find((p) => p.userId === me.id) ?? null;
  const partner = people.find((p) => p.userId !== me.id) ?? null;
  const shared = auth[0] ? { name: auth[0].name ?? "Spotify", by: users.find((u) => u.id === auth[0].by)?.name ?? "" } : partner || mine ? { name: (partner ?? mine)!.name ?? "Spotify", by: users.find((u) => u.id === (partner ?? mine)!.userId)?.name ?? "" } : null;
  const l = listen[0];
  const flash = (await searchParams).spotify ?? null;
  return (
    <div className={`mx-auto flex max-w-2xl flex-col gap-4 ${shared ? "pb-40" : "pb-[440px] md:pb-[420px]"}`}>
      <PageTitle title="Our music" icon="music" help={false} subtitle="Your playlists, same song on both phones" />
      <MusicBrowser
        meId={me.id}
        playlists={lists}
        connected={shared}
        mine={mine ? { name: mine.name, app: mine.app, problem: mine.problem } : null}
        partner={{ name: users.find((u) => u.id !== me.id && (u.id === me.spaceId || me.role === "owner"))?.name ?? "", linked: !!partner }}
        keysReady={spotifyReady()}
        flash={flash}
        session={
          l?.active
            ? { dj: users.find((u) => u.id === l.djUserId)?.name ?? "", djId: l.djUserId, playlist: l.playlistName, joined: l.listeners.includes(me.id), track: l.trackUri, upNext: l.queue.length }
            : null
        }
      />
    </div>
  );
}
