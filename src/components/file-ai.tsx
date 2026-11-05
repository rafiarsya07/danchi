"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cardsFromAttachment, summarizeAttachment } from "@/app/(app)/life-actions";

/** ✨ buttons under a PDF / photo: summary note, flashcards, practice questions. */
export function FileAI({ fileId }: { fileId: string }) {
  const [pending, start] = useTransition();
  const [what, setWhat] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; href?: string } | null>(null);
  const router = useRouter();

  const run = (kind: "summary" | "flashcards" | "practice") => {
    setWhat(kind);
    setMsg(null);
    start(async () => {
      if (kind === "summary") {
        const r = await summarizeAttachment(fileId);
        setMsg(r.ok ? { text: "Summary saved to Notes ✨", href: `/notes/${r.noteId}` } : { text: r.error ?? "Didn't work" });
      } else {
        const r = await cardsFromAttachment(fileId, kind);
        setMsg(r.ok ? { text: `${r.n} ${kind === "flashcards" ? "flashcards" : "practice questions"} ready ✨`, href: `/study/deck/${r.deckId}` } : { text: r.error ?? "Didn't work" });
      }
      router.refresh();
    });
  };

  const btn = "h-8 rounded-full border-2 border-ink bg-lilac-soft px-2.5 text-[11px] font-extrabold disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-8">
      <button type="button" disabled={pending} onClick={() => run("summary")} className={btn}>
        {pending && what === "summary" ? "Reading" : "✨ Summarize"}
      </button>
      <button type="button" disabled={pending} onClick={() => run("flashcards")} className={btn}>
        {pending && what === "flashcards" ? "Making cards" : "✨ Flashcards"}
      </button>
      <button type="button" disabled={pending} onClick={() => run("practice")} className={btn}>
        {pending && what === "practice" ? "Writing questions" : "✨ Practice questions"}
      </button>
      {msg && (
        <span role="status" className="text-xs font-extrabold">
          {msg.href ? (
            <a href={msg.href} className="underline">
              {msg.text}
            </a>
          ) : (
            msg.text
          )}
        </span>
      )}
    </div>
  );
}
