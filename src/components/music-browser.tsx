"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlaylist, joinListen, playTrack, removePlaylist, setSpotifyApp, startListen, stopListen } from "@/app/(app)/music-actions";
import { Emote } from "@/components/emote";
import { Icon } from "@/components/icon";

type Track = { uri: string; name: string; artists: string; image: string | null; ms: number };
type Hit = Track & { playlistId?: string; playlist?: string; index?: number };

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

function Row({ t, playing, onPlay, sub }: { t: Hit; playing: boolean; onPlay: () => void; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`press flex w-full items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition ${playing ? "bg-[#1ED760]/15" : "hover:bg-cream"}`}
      aria-label={`Play ${t.name} for both`}
    >
      {t.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.image} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg border border-[var(--color-line)] object-cover" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-lilac-soft">
          <Icon name="music" size={18} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={`truncate text-[14.5px] font-bold ${playing ? "text-[#139a46]" : ""}`}>{t.name}</span>
        <span className="truncate text-[12.5px] font-semibold text-ink-soft">
          {t.artists}
          {sub ? `, ${sub}` : ""}
        </span>
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-ink-soft">{t.ms ? mmss(t.ms) : ""}</span>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${playing ? "bg-[#1ED760]" : "bg-cream"}`}>{playing ? <Bars /> : "▶"}</span>
    </button>
  );
}

function Bars() {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-[3px] rounded-full bg-ink" style={{ height: "100%", animation: `eq-bounce .9s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}

export function MusicBrowser({
  meId,
  playlists,
  connected,
  keysReady,
  flash,
  session,
  mine = null,
  partner = null,
}: {
  meId: string;
  playlists: { id: string; name: string; uri: string }[];
  connected: { name: string; by: string } | null;
  keysReady: boolean;
  flash: string | null;
  session: { dj: string; djId: string | null; playlist: string | null; joined: boolean; track: string | null; upNext: number } | null;
  mine?: { name: string | null; app: boolean; problem?: string | null } | null;
  partner?: { name: string; linked: boolean } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState(playlists[0]?.id ?? "");
  const [tracks, setTracks] = useState<Record<string, Track[] | "error">>({});
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ ours: Hit[]; spotify: Hit[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(playlists.length === 0);
  const [err, setErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);

  // load the songs of the open playlist
  useEffect(() => {
    if (!connected || !tab || tracks[tab]) return;
    let gone = false;
    fetch(`/api/music/tracks?playlist=${tab}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { tracks: Track[] }) => !gone && setTracks((x) => ({ ...x, [tab]: d.tracks })))
      .catch(() => !gone && setTracks((x) => ({ ...x, [tab]: "error" })));
    return () => {
      gone = true;
    };
  }, [tab, connected, tracks]);

  // search, a moment after typing stops
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!connected || q.trim().length < 2) {
      setRes(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/music/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setRes(d))
        .catch(() => setRes({ ours: [], spotify: [] }))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q, connected]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const play = (t: Hit, playlistId?: string, index?: number) =>
    start(async () => {
      await playTrack(t.uri, playlistId ?? null, index ?? null);
      router.refresh();
    });

  const list = tracks[tab];
  const shown = useMemo(() => {
    if (!Array.isArray(list)) return [];
    const f = filter.trim().toLowerCase();
    return list.map((t, i) => ({ t, i })).filter(({ t }) => !f || `${t.name} ${t.artists}`.toLowerCase().includes(f));
  }, [list, filter]);

  return (
    <div className="flex flex-col gap-4">
      {flash === "connected" && <p className="rounded-2xl bg-mint-soft p-3 text-[14px] font-bold">Spotify connected! Your songs and search are ready.</p>}
      {flash === "failed" && <p className="rounded-2xl bg-pink-soft p-3 text-[14px] font-bold">Spotify didn&apos;t connect. Check the Redirect URI in the Spotify dashboard and try again.</p>}
      {flash === "denied" && <p className="rounded-2xl bg-pink-soft p-3 text-[14px] font-bold">You said no on Spotify, so nothing was connected.</p>}

      {/* now playing / join */}
      <section className="sticker flex items-center gap-3 rounded-[26px] bg-linear-to-r from-[#d6f7e2] to-white p-3.5">
        <Emote name={session ? "love" : "happy"} size={46} animate />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="font-display text-[17px] font-semibold">{session ? (session.joined ? "Listening together" : `${session.dj} is playing music`) : "Nothing playing yet"}</span>
          <span className="truncate text-[13px] font-semibold text-ink-soft">
            {session ? `${session.playlist ?? "Picked songs"}${session.upNext ? `, ${session.upNext} songs up next` : ""}` : "Pick a playlist or a song. It only plays on the other phone after they tap Join."}
          </span>
        </div>
        {session && !session.joined && (
          <button type="button" disabled={pending} onClick={() => start(async () => (await joinListen(), router.refresh()))} className="animate-pulse rounded-full border-2 border-ink bg-[#1ED760] px-4 py-2 text-[14px] font-extrabold shadow-[0_3px_0_#2E2240]">
            Join
          </button>
        )}
        {session?.joined && (
          <button type="button" disabled={pending} onClick={() => confirm("Stop the music for both of you?") && start(async () => (await stopListen(), router.refresh()))} className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[13px] font-extrabold">
            Stop
          </button>
        )}
      </section>

      {/* playlists */}
      <section className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-3.5">
        <div className="flex items-center gap-2">
          <h2 className="font-display flex-1 text-lg font-semibold">Our playlists</h2>
          <button type="button" onClick={() => setAdding((a) => !a)} className="rounded-full bg-cream px-3 py-1 text-[13px] font-bold">
            {adding ? "Close" : "+ Add"}
          </button>
        </div>
        {adding && (
          <form
            action={async (fd) => {
              setErr(null);
              const r = await addPlaylist({ ok: false }, fd);
              if (!r.ok) setErr(r.error ?? "Couldn't add it");
              else {
                setAdding(false);
                router.refresh();
              }
            }}
            className="flex flex-col gap-2 rounded-2xl bg-cream p-3"
          >
            <p className="text-[13px] font-semibold">In Spotify open the playlist, tap the three dots, Share, Copy link to playlist. Paste it here.</p>
            <input name="name" maxLength={60} placeholder="Name, like RA or itoshii hito" className="field" />
            <input name="url" required placeholder="https://open.spotify.com/playlist/" className="field" />
            {err && <p className="text-[13px] font-bold text-coral">{err}</p>}
            <button type="submit" className="self-start rounded-full border-2 border-ink bg-[#1ED760] px-4 py-1.5 text-[14px] font-extrabold">
              Add playlist
            </button>
          </form>
        )}
        <div className="grid grid-cols-2 gap-2">
          {playlists.map((p) => (
            <div key={p.id} className={`flex flex-col gap-2 rounded-2xl border-2 p-3 ${tab === p.id ? "border-ink bg-sun-soft" : "border-[var(--color-line)] bg-white"}`}>
              <button type="button" onClick={() => setTab(p.id)} className="text-left">
                <span className="font-display block truncate text-[16px] font-semibold">{p.name}</span>
                <span className="text-[12px] font-semibold text-ink-soft">{Array.isArray(tracks[p.id]) ? `${(tracks[p.id] as Track[]).length} songs` : "Spotify playlist"}</span>
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => (await startListen(p.id), router.refresh()))}
                  className="press flex-1 rounded-full border-2 border-ink bg-[#1ED760] py-1.5 text-[13px] font-extrabold shadow-[0_2px_0_#2E2240]"
                >
                  ▶ Play for us
                </button>
                <button type="button" aria-label={`Remove ${p.name}`} onClick={() => confirm(`Remove ${p.name} from Danchi? (It stays on Spotify.)`) && start(async () => (await removePlaylist(p.id), router.refresh()))} className="rounded-full p-1.5 text-ink-soft hover:bg-cream">
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* full songs on phones: each person's own Spotify app */}
      {keysReady && connected && (
        <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#1ED760]">
              <Icon name="music" size={18} stroke={2.4} />
            </span>
            <h2 className="font-display flex-1 text-lg font-semibold">Full songs on your phone</h2>
          </div>
          {mine ? (
            <>
              <p className="text-[13.5px] font-semibold">
                Your Spotify: <b>{mine.name ?? "connected"}</b>. Songs you listen to together play in:
              </p>
              <div className="flex gap-1.5">
                {[
                  { v: true, label: "My Spotify app (full songs)" },
                  { v: false, label: "Danchi player (previews)" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => (await setSpotifyApp(o.v), router.refresh()))}
                    className={`flex-1 rounded-2xl border-2 px-2 py-2 text-[12.5px] font-extrabold ${mine.app === o.v ? "border-ink bg-[#d6f7e2]" : "border-[var(--color-line)] bg-white text-ink-soft"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {!mine.app && mine.problem === "premium" && (
                <p className="rounded-2xl bg-pink-soft p-2.5 text-[12.5px] font-bold">Spotify said this account isn&apos;t Premium, so your songs play in the Danchi player (previews on phones).</p>
              )}
              {mine.app && <p className="text-[12px] font-semibold text-ink-soft">Keep the Spotify app open on your phone once in a while so Danchi can find it. Needs Spotify Premium.</p>}
            </>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold">
                Phones only get 30 second previews in the Danchi player. Connect <b>your own</b> Spotify (Premium) and songs play full in your Spotify app, even with the screen off.
              </p>
              <a href="/api/spotify/login" className="press self-start rounded-full border-2 border-ink bg-[#1ED760] px-4 py-2 text-[14px] font-extrabold shadow-[0_3px_0_#2E2240]">
                Connect my Spotify
              </a>
              <p className="text-[12px] font-semibold text-ink-soft">Stuck on the phone? Do it once from a laptop browser, it works for your phone too.</p>
            </>
          )}
          {partner?.name && (
            <p className="text-[12.5px] font-semibold text-ink-soft">
              {partner.name}: {partner.linked ? "connected" : "not connected yet (needs Spotify Premium for full songs)"}
            </p>
          )}
        </section>
      )}

      {/* search + songs: need the Spotify connection */}
      {!connected ? (
        <section className="sticker flex flex-col gap-2 rounded-[26px] bg-lilac-soft p-4">
          <p className="font-display text-lg font-semibold">Want the song list and search?</p>
          <p className="text-[14px] font-semibold">
            Connect Spotify once and Danchi shows every song in your playlists, lets you search any song, and plays the next one automatically. Without it you can still play a playlist and pick songs inside the player below.
          </p>
          {keysReady ? (
            <a href="/api/spotify/login" className="press self-start rounded-full border-2 border-ink bg-[#1ED760] px-4 py-2 text-[14px] font-extrabold shadow-[0_3px_0_#2E2240]">
              Connect Spotify
            </a>
          ) : (
            <p className="rounded-2xl bg-white p-3 text-[13px] font-semibold">Rafi needs to add the Spotify app keys first (bash deploy/keys.sh on the mini PC, Spotify part).</p>
          )}
        </section>
      ) : (
        <>
          <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--color-line-strong)] bg-cream px-3">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a song or artist" className="h-11 flex-1 bg-transparent text-[15px] font-semibold outline-none" aria-label="Search songs" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear">
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>
            {searching && <p className="px-1 text-[13px] font-semibold text-ink-soft">Searching</p>}
            {res && (
              <div className="flex flex-col gap-1">
                {res.ours.length > 0 && <p className="px-1 pt-1 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">In our playlists</p>}
                {res.ours.map((t) => (
                  <Row key={`${t.playlistId}${t.index}`} t={t} sub={t.playlist} playing={session?.track === t.uri} onPlay={() => play(t, t.playlistId, t.index)} />
                ))}
                {res.spotify.length > 0 && <p className="px-1 pt-2 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">On Spotify</p>}
                {res.spotify.map((t) => (
                  <Row key={t.uri} t={t} playing={session?.track === t.uri} onPlay={() => play(t)} />
                ))}
                {!res.ours.length && !res.spotify.length && !searching && <p className="px-1 text-[13px] font-semibold text-ink-soft">No songs found</p>}
              </div>
            )}
          </section>

          {!res && tab && (
            <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
              <div className="flex items-center gap-2">
                <h2 className="font-display flex-1 truncate text-lg font-semibold">{playlists.find((p) => p.id === tab)?.name}</h2>
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" className="h-9 w-32 rounded-full border border-[var(--color-line)] bg-cream px-3 text-[13px] font-semibold outline-none" aria-label="Filter songs" />
              </div>
              {list === undefined && <p className="text-[13px] font-semibold text-ink-soft">Loading songs</p>}
              {list === "error" && <p className="text-[13px] font-semibold text-coral">Couldn&apos;t load this playlist. It must be yours or shared with the connected Spotify account.</p>}
              {shown.slice(0, limit).map(({ t, i }) => (
                <Row key={`${t.uri}${i}`} t={t} playing={session?.track === t.uri} onPlay={() => play(t, tab, i)} />
              ))}
              {shown.length > limit && (
                <button type="button" onClick={() => setLimit((l) => l + 100)} className="self-center rounded-full bg-cream px-4 py-1.5 text-[13px] font-bold">
                  Show more ({shown.length - limit})
                </button>
              )}
            </section>
          )}
          <p className="px-1 text-[12px] font-semibold text-ink-soft">
            Song lists from {connected.name}
            {connected.by ? ` (${connected.by})` : ""}.{" "}
            {mine && (
              <button type="button" className="underline" onClick={() => confirm("Disconnect your Spotify from Danchi?") && fetch("/api/spotify/disconnect", { method: "POST" }).then(() => router.refresh())}>
                Disconnect my Spotify
              </button>
            )}
          </p>
        </>
      )}
      <span className="sr-only">{meId}</span>
    </div>
  );
}
