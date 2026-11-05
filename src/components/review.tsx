"use client";

import { useState, useTransition } from "react";
import { Mascot } from "@/components/mascot";
import { reviewCard } from "@/app/(app)/more-actions";

type C = { id: string; front: string; back: string };

/** Flip-card review session. Again puts the card back at the end of today's pile. */
export function Review({ cards }: { cards: C[] }) {
  const [queue, setQueue] = useState(cards);
  const [flipped, setFlipped] = useState(false);
  const [doneCount, setDone] = useState(0);
  const [, start] = useTransition();
  const card = queue[0];

  if (cards.length === 0) return null;
  if (!card) {
    return (
      <div className="sticker flex flex-col items-center gap-1 rounded-[28px] bg-mint p-5 text-center">
        <Mascot mood="cheer" size={110} />
        <p className="font-display text-xl font-bold">All {doneCount} cards done!</p>
        <p className="text-sm font-bold">Your brain is glowing ✨ See you tomorrow.</p>
      </div>
    );
  }

  const grade = (g: 0 | 1 | 2 | 3) => {
    start(() => reviewCard(card.id, g));
    setFlipped(false);
    setQueue((q) => (g === 0 ? [...q.slice(1), q[0]] : q.slice(1)));
    if (g > 0) setDone((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center text-sm font-extrabold text-ink-soft">{queue.length} left in this session</div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={`sticker flex min-h-52 flex-col items-center justify-center gap-3 rounded-[28px] p-6 text-center transition ${flipped ? "bg-sun" : "bg-white"}`}
      >
        <span className="text-xs font-extrabold uppercase tracking-wider text-ink-soft">{flipped ? "Answer" : "Question"}</span>
        <span className="font-display whitespace-pre-wrap text-2xl font-bold">{flipped ? card.back : card.front}</span>
        {!flipped && <span className="text-xs font-bold text-ink-soft">Tap to flip</span>}
      </button>
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { g: 0 as const, t: "Again", c: "bg-coral text-white" },
            { g: 1 as const, t: "Hard", c: "bg-peach" },
            { g: 2 as const, t: "Good", c: "bg-mint" },
            { g: 3 as const, t: "Easy", c: "bg-sky" },
          ].map((b) => (
            <button key={b.t} type="button" onClick={() => grade(b.g)} className={`sticker-sm press h-12 rounded-2xl text-sm font-extrabold ${b.c}`}>
              {b.t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
