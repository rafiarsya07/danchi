"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Mascot, MascotBadge } from "@/components/mascot";
import { askChichi, photoForChichi, type AskImage, type Source } from "@/lib/ask-client";

export type Msg = { id: string; role: "user" | "model"; text: string; actions?: string[] | null; sources?: Source[] | null; photo?: string | null };

type Idea = { label: string; send?: string; fill?: string };
const OWNER_IDEAS: Idea[] = [
  { label: "🌞 What should I focus on today?" },
  { label: "🍳 What can I cook with what I have?" },
  { label: "📚 Plan my study week" },
  { label: "🧠 Explain something simply", fill: "Explain this to me simply, with an example: " },
  { label: "✉️ Help me write a message", fill: "Help me write a polite message to " },
  { label: "🌏 Translate", fill: "Translate to Malay: " },
  { label: "🥘 A recipe for", fill: "Give me an easy recipe for " },
  { label: "☔ Weather in KL today?", send: "What's the weather in Kuala Lumpur today and tomorrow?" },
  { label: "💸 How's my spending this month?" },
  { label: "⏰ Remind me to drink water at 3pm every day" },
];
const VIEWER_IDEAS: Idea[] = [
  { label: "What does she have to do today?" },
  { label: "🎁 Gift ideas she'd love?", send: "Based on what Chichi remembers, what gift ideas would she love?" },
  { label: "💞 A cute date idea this weekend", send: "Give me a cute, affordable date idea in Kuala Lumpur this weekend." },
  { label: "🛒 What's on her shopping list?" },
];

let seq = 0;
const nid = (p: string) => `${p}${++seq}-${Math.random().toString(36).slice(2, 7)}`;

/* ---------------- tiny safe markdown ---------------- */

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={`${key}t${i++}`}>{text.slice(last, m.index).replace(/(^|\s)\*([^*]+)\*/g, "$1$2")}</Fragment>);
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}b${i++}`} className="font-black">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}c${i++}`} className="rounded bg-ink/10 px-1 text-[0.92em]">{t.slice(1, -1)}</code>);
    else {
      const md = t.match(/^\[([^\]]+)\]\((.+)\)$/);
      const href = md ? md[2] : t;
      out.push(
        <a key={`${key}a${i++}`} href={href} target="_blank" rel="noreferrer noopener" className="break-all text-[#7a3fd1] underline decoration-2 underline-offset-2">
          {md ? md[1] : t.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(<Fragment key={`${key}t${i++}`}>{text.slice(last).replace(/(^|\s)\*([^*]+)\*/g, "$1$2")}</Fragment>);
  return out;
}

function Rich({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const k = `l${i}`;
    if (!line.trim()) {
      blocks.push(<div key={k} className="h-1.5" />);
      continue;
    }
    // table
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      blocks.push(
        <div key={k} className="my-1 overflow-x-auto rounded-xl border-2 border-ink/20">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-peach-soft font-black" : "border-t border-ink/10"}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 align-top">
                      {inline(c, `${k}${ri}${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = line.match(/^\s*#{1,4}\s+(.*)$/) ?? line.match(/^\s*\*\*([^*]+)\*\*:?\s*$/);
    if (h) {
      blocks.push(
        <p key={k} className="font-display mt-1 text-[16px] font-bold">
          {h[1].replace(/\*\*/g, "")}
        </p>,
      );
      continue;
    }
    const num = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/);
    if (num) {
      blocks.push(
        <div key={k} className="flex gap-2 pl-0.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-[11px] font-black">{num[1]}</span>
          <span className="min-w-0">{inline(num[2], k)}</span>
        </div>,
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push(
        <div key={k} className="flex gap-1.5 pl-1">
          <span aria-hidden>🌼</span>
          <span className="min-w-0">{inline(bullet[1], k)}</span>
        </div>,
      );
      continue;
    }
    blocks.push(<p key={k}>{inline(line, k)}</p>);
  }
  return <>{blocks}</>;
}

function Sources({ items }: { items: Source[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => {
        let host = s.url;
        try {
          host = new URL(s.url).hostname.replace(/^www\./, "");
        } catch {}
        return (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            title={s.title}
            className="press flex max-w-[220px] items-center gap-1 rounded-full border-2 border-ink bg-sky-soft px-2.5 py-0.5 text-[12px] font-extrabold"
          >
            <Icon name="link" size={13} stroke={2.6} />
            <span className="truncate">{host}</span>
          </a>
        );
      })}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-extrabold text-ink-soft"
      aria-label="Copy answer"
    >
      <Icon name={ok ? "check" : "copy"} size={13} stroke={2.6} /> {ok ? "Copied" : "Copy"}
    </button>
  );
}

function ModelBubble({ m, live, status }: { m: Msg; live?: boolean; status?: string | null }) {
  return (
    <div className="flex max-w-[94%] items-end gap-2 self-start">
      <MascotBadge size={40} />
      <div className="flex min-w-0 flex-col gap-1.5">
        {m.actions?.map((a, i) => (
          <span key={i} className="self-start rounded-full border-2 border-ink bg-mint px-3 py-1 text-[13px] font-extrabold">
            ✓ {a}
          </span>
        ))}
        {(m.text || !live) && (
          <div className="flex flex-col gap-1 rounded-[22px] rounded-bl-md border-[2.5px] border-ink bg-white px-4 py-2.5 text-[15px] font-bold leading-snug">
            <Rich text={m.text} />
            {live && <span className="inline-block h-4 w-1.5 animate-pulse rounded bg-ink/60" aria-hidden />}
          </div>
        )}
        {live && status && (
          <span className="flex items-center gap-1.5 self-start rounded-full border-2 border-ink bg-lilac-soft px-3 py-1 text-[13px] font-extrabold">
            <span className="size-2 animate-ping rounded-full bg-[#7a3fd1]" aria-hidden />
            {status}
          </span>
        )}
        {m.sources && m.sources.length > 0 && <Sources items={m.sources} />}
        {!live && m.text && <CopyBtn text={m.text} />}
      </div>
    </div>
  );
}

export function Chat({
  initial,
  ready,
  readOnly,
  ownerName,
  prefill = "",
  autoSend = false,
  brain = null,
}: {
  initial: Msg[];
  ready: boolean;
  readOnly: boolean;
  ownerName: string;
  prefill?: string;
  autoSend?: boolean;
  brain?: string | null;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Msg | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [photo, setPhoto] = useState<(AskImage & { preview: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [showIdeas, setShowIdeas] = useState(initial.length < 2);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length, busy, error]);

  useEffect(() => {
    const t = box.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 160) + "px";
  }, [text]);

  async function send(message: string) {
    const m = message.trim();
    if ((!m && !photo) || busy) return;
    const img = photo;
    setError(null);
    setText("");
    setPhoto(null);
    setShowIdeas(false);
    setMsgs((x) => [...x, { id: nid("u"), role: "user", text: m || "What do you see in this photo?", photo: img?.preview ?? null }]);
    setBusy(true);
    setStatus(img ? "Looking at your photo" : "Thinking");
    const draft: Msg = { id: nid("m"), role: "model", text: "", actions: [], sources: [] };
    setLive({ ...draft });
    let lastPaint = 0;
    const paint = (force = false) => {
      const now = performance.now();
      if (!force && now - lastPaint < 50) return;
      lastPaint = now;
      setLive({ ...draft, actions: [...(draft.actions ?? [])], sources: [...(draft.sources ?? [])] });
      end.current?.scrollIntoView({ block: "end" });
    };
    try {
      const done = await askChichi(m, img ? { mime: img.mime, data: img.data } : null, {
        onStatus: (s) => setStatus(s),
        onDelta: (d) => {
          draft.text += d;
          setStatus(null);
          paint();
        },
        onAction: (a) => {
          draft.actions = [...(draft.actions ?? []), a];
          paint(true);
        },
        onSources: (s) => {
          draft.sources = s;
          paint(true);
        },
      });
      setMsgs((x) => [...x, { id: draft.id, role: "model", text: done.text, actions: done.actions, sources: done.sources }]);
      if (typeof done.left === "number") setLeft(done.left);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLive(null);
      setStatus(null);
      setBusy(false);
    }
  }

  const sentOnce = useRef(false);
  useEffect(() => {
    if (!autoSend || !prefill || !ready || sentOnce.current) return;
    sentOnce.current = true;
    window.history.replaceState(null, "", "/ask");
    setTimeout(() => send(prefill), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickPhoto(f: File | undefined) {
    if (!f) return;
    try {
      setPhoto(await photoForChichi(f));
      box.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function clear() {
    if (!confirm("Clear this chat?")) return;
    await fetch("/api/ask", { method: "DELETE" });
    setMsgs([]);
    setShowIdeas(true);
  }

  const ideas = readOnly ? VIEWER_IDEAS : OWNER_IDEAS;

  return (
    <div className="flex flex-col gap-3">
      {msgs.length === 0 && !live && (
        <div className="flex flex-col items-center gap-1 rounded-[28px] border-[2.5px] border-ink bg-lilac-soft px-5 pb-5 pt-3 text-center shadow-[0_4px_0_#2E2240]">
          <Mascot mood="wave" size={130} />
          <p className="font-display text-2xl font-bold">Hi {readOnly ? "there" : ownerName}! I&apos;m Chichi</p>
          <p className="max-w-sm text-[15px] font-bold text-ink-soft">
            {readOnly
              ? `Ask me anything about ${ownerName}'s Danchi, or anything at all.`
              : "Ask me literally anything: recipes, homework, “what does this mean”, emails, plans. Send a photo too 📷. And tell me what to remind you, what you wish for, what you spent. I'll handle it ✨"}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3" aria-live="polite">
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex max-w-[85%] flex-col items-end gap-1 self-end">
              {m.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo} alt="Your photo" className="max-h-56 rounded-2xl border-[2.5px] border-ink object-cover" />
              )}
              <div className="whitespace-pre-wrap rounded-[22px] rounded-br-md border-[2.5px] border-ink bg-sun px-4 py-2.5 text-[15px] font-bold">{m.text}</div>
            </div>
          ) : (
            <ModelBubble key={m.id} m={m} />
          ),
        )}
        {live && (live.text || live.actions?.length) ? (
          <ModelBubble m={live} live status={status} />
        ) : busy ? (
          <div className="flex items-center gap-1 self-start">
            <Mascot mood="think" size={70} />
            <span className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
              <span className="size-2 animate-ping rounded-full bg-[#7a3fd1]" aria-hidden />
              {status ?? "Chichi is thinking"}
            </span>
          </div>
        ) : null}
        {error && (
          <div className="flex items-center gap-1 self-start">
            <Mascot mood="worried" size={64} animate={false} />
            <p role="alert" className="rounded-2xl border-2 border-ink bg-pink-soft px-3 py-2 text-sm font-extrabold">
              {error}
            </p>
          </div>
        )}
        <div ref={end} />
      </div>

      {ready && showIdeas && (
        <div className="flex flex-wrap gap-2">
          {ideas.map((i) => (
            <button
              key={i.label}
              type="button"
              onClick={() => {
                if (i.fill) {
                  setText(i.fill);
                  setTimeout(() => {
                    box.current?.focus();
                    box.current?.setSelectionRange(i.fill!.length, i.fill!.length);
                  }, 0);
                } else send(i.send ?? i.label.replace(/^\p{Extended_Pictographic}️?\s*/u, ""));
              }}
              disabled={busy}
              className="press rounded-full border-2 border-ink bg-white px-3 py-1.5 text-[13px] font-extrabold shadow-[0_3px_0_#2E2240] disabled:opacity-50"
            >
              {i.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="sticky bottom-[104px] z-20 flex flex-col gap-2 rounded-[24px] border-[2.5px] border-ink bg-white p-2 shadow-[0_4px_0_#2E2240] md:bottom-4"
      >
        {photo && (
          <div className="flex items-center gap-2 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="Photo to send" className="size-14 rounded-xl border-2 border-ink object-cover" />
            <span className="flex-1 text-[13px] font-extrabold text-ink-soft">Photo ready. Ask about it, or just send 📷</span>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="press rounded-full border-2 border-ink bg-pink-soft p-1">
              <Icon name="close" size={16} stroke={2.6} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => (pickPhoto(e.target.files?.[0]), (e.target.value = ""))} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!ready || busy}
            aria-label="Add a photo"
            className="press flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-peach-soft disabled:opacity-50"
          >
            <Icon name="camera" size={20} stroke={2.4} />
          </button>
          <label htmlFor="ask" className="sr-only-safe">
            Message Chichi
          </label>
          <textarea
            id="ask"
            ref={box}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                send(text);
              }
            }}
            rows={1}
            maxLength={4000}
            disabled={!ready}
            placeholder={ready ? "Ask Chichi anything" : "Chichi isn't set up yet"}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] font-bold outline-none placeholder:text-[#6e6082]"
          />
          <button
            type="submit"
            disabled={!ready || busy || (!text.trim() && !photo)}
            aria-label="Send"
            className="sticker-sm press flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sun disabled:opacity-50"
          >
            <Icon name="send" size={20} stroke={2.6} />
          </button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs font-bold text-ink-soft">
        <span>
          {left !== null ? `${left} questions left today` : "Chichi checks the web when she isn't sure. Still double check big money or health stuff 🍑"}
        </span>
        {brain && <span>🧠 {brain}</span>}
        <span className="flex gap-3">
          {!showIdeas && ready && (
            <button type="button" onClick={() => setShowIdeas(true)} className="underline">
              Ideas
            </button>
          )}
          {msgs.length > 0 && (
            <button type="button" onClick={clear} className="underline">
              Clear chat
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
