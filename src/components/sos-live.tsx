"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";

type Live = {
  name: string;
  status: "active" | "ended";
  startedAt: string;
  endedAt: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  battery: number | null;
  lastAt: string | null;
  points: { lat: number; lng: number; accuracy: number | null; at: string }[];
  photos: { id: string; name: string; at: string }[];
  calls: { kind: string; ok: boolean }[];
};

const t = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
function ago(iso: string | null, now: number) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

/** Rafi's view of an SOS: live map, her trail, the photos. Refreshes every 5 seconds. */
export function SosLive({ token, name }: { token: string; name: string }) {
  const [d, setD] = useState<Live | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/sos/live/${token}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) setErr(j.error ?? "Link expired");
        else {
          setD(j);
          setErr(null);
        }
      } catch {
        if (alive) setErr("Can't reach Danchi, retrying");
      }
    };
    load();
    const a = setInterval(load, 5000);
    const b = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(a);
      clearInterval(b);
    };
  }, [token]);

  const active = d?.status === "active";
  const has = d?.lat != null && d?.lng != null;
  const bbox = has ? `${d!.lng! - 0.006},${d!.lat! - 0.004},${d!.lng! + 0.006},${d!.lat! + 0.004}` : "";
  const gmaps = has ? `https://www.google.com/maps/search/?api=1&query=${d!.lat},${d!.lng}` : null;
  const directions = has ? `https://www.google.com/maps/dir/?api=1&destination=${d!.lat},${d!.lng}` : null;

  return (
    <main className={`min-h-dvh p-4 pb-10 ${active ? "bg-linear-to-b from-[#FFE1E1] to-cream" : "bg-mint-soft"}`}>
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <header className={`sticker-flat flex items-center gap-3 rounded-[26px] p-4 ${active ? "bg-linear-to-b from-[#FF6B6B] to-[#C9213A] text-white" : "bg-mint"}`}>
          {active ? <span className="size-4 shrink-0 animate-ping rounded-full bg-white" /> : <Mascot mood="cheer" size={56} animate={false} />}
          <div className="flex min-w-0 flex-col">
            <h1 className="font-display text-[26px] font-bold leading-tight">{active ? `SOS from ${name}` : `${name} is safe now 💛`}</h1>
            <p className="text-sm font-extrabold">
              {d ? (active ? `Pressed at ${t(d.startedAt)}` : `SOS ${t(d.startedAt)} to ${t(d.endedAt)}`) : "Loading"}
              {d?.battery != null ? `, battery ${d.battery}%` : ""}
            </p>
          </div>
        </header>
        {err && <p className="rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-sm font-extrabold">{err}</p>}

        {d && (
          <>
            <section className="sticker overflow-hidden rounded-[26px] bg-white">
              {has ? (
                <iframe
                  title="Her location"
                  className="h-72 w-full border-0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${d.lat},${d.lng}`}
                />
              ) : (
                <p className="p-4 text-[15px] font-extrabold">📍 Waiting for her phone to send a location</p>
              )}
              <div className="flex flex-col gap-2 p-3">
                {has && (
                  <p className="text-sm font-extrabold">
                    Last location {ago(d.lastAt, now)}
                    {d.accuracy != null ? `, accurate to ~${Math.round(d.accuracy)} m` : ""}
                    {active && d.lastAt && now - new Date(d.lastAt).getTime() > 90_000 && (
                      <span className="block text-coral">Her phone hasn&apos;t updated for a while (screen off or no signal). Call her.</span>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {gmaps && (
                    <a href={gmaps} target="_blank" rel="noreferrer" className="press flex h-12 items-center justify-center rounded-2xl border-[3px] border-ink bg-sky-soft text-[15px] font-extrabold">
                      🗺️ Google Maps
                    </a>
                  )}
                  {directions && (
                    <a href={directions} target="_blank" rel="noreferrer" className="press flex h-12 items-center justify-center rounded-2xl border-[3px] border-ink bg-sun text-[15px] font-extrabold">
                      🚗 Go to her
                    </a>
                  )}
                  <a href="tel:999" className="press col-span-2 flex h-12 items-center justify-center rounded-2xl border-[3px] border-ink bg-coral text-[15px] font-extrabold text-white">
                    🚓 Call 999 (Malaysia police / ambulance)
                  </a>
                </div>
              </div>
            </section>

            <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-3">
              <h2 className="font-display text-lg font-bold">📸 Photos ({d.photos.length})</h2>
              {d.photos.length === 0 ? (
                <p className="text-sm font-bold text-ink-soft">No photos yet. They arrive a few seconds after she presses SOS.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {d.photos.map((p) => (
                    <a key={p.id} href={`/api/sos/live/${token}/photo/${p.id}`} target="_blank" rel="noreferrer" className="flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/sos/live/${token}/photo/${p.id}`} alt={p.name} className="aspect-[3/4] w-full rounded-2xl border-2 border-ink object-cover" />
                      <span className="text-xs font-extrabold text-ink-soft">
                        {p.name.includes("back") ? "Back camera" : "Front camera"}, {t(p.at)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>

            {d.points.length > 1 && (
              <section className="sticker flex flex-col gap-1 rounded-[26px] bg-white p-3">
                <h2 className="font-display text-lg font-bold">🧭 Where she has been</h2>
                <ul className="flex flex-col gap-1 text-sm font-bold">
                  {d.points.slice(0, 12).map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-ink/10 py-1">
                      <span>{t(p.at)}</span>
                      <a className="underline" href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
                        {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {d.calls.length > 0 && (
              <p className="text-center text-xs font-bold text-ink-soft">
                Calls placed: {d.calls.filter((c) => c.kind === "call" && c.ok).length}, texts sent: {d.calls.filter((c) => c.kind === "sms" && c.ok).length}
              </p>
            )}
            <p className="text-center text-xs font-bold text-ink-soft">This private link stops working 48 hours after the SOS ends. Updates every 5 seconds.</p>
          </>
        )}
      </div>
    </main>
  );
}
