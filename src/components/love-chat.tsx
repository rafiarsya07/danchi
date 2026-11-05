"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { MascotBadge } from "@/components/mascot";
import { BuiltinStickerArt, StickerView } from "@/components/sticker";
import { askPap, deleteLove, deleteSticker, markLoveSeen, reactLove, sendMiss, setTogetherSince } from "@/app/(app)/care-actions";
import { photoForChichi } from "@/lib/ask-client";
import { STICKERS } from "@/lib/stickers";
import { CHAT_BGS, chatBgStyle } from "@/lib/chat-bg";
import { Emote, EMOTE_NAMES, EMOTES, ReactionMark } from "@/components/emote";
import { CuteIcon } from "@/components/cute-icon";

export type ChatMsg = {
  id: string;
  mine: boolean;
  kind: string; // note | pap | sticker | miss | papask
  text: string;
  emoji: string;
  reaction: string | null;
  photos: string[];
  reply: { text: string; from: string } | null;
  at: string; // ISO
  seen: boolean;
};
export type MyStickerT = { id: string; label: string | null; mine: boolean };

const REACTS = ["❤️", "🥹", "😂", "🫶", "😍", "😢"];
const EMOJI = "😊 🥰 😘 😍 🥺 😭 😂 🤭 😴 🤗 😳 😤 🙄 😋 🤤 😎 🥳 😇 🙈 💕 💗 💖 💘 💞 💌 🌸 🌼 🌷 🍑 🍓 🧋 🍜 🍰 ☕ 🌙 ⭐ ✨ 🎉 🎀 🧸 🐱 🐶 🐰 🦋 🌈 ☀️ 🌧️ 👍 👏 🙏 💪 🤞 👀 💤 🏠 🚶‍♀️ 📚 💻".split(" ");

/* ---------------- time helpers (always her timezone) ---------------- */

function fmt(tz: string) {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const day = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz });
  const long = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
  return {
    time: (iso: string) => time.format(new Date(iso)),
    day: (iso: string | Date) => day.format(new Date(iso)),
    label: (iso: string) => {
      const d = day.format(new Date(iso));
      const today = day.format(new Date());
      const yest = day.format(new Date(Date.now() - 86_400_000));
      return d === today ? "Today" : d === yest ? "Yesterday" : long.format(new Date(iso));
    },
  };
}

function Ticks({ seen }: { seen: boolean }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" aria-label={seen ? "Seen" : "Sent"} className="shrink-0">
      <path d="M1 6l3 3 6-7" fill="none" stroke={seen ? "#4AA8E8" : "#9a90aa"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {seen && <path d="M6 9l1 0 7-7" fill="none" stroke="#4AA8E8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/* ---------------- one message ---------------- */

function Bubble({
  m,
  first,
  partner,
  tz,
  onOpen,
  onReply,
}: {
  m: ChatMsg;
  first: boolean;
  partner: string;
  tz: ReturnType<typeof fmt>;
  onOpen: (m: ChatMsg) => void;
  onReply: (m: ChatMsg) => void;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const isSticker = m.kind === "sticker";
  const isPhotoOnly = m.kind === "pap" && m.text === "📸";

  return (
    <div
      className={`flex w-full touch-pan-y ${m.mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const x = e.clientX - start.current.x;
        const y = Math.abs(e.clientY - start.current.y);
        if (y > 24) return (start.current = null), setDx(0);
        setDx(Math.max(0, Math.min(70, x)));
      }}
      onPointerUp={() => {
        if (dx > 50) onReply(m);
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => ((start.current = null), setDx(0))}
    >
      {dx > 10 && (
        <span className="mr-1 flex items-center text-ink-soft" style={{ opacity: dx / 60 }} aria-hidden>
          ↩️
        </span>
      )}
      <button
        type="button"
        onClick={() => onOpen(m)}
        onContextMenu={(e) => (e.preventDefault(), onOpen(m))}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={`relative max-w-[80%] text-left transition-transform ${m.reaction ? "mb-3" : ""}`}
        aria-label={`${m.mine ? "Your" : `${partner}'s`} message, tap for options`}
      >
        {isSticker ? (
          <span className="flex flex-col items-end gap-0.5">
            <StickerView code={m.text} size={132} />
            <span className="flex items-center gap-1 rounded-full bg-white/90 px-1.5 text-[11px] font-semibold text-ink-soft">
              {tz.time(m.at)}
              {m.mine && <Ticks seen={m.seen} />}
            </span>
          </span>
        ) : (
          <span
            className={`block rounded-[18px] px-2.5 pb-1.5 pt-1.5 shadow-[0_1px_1px_rgb(46_34_64/0.08)] ${
              m.mine ? `bg-bubble ${first ? "rounded-tr-[5px]" : ""}` : `bg-white ${first ? "rounded-tl-[5px]" : ""}`
            } ${m.photos.length ? "p-1" : ""}`}
          >
            {m.reply && (
              <span className={`mb-1 block rounded-xl border-l-[3px] px-2 py-1 text-[12.5px] ${m.mine ? "border-[#FF9A6C] bg-white/60" : "border-[#B39CFF] bg-quote"}`}>
                <span className="block font-bold text-grape">{m.reply.from}</span>
                <span className="line-clamp-2 text-ink-soft">{m.reply.text}</span>
              </span>
            )}
            {m.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={`/api/love/photo/${p}`} alt="Pap" loading="lazy" className="block max-h-80 w-[240px] max-w-full rounded-[14px] object-cover" />
            ))}
            <span className={`flex flex-wrap items-end justify-end gap-x-2 ${m.photos.length ? "px-1.5 pt-1" : ""}`}>
              {!isPhotoOnly && (
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[15px] font-medium leading-snug">
                  {m.kind === "note" && m.emoji !== "💌" && <span className="mr-1">{m.emoji}</span>}
                  {m.text}
                </span>
              )}
              <span className="ml-auto flex translate-y-0.5 items-center gap-1 text-[11px] font-semibold text-ink-soft/80">
                {tz.time(m.at)}
                {m.mine && <Ticks seen={m.seen} />}
              </span>
            </span>
          </span>
        )}
        {m.reaction && (
          <span className={`emote-bounce absolute -bottom-3.5 rounded-full border border-[var(--color-line)] bg-white p-0.5 shadow-sm ${m.mine ? "left-2" : "right-2"}`}>
            <ReactionMark r={m.reaction} size={20} />
          </span>
        )}
      </button>
    </div>
  );
}

/* ---------------- the chat ---------------- */

export function LoveChat({
  messages,
  partner,
  stickers,
  tz: tzName,
  papAsked = false,
  bg,
  together = null,
}: {
  messages: ChatMsg[];
  partner: string;
  stickers: MyStickerT[];
  tz: string;
  papAsked?: boolean;
  bg?: string;
  together?: { since: string; days: number } | null;
}) {
  const tz = useMemo(() => fmt(tzName), [tzName]);
  const [wall, setWall] = useState(bg ?? "p:cream");
  const [custom, setCustom] = useState(false);
  const look = chatBgStyle(wall);
  const router = useRouter();
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [sheet, setSheet] = useState<ChatMsg | null>(null);
  const [panel, setPanel] = useState<null | "cute" | "stickers" | "mine" | "emoji">(null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [maker, setMaker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  // scroll to the newest message
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [messages.length, pending.length]);

  // once the server has the message, drop the "sending" copy
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending([]);
  }, [messages.length]);

  // mark their messages as seen while the chat is open
  const unseen = messages.some((m) => !m.mine && !m.seen);
  useEffect(() => {
    if (!unseen) return;
    const go = () => document.visibilityState === "visible" && start(() => void markLoveSeen());
    go();
    document.addEventListener("visibilitychange", go);
    return () => document.removeEventListener("visibilitychange", go);
  }, [unseen]);

  // auto size the text box
  useEffect(() => {
    const t = box.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 140) + "px";
  }, [text]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  }

  async function post(fd: FormData, preview: string) {
    const tmp = `p${Date.now()}`;
    setPending((p) => [...p, { id: tmp, text: preview }]);
    setError(null);
    try {
      const r = await fetch("/api/love", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Didn't send. Try again?");
      router.refresh();
    } catch (e) {
      setPending((p) => p.filter((x) => x.id !== tmp));
      const m = (e as Error).message;
      setError(/failed to fetch|network|load failed/i.test(m) ? "No connection. Check your internet and try again." : m);
    }
  }

  function sendText() {
    const t = text.trim();
    if (!t && !photo) return;
    const fd = new FormData();
    fd.append("text", t);
    if (reply) fd.append("replyTo", reply.id);
    if (photo) fd.append("photo", photo.blob, "pap.jpg");
    setText("");
    setReply(null);
    setPhoto(null);
    setPanel(null);
    post(fd, photo ? "📸 Sending your pap" : t);
  }

  function sendSticker(code: string) {
    const fd = new FormData();
    fd.append("sticker", code);
    if (reply) fd.append("replyTo", reply.id);
    setReply(null);
    setPanel(null);
    post(fd, "✨ Sticker");
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const p = await photoForChichi(f);
      setPhoto({ blob: p.blob, preview: p.preview });
      setPanel(null);
      box.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const replyLabel = (m: ChatMsg) =>
    m.kind === "sticker" ? (m.text.startsWith("e:") ? `${EMOTES[m.text.slice(2) as keyof typeof EMOTES]?.label ?? "Sticker"} face` : "Sticker") : m.kind === "pap" ? `📸 ${m.text === "📸" ? "Photo" : m.text}` : m.text.slice(0, 80);

  // group by day, and consecutive messages from the same person
  const rows = useMemo(
    () =>
      messages.map((m, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const showDay = !prev || tz.day(prev.at) !== tz.day(m.at);
        const isFirst =
          showDay || !prev || prev.mine !== m.mine || prev.kind === "miss" || prev.kind === "papask" || new Date(m.at).getTime() - new Date(prev.at).getTime() > 5 * 60_000;
        return { m, showDay, isFirst };
      }),
    [messages, tz],
  );

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-68px)] flex-col md:mx-0 md:min-h-[calc(100dvh-180px)]">
      {/* header */}
      <div className="relative z-[2] flex items-center gap-1.5 border-b border-[var(--color-line)] bg-white/90 px-2.5 py-2 backdrop-blur md:rounded-t-3xl">
        <Link href="/" aria-label="Back" className="flex size-9 items-center justify-center rounded-full hover:bg-cream md:hidden">
          <Icon name="back" size={20} />
        </Link>
        <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-pink-soft">
          <MascotBadge size={40} mood="love" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="font-display truncate text-[17px] font-semibold">{partner}</span>
          <span className="text-[12px] font-semibold text-ink-soft">{together ? `💞 Day ${together.days.toLocaleString()} together` : "💌 Love chat"}</span>
        </span>
        <button type="button" aria-label="I miss you" title="I miss you" onClick={() => start(async () => (await sendMiss(), flash(`${partner} knows you miss them 🥺`), router.refresh()))} className="press flex size-10 items-center justify-center rounded-full hover:bg-pink-soft">
          <Emote name="please" size={30} />
        </button>
        <button type="button" aria-label="Ask for a pap" title="Ask for a pap" onClick={() => start(async () => (await askPap(), flash(`Asked ${partner} for a pap 📸`), router.refresh()))} className="press flex size-10 items-center justify-center rounded-full hover:bg-sky-soft">
          <CuteIcon name="image" size={28} />
        </button>
        <Link href="/play" aria-label="Games" title="Play a game together" className="flex size-10 items-center justify-center rounded-full text-xl hover:bg-sun-soft">
          <CuteIcon name="game" size={28} />
        </Link>
        <button type="button" aria-label="Chat look" title="Wallpaper and our day" onClick={() => setCustom(true)} className="flex size-10 items-center justify-center rounded-full hover:bg-lilac-soft">
          <Icon name="palette" size={21} stroke={2.1} />
        </button>
      </div>
      {/* wallpaper: fixed behind the messages, so a photo never stretches */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: look.background }} />

      {/* messages */}
      <div className="relative z-[1] flex flex-1 flex-col px-3 pb-3 pt-1">
        {messages.length === 0 && pending.length === 0 && (
          <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-2 rounded-3xl bg-white/90 p-5 text-center shadow-sm">
            <BuiltinStickerArt s={STICKERS[0]} size={110} />
            <p className="font-display text-lg font-semibold">Say hi to {partner} 💌</p>
            <p className="text-[13px] font-semibold text-ink-soft">Messages, paps and stickers pop up on {partner}&apos;s phone right away.</p>
          </div>
        )}
        {rows.map(({ m, showDay, isFirst }) => {
          return (
            <div key={m.id} className="flex flex-col">
              {showDay && (
                <span suppressHydrationWarning className="mx-auto my-3 rounded-full bg-white/90 px-3 py-0.5 text-[12px] font-bold text-ink-soft shadow-sm">
                  {tz.label(m.at)}
                </span>
              )}
              {m.kind === "miss" || m.kind === "papask" ? (
                <span className="mx-auto my-1.5 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[12.5px] font-bold shadow-sm">
                  {m.kind === "miss" ? <Emote name="please" size={22} animate /> : <CuteIcon name="image" size={20} />}
                  {m.kind === "miss" ? (m.mine ? `You told ${partner} you miss them` : `${partner} misses you`) : `${m.mine ? "You asked" : `${partner} asked`} for a pap`}
                  <span className="font-semibold text-ink-soft">{tz.time(m.at)}</span>
                  {!m.mine && m.kind === "papask" && (
                    <button type="button" onClick={() => cam.current?.click()} className="ml-1 rounded-full bg-sky px-2 py-0.5 text-[12px]">
                      Send one
                    </button>
                  )}
                </span>
              ) : (
                <Bubble m={m} first={isFirst} partner={partner} tz={tz} onOpen={setSheet} onReply={(x) => (setReply(x), box.current?.focus())} />
              )}
            </div>
          );
        })}
        {pending.map((p) => (
          <div key={p.id} className="mt-1 flex justify-end">
            <span className="max-w-[80%] rounded-[18px] bg-bubble/70 px-2.5 py-1.5 text-[15px] font-medium opacity-80">
              {p.text} <span className="text-[11px] text-ink-soft">🕓</span>
            </span>
          </div>
        ))}
        <div ref={end} className="h-1" />
      </div>

      {/* composer */}
      <div className="sticky bottom-0 z-20 border-t border-[var(--color-line)] bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:rounded-b-3xl">
        {toast && <p className="pop-in mb-1 px-1 text-[13px] font-bold">{toast}</p>}
        {error && (
          <p role="alert" className="mb-1 rounded-xl bg-pink-soft px-2.5 py-1 text-[13px] font-bold">
            {error}
          </p>
        )}
        {papAsked && !photo && <p className="mb-1 px-1 text-[13px] font-bold">📸 {partner} wants a pap! Tap the camera or pick one from your gallery.</p>}
        {reply && (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl border-l-[3px] border-[#B39CFF] bg-quote px-2.5 py-1.5">
            <span className="min-w-0 flex-1 text-[12.5px]">
              <span className="block font-bold text-grape">{reply.mine ? "You" : partner}</span>
              <span className="line-clamp-1 text-ink-soft">{replyLabel(reply)}</span>
            </span>
            <button type="button" onClick={() => setReply(null)} aria-label="Cancel reply" className="rounded-full p-1">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {photo && (
          <div className="mb-1.5 flex items-center gap-2 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="Pap to send" className="size-14 rounded-xl object-cover" />
            <span className="flex-1 text-[13px] font-semibold text-ink-soft">Add a caption, or just send 📸</span>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="rounded-full bg-cream p-1.5">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            aria-label="Stickers and emoji"
            aria-expanded={!!panel}
            onClick={() => setPanel((p) => (p ? null : "cute"))}
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[22px] ${panel ? "bg-sun-soft" : "hover:bg-cream"}`}
          >
            {panel ? <Icon name="close" size={20} /> : <Emote name="happy" size={30} />}
          </button>
          <label htmlFor="love-text" className="sr-only-safe">
            Message to {partner}
          </label>
          <textarea
            id="love-text"
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setPanel(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                sendText();
              }
            }}
            rows={1}
            maxLength={500}
            placeholder={photo ? "Caption" : "Message"}
            className="max-h-36 min-h-11 flex-1 resize-none rounded-[22px] border border-[var(--color-line)] bg-cream px-3.5 py-2.5 text-[15px] font-medium outline-none focus:border-[var(--color-line-strong)]"
          />
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
          {!text.trim() && !photo ? (
            <>
              <button type="button" onClick={() => file.current?.click()} aria-label="Send a photo from your gallery" title="Gallery" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-cream">
                <Icon name="gallery" size={22} stroke={2.1} />
              </button>
              <button type="button" onClick={() => cam.current?.click()} aria-label="Take a pap with the camera" title="Camera" className={`flex size-11 shrink-0 items-center justify-center rounded-full ${papAsked ? "animate-pulse bg-sky" : "hover:bg-cream"}`}>
                <Icon name="camera" size={22} stroke={2.2} />
              </button>
            </>
          ) : (
            <button type="button" onClick={sendText} aria-label="Send" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#FF8A5C] text-white">
              <Icon name="send" size={20} stroke={2.4} />
            </button>
          )}
        </div>

        {panel && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-1">
              {(
                [
                  ["cute", "Cute faces"],
                  ["stickers", "Stickers"],
                  ["mine", "Ours"],
                  ["emoji", "Emoji"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setPanel(k)} className={`rounded-full px-3 py-1 text-[13px] font-bold ${panel === k ? "bg-ink text-cream" : "bg-cream text-ink-soft"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {panel === "cute" && (
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-8">
                  {EMOTE_NAMES.map((n) => (
                    <button key={n} type="button" onClick={() => sendSticker(`e:${n}`)} className="press flex flex-col items-center rounded-2xl p-1 hover:bg-cream" aria-label={`Send ${EMOTES[n].label}`}>
                      <Emote name={n} size={46} />
                      <span className="text-[10px] font-bold text-ink-soft">{EMOTES[n].label}</span>
                    </button>
                  ))}
                </div>
              )}
              {panel === "stickers" && (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {STICKERS.map((s) => (
                    <button key={s.id} type="button" onClick={() => sendSticker(`b:${s.id}`)} className="press flex justify-center rounded-2xl p-0.5 hover:bg-cream" aria-label={`Send sticker ${s.label}`}>
                      <BuiltinStickerArt s={s} size={76} />
                    </button>
                  ))}
                </div>
              )}
              {panel === "mine" && (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  <button type="button" onClick={() => setMaker(true)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-solid border-[var(--color-line-strong)] text-[12px] font-bold text-ink-soft">
                    <span className="text-2xl">＋</span>
                    Make one
                  </button>
                  {stickers.map((s) => (
                    <span key={s.id} className="relative">
                      <button type="button" onClick={() => sendSticker(`c:${s.id}`)} className="press block" aria-label={`Send sticker ${s.label ?? ""}`}>
                        <StickerView code={`c:${s.id}`} size={76} />
                      </button>
                      {s.mine && (
                        <button
                          type="button"
                          aria-label="Delete sticker"
                          onClick={() => confirm("Delete this sticker?") && start(async () => (await deleteSticker(s.id), router.refresh()))}
                          className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 shadow"
                        >
                          <Icon name="close" size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {panel === "emoji" && (
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI.map((e) => (
                    <button key={e} type="button" onClick={() => setText((t) => t + e)} className="flex aspect-square items-center justify-center rounded-xl text-2xl hover:bg-cream">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {custom && <ChatLook current={wall} together={together?.since ?? null} onPick={setWall} onClose={() => setCustom(false)} />}

      {/* message actions */}
      {sheet && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 md:items-center" onClick={() => setSheet(null)}>
          <div className="pop-in w-full max-w-md rounded-t-3xl bg-white p-4 pb-8 md:rounded-3xl md:pb-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 line-clamp-2 text-[13px] font-semibold text-ink-soft">{replyLabel(sheet)}</p>
            {!sheet.mine && (
              <div className="mb-3 flex justify-between">
                {REACTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      const id = sheet.id;
                      setSheet(null);
                      start(async () => (await reactLove(id, r), router.refresh()));
                    }}
                    className={`press flex size-12 items-center justify-center rounded-full ${sheet.reaction === r ? "bg-sun-soft" : "hover:bg-cream"}`}
                  >
                    <ReactionMark r={r} size={34} />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col">
              <button type="button" onClick={() => (setReply(sheet), setSheet(null), box.current?.focus())} className="flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-bold hover:bg-cream">
                ↩️ Reply
              </button>
              {sheet.kind === "note" && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(sheet.text).catch(() => {});
                    setSheet(null);
                    flash("Copied");
                  }}
                  className="flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-bold hover:bg-cream"
                >
                  📋 Copy
                </button>
              )}
              {sheet.photos[0] && (
                <a href={`/api/love/photo/${sheet.photos[0]}`} target="_blank" rel="noreferrer" className="flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-bold hover:bg-cream">
                  🔍 Open photo
                </a>
              )}
              {sheet.mine && (
                <button
                  type="button"
                  onClick={() => {
                    const id = sheet.id;
                    setSheet(null);
                    if (confirm("Delete this message for both of you?")) start(async () => (await deleteLove(id), router.refresh()));
                  }}
                  className="flex h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-bold text-coral hover:bg-pink-soft"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {maker && <StickerMaker onClose={() => setMaker(false)} onSaved={() => (setMaker(false), setPanel("mine"), router.refresh())} />}
    </div>
  );
}

/* ---------------- make your own sticker ---------------- */

function StickerMaker({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [label, setLabel] = useState("");
  const [frame, setFrame] = useState<"round" | "heart" | "square">("round");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const S = 512;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    if (frame === "round") ctx.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2);
    else if (frame === "square") ctx.roundRect(14, 14, S - 28, S - 28, 110);
    else {
      ctx.moveTo(S / 2, S - 40);
      ctx.bezierCurveTo(-60, 300, 70, -10, S / 2, 130);
      ctx.bezierCurveTo(S - 70, -10, S + 60, 300, S / 2, S - 40);
    }
    ctx.closePath();
    ctx.lineWidth = 26;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "#FFE6D6";
    ctx.fillRect(0, 0, S, S);
    if (img) {
      const s = Math.max(S / img.naturalWidth, S / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    }
    ctx.restore();
    if (label.trim()) {
      ctx.font = "700 56px Fredoka Variable, Nunito Variable, sans-serif";
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 14;
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#2E2240";
      ctx.strokeText(label.trim(), S / 2, S - 40, S - 40);
      ctx.fillText(label.trim(), S / 2, S - 40, S - 40);
    }
  }, [img, label, frame]);

  async function choose(f: File | undefined) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setErr("That photo couldn't be opened");
    i.src = url;
  }

  async function save() {
    const c = canvas.current;
    if (!c || !img) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn't make it"))), "image/png"));
      const fd = new FormData();
      fd.append("file", blob, "sticker.png");
      fd.append("label", label.trim());
      const r = await fetch("/api/love/sticker", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || "Couldn't save it");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div className="pop-in flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-white p-4 pb-8 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg font-semibold">Make a sticker</p>
        <div className="flex items-center gap-3">
          <canvas ref={canvas} width={512} height={512} className="size-36 shrink-0 rounded-2xl bg-cream" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <button type="button" onClick={() => input.current?.click()} className="sticker-sm press h-10 rounded-xl bg-sun-soft text-[14px] font-bold">
              {img ? "Change photo" : "Pick a photo"}
            </button>
            <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={18} placeholder="Words (optional)" className="field h-10 min-h-0 text-[14px]" />
            <div className="flex gap-1.5">
              {(["round", "heart", "square"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFrame(f)} className={`flex-1 rounded-lg py-1 text-[12px] font-bold ${frame === f ? "bg-ink text-cream" : "bg-cream"}`}>
                  {f === "round" ? "⚪ Round" : f === "heart" ? "🤍 Heart" : "⬜ Soft"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {err && <p className="text-[13px] font-bold text-coral">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-[15px] font-bold">
            Cancel
          </button>
          <button type="button" disabled={!img || busy} onClick={save} className="h-11 rounded-xl bg-[#FF8A5C] px-5 text-[15px] font-bold text-white disabled:opacity-50">
            {busy ? "Saving" : "Save sticker"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- wallpaper + our day ---------------- */

function ChatLook({ current, together, onPick, onClose }: { current: string; together: string | null; onPick: (code: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState(together ?? "");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function preset(id: string) {
    setErr(null);
    onPick(`p:${id}`);
    await fetch("/api/love/bg", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ preset: id }) }).catch(() => setErr("No connection"));
  }
  async function photo(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const p = await photoForChichi(f);
      const fd = new FormData();
      fd.append("photo", p.blob, "wallpaper.jpg");
      const r = await fetch("/api/love/bg", { method: "POST", body: fd });
      const d = (await r.json().catch(() => ({}))) as { bg?: string; error?: string };
      if (!r.ok || !d.bg) throw new Error(d.error || "Couldn't save it");
      onPick(d.bg);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div className="pop-in flex max-h-[85dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <p className="font-display flex-1 text-lg font-semibold">Chat look</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-cream">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-ink-soft">Wallpaper (only on your phone)</p>
          <div className="grid grid-cols-5 gap-2">
            {CHAT_BGS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => preset(b.id)}
                aria-pressed={current === `p:${b.id}`}
                className={`flex flex-col items-center gap-1 rounded-2xl p-1 text-[11px] font-bold ${current === `p:${b.id}` ? "ring-2 ring-[#FF8A5C]" : ""}`}
              >
                <span className="h-14 w-full rounded-xl border border-[var(--color-line)]" style={{ background: b.css }} />
                {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              aria-pressed={current.startsWith("f:")}
              className={`flex flex-col items-center gap-1 rounded-2xl p-1 text-[11px] font-bold ${current.startsWith("f:") ? "ring-2 ring-[#FF8A5C]" : ""}`}
            >
              <span className="flex h-14 w-full items-center justify-center rounded-xl border border-solid border-[var(--color-line-strong)] bg-cream">
                {busy ? "" : <Icon name="gallery" size={22} />}
              </span>
              My photo
            </button>
          </div>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => (photo(e.target.files?.[0]), (e.target.value = ""))} />
          {err && <p className="text-[13px] font-bold text-coral">{err}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-ink-soft">💞 Together since</p>
          <div className="flex gap-2">
            <input type="date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => (setDay(e.target.value), setSaved(false))} className="field flex-1" aria-label="Together since" />
            <button
              type="button"
              onClick={async () => {
                await setTogetherSince(day || null);
                setSaved(true);
                router.refresh();
              }}
              className="rounded-2xl bg-[#FF8A5C] px-4 text-[14px] font-bold text-white"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <p className="text-[12px] font-semibold text-ink-soft">The chat shows how many days you&apos;ve been together, and Danchi celebrates your monthsaries 🎉</p>
        </div>
      </div>
    </div>
  );
}
