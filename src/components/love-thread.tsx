"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Emote } from "@/components/emote";
import { CuteIcon } from "@/components/cute-icon";
import { Mascot } from "@/components/mascot";
import { askPap, deleteLove, reactLove, sendMiss } from "@/app/(app)/care-actions";
import { photoForChichi } from "@/lib/ask-client";

export type ThreadNote = {
  id: string;
  mine: boolean;
  from: string;
  text: string;
  emoji: string;
  kind: string;
  reaction: string | null;
  photos: string[];
  reply: { text: string; from: string } | null;
  when: string;
};

const EMOJI = ["💌", "💛", "🌼", "🍑", "🫶", "🧸", "☕", "🌙"];
const REACTS = ["❤️", "🥹", "😂", "🫶"];

/* ---------------- quick love buttons ---------------- */

export function LoveQuick({ partner, compact = false }: { partner: string; compact?: boolean }) {
  if (compact) return <LoveQuickMini partner={partner} />;
  return <LoveQuickBig partner={partner} />;
}

/** Three quiet buttons for Home: miss you, ask for a pap, play. */
function LoveQuickMini({ partner }: { partner: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      await fn();
      setMsg(ok);
      setTimeout(() => setMsg(null), 3000);
    });
  const b = "press flex h-10 items-center justify-center gap-1 rounded-xl border border-[var(--color-line)] bg-cream text-[13px] font-bold disabled:opacity-60";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={pending} onClick={() => run(sendMiss, `${partner} knows you miss them 🥺`)} className={b}>
          <Emote name="please" size={24} /> Miss you
        </button>
        <button type="button" disabled={pending} onClick={() => run(askPap, `Asked ${partner} for a pap 📸`)} className={b}>
          <CuteIcon name="image" size={22} /> Pap?
        </button>
        <Link href="/play" className={b}>
          <CuteIcon name="game" size={22} /> Play
        </Link>
      </div>
      {msg && <p className="pop-in text-[13px] font-bold">{msg}</p>}
    </div>
  );
}

function LoveQuickBig({ partner }: { partner: string }) {
  const compact = false;
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const router = useRouter();
  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      await fn();
      setMsg(ok);
      router.refresh();
      setTimeout(() => setMsg(null), 3500);
    });
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setBurst((b) => b + 1);
            try {
              navigator.vibrate?.([40, 60, 40]);
            } catch {}
            run(sendMiss, `${partner} knows you miss them 🥺💛`);
          }}
          className={`sticker-flat press flex items-center justify-center gap-1.5 rounded-[20px] bg-linear-to-b from-pink to-[#FF8FB3] font-extrabold disabled:opacity-60 ${compact ? "h-12 text-[14px]" : "h-14 text-[16px]"}`}
        >
          🥺 I miss you
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(askPap, `Asked ${partner} for a pap 📸`)}
          className={`sticker-flat press flex items-center justify-center gap-1.5 rounded-[20px] bg-linear-to-b from-sky to-[#7FC2FF] font-extrabold disabled:opacity-60 ${compact ? "h-12 text-[14px]" : "h-14 text-[16px]"}`}
        >
          📸 Ask for a pap
        </button>
      </div>
      {burst > 0 && (
        <span key={burst} aria-hidden className="pointer-events-none absolute left-1/4 top-0 animate-[pop-in_.4s_ease-out] text-3xl">
          💗
        </span>
      )}
      {msg && (
        <p role="status" className="pop-in self-start rounded-xl border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
          {msg}
        </p>
      )}
    </div>
  );
}

/* ---------------- composer ---------------- */

export function LoveComposer({
  partner,
  replyTo,
  onClearReply,
  openPhoto = false,
}: {
  partner: string;
  replyTo?: { id: string; text: string } | null;
  onClearReply?: () => void;
  openPhoto?: boolean;
}) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const p = await photoForChichi(f);
      setPhoto({ blob: p.blob, preview: p.preview });
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function send() {
    if (busy || (!text.trim() && !photo)) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("text", text.trim());
    fd.append("emoji", photo ? "📸" : emoji);
    if (replyTo) fd.append("replyTo", replyTo.id);
    if (photo) fd.append("photo", photo.blob, "pap.jpg");
    try {
      const r = await fetch("/api/love", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Didn't send. Try again?");
      setText("");
      setPhoto(null);
      onClearReply?.();
      setMsg(photo ? `Pap sent to ${partner} 📸` : `Sent to ${partner} 💌`);
      router.refresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      const m = (e as Error).message;
      setMsg(/failed to fetch|network|load failed/i.test(m) ? "No connection right now. Check your internet and tap send again 💛" : m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`sticker-flat flex flex-col gap-2 rounded-[24px] bg-white p-2.5 ${openPhoto ? "ring-4 ring-sky" : ""}`}>
      {replyTo && (
        <div className="flex items-center gap-2 rounded-xl border-l-4 border-pink bg-pink-soft px-2.5 py-1.5 text-[13px] font-bold">
          <span className="min-w-0 flex-1 truncate">↩️ Replying to: {replyTo.text}</span>
          <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="rounded-full p-0.5">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {openPhoto && !photo && <p className="px-1 text-[13px] font-extrabold">📸 {partner} wants a pap! Tap the camera.</p>}
      {photo && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="Pap to send" className="size-16 rounded-xl border-2 border-ink object-cover" />
          <span className="flex-1 text-[13px] font-extrabold text-ink-soft">Pap ready. Add a caption if you like.</span>
          <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="rounded-full border-2 border-ink bg-pink-soft p-1">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {!photo && (
        <div className="flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Sticker">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink text-lg ${emoji === e ? "bg-sun" : "bg-white"}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        <button
          type="button"
          onClick={() => file.current?.click()}
          aria-label="Send a pap (photo)"
          className={`press flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-ink ${openPhoto ? "animate-pulse bg-sky" : "bg-sky-soft"}`}
        >
          <Icon name="camera" size={20} stroke={2.4} />
        </button>
        <label htmlFor="love-text" className="sr-only-safe">
          Message to {partner}
        </label>
        <textarea
          id="love-text"
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={1}
          placeholder={photo ? "Caption (optional)" : `Write to ${partner}`}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] font-bold outline-none placeholder:text-[#6e6082]"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || (!text.trim() && !photo)}
          aria-label="Send"
          className="sticker-sm press flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pink disabled:opacity-50"
        >
          <Icon name="send" size={20} stroke={2.6} />
        </button>
      </div>
      {msg && <p className="px-1 text-[13px] font-extrabold">{msg}</p>}
    </div>
  );
}

/* ---------------- thread ---------------- */

function Reacts({ id, current }: { id: string; current: string | null }) {
  const [r, setR] = useState(current);
  const [, start] = useTransition();
  return (
    <span className="flex gap-1">
      {REACTS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`React ${e}`}
          aria-pressed={r === e}
          onClick={() => {
            setR(e);
            start(() => reactLove(id, e));
          }}
          className={`flex size-8 items-center justify-center rounded-lg border-2 border-ink text-sm ${r === e ? "bg-sun" : "bg-white"}`}
        >
          {e}
        </button>
      ))}
    </span>
  );
}

export function LoveThread({ notes, partner, openPhoto = false }: { notes: ThreadNote[]; partner: string; openPhoto?: boolean }) {
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const [, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [notes.length]);

  return (
    <div className="flex flex-col gap-3">
      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[26px] border-[2.5px] border-ink bg-pink-soft p-5 text-center">
          <Mascot mood="love" size={110} />
          <p className="font-display text-xl font-bold">Your little love corner</p>
          <p className="max-w-xs text-sm font-bold text-ink-soft">Write a note, send a pap, or tap &quot;I miss you&quot;. It pops up on {partner}&apos;s phone 💌</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5" aria-live="polite">
          {notes.map((n) => {
            if (n.kind === "miss" || n.kind === "papask") {
              return (
                <div key={n.id} className="flex flex-col items-center gap-1 self-center">
                  <span className={`rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${n.kind === "miss" ? "bg-pink-soft" : "bg-sky-soft"}`}>
                    {n.kind === "miss" ? `🥺 ${n.mine ? "You" : n.from} ${n.mine ? "missed" : "misses"} ${n.mine ? partner : "you"}` : `📸 ${n.mine ? "You asked" : `${n.from} asked`} for a pap`}
                    <span className="ml-1.5 font-bold text-ink-soft">{n.when}</span>
                  </span>
                  {!n.mine && n.kind === "papask" && <span className="text-xs font-bold text-ink-soft">Tap the 📷 below to send one</span>}
                </div>
              );
            }
            return (
              <div key={n.id} className={`flex max-w-[88%] flex-col gap-1 ${n.mine ? "items-end self-end" : "items-start self-start"}`}>
                <div className={`flex flex-col gap-1.5 rounded-[22px] border-[2.5px] border-ink px-3.5 py-2.5 ${n.mine ? "rounded-br-md bg-sun-soft" : "rounded-bl-md bg-pink-soft"}`}>
                  {n.reply && (
                    <span className="rounded-lg border-l-4 border-ink/40 bg-white/70 px-2 py-1 text-[12px] font-bold text-ink-soft">
                      ↩️ {n.reply.from ? `${n.reply.from}: ` : ""}
                      {n.reply.text}
                    </span>
                  )}
                  {n.photos.map((p) => (
                    <a key={p} href={`/api/love/photo/${p}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/love/photo/${p}`} alt={`Pap from ${n.mine ? "you" : n.from}`} loading="lazy" className="max-h-72 w-full max-w-[260px] rounded-2xl border-2 border-ink object-cover" />
                    </a>
                  ))}
                  {!(n.kind === "pap" && n.text === "📸") && (
                    <p className="whitespace-pre-wrap text-[15px] font-bold leading-snug">
                      {n.kind !== "pap" && <span className="mr-1">{n.emoji}</span>}
                      {n.text}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-[11px] font-extrabold text-ink-soft">
                    {n.mine ? "You" : n.from}, {n.when}
                  </span>
                  {n.mine ? (
                    <>
                      {n.reaction && <span className="rounded-full border-2 border-ink bg-white px-1.5 text-sm">{n.reaction}</span>}
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => {
                          if (confirm("Delete this?")) start(async () => (await deleteLove(n.id), router.refresh()));
                        }}
                        className="rounded-full p-0.5 text-ink-soft"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Reacts id={n.id} current={n.reaction} />
                      <button
                        type="button"
                        onClick={() => setReply({ id: n.id, text: n.kind === "pap" ? "📸 a pap" : n.text.slice(0, 60) })}
                        className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[12px] font-extrabold"
                      >
                        ↩️ Reply
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div ref={end} />
      <div className="sticky bottom-[104px] z-20 md:bottom-4">
        <LoveComposer partner={partner} replyTo={reply} onClearReply={() => setReply(null)} openPhoto={openPhoto} />
      </div>
    </div>
  );
}
