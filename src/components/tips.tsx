"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";

/** One small "did you know" a day, so she discovers Danchi bit by bit. */
const TIPS: { icon: CuteIconName; text: string; href: string; cta: string }[] = [
  { icon: "walk", text: "Going home late? Start a safe arrival timer. If you don't tap I'm safe, Rafi gets a heads up.", href: "/safe", cta: "Try it" },
  { icon: "pdf", text: "Upload lecture slides in a course, then tap ✨ Summarize. Chichi writes the key points for you.", href: "/study?tab=courses", cta: "Open Study" },
  { icon: "stuff", text: "Tap the minus button each time you use something. Danchi learns when you'll run out.", href: "/stuff", cta: "My stuff" },
  { icon: "coins", text: "At the shop, tap 💰 Paid and type the price. Danchi remembers which store is cheapest.", href: "/shop?tab=prices", cta: "See prices" },
  { icon: "mood", text: "2 minutes each night: Daily check wraps up your mood, tasks, habits and spending.", href: "/check", cta: "Daily check" },
  { icon: "ask", text: "Talk to Chichi like a friend: \"I spent RM 12 on lunch\" or \"remind me to call Mum at 8pm\".", href: "/ask", cta: "Ask Chichi" },
  { icon: "image", text: "Stuck on homework or don't know what to cook? Snap a photo 📷 in Ask Chichi and she'll explain or suggest recipes.", href: "/ask", cta: "Try it" },
  { icon: "star", text: "Chichi can answer anything, not just Danchi stuff: meanings, recipes, translations, the weather. She checks the web when she isn't sure.", href: "/ask", cta: "Ask anything" },
  { icon: "sos", text: "Practice the SOS button once (it calls nobody), so if you ever really need it, your fingers already know: press 3 times.", href: "/safe", cta: "Practice" },
  { icon: "letter", text: "Missing Rafi? Tap 🥺 I miss you on Home, or send him a pap 📸 in Love notes. You can reply to his notes too.", href: "/love", cta: "Love notes" },
  { icon: "party", text: "Bored? Play tic tac toe or answer today's couple question with Rafi in Play together.", href: "/play", cta: "Play" },
  { icon: "jar", text: "Something made you smile today? Drop it in your Happy jar. On a sad day, shake the jar.", href: "/cozy?tab=jar", cta: "Happy jar" },
  { icon: "focus", text: "Can't focus? Start a 25 minute Focus timer, then take a 5 minute break. Chichi counts your study time.", href: "/cozy?tab=focus", cta: "Focus" },
  { icon: "passport", text: "Add your passport and visa with their expiry dates. Chichi reminds you 2 months before.", href: "/papers", cta: "Papers" },
  { icon: "tasks", text: "Laundry every Sunday? Make it a task that repeats every week. It comes back by itself.", href: "/tasks?new=1", cta: "Add a task" },
  { icon: "lock", text: "You decide what Rafi can see. Untick anything in Settings, Privacy. Your cycle is always private.", href: "/settings#privacy", cta: "Privacy" },
  { icon: "learn", text: "Learning something new? Add a goal, write the steps, and log your minutes each week.", href: "/learn", cta: "Learning" },
  { icon: "cards", text: "Keep past year and midterm questions in a course. Review them like flashcards before the exam.", href: "/study?tab=cards", cta: "Flashcards" },
  { icon: "settings", text: "Too many cards on Home? Pick only the ones you want in Settings, Home screen. Moon mode is there too 🌙", href: "/settings", cta: "Settings" },
];

export function TipCard() {
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    let extra = 0;
    try {
      extra = Number(localStorage.getItem("danchi-tip-skip") || 0);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setI((day + extra) % TIPS.length);
  }, []);
  if (i === null) return null;
  const t = TIPS[i];
  const next = () => {
    try {
      localStorage.setItem("danchi-tip-skip", String(Number(localStorage.getItem("danchi-tip-skip") || 0) + 1));
    } catch {}
    setI((i + 1) % TIPS.length);
  };
  return (
    <section aria-label="Tip from Chichi" className="sticker-flat flex items-center gap-3 rounded-[24px] bg-linear-to-r from-lilac-soft to-sky-soft p-3">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-white">
        <CuteIcon name={t.icon} size={40} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">
          <CuteIcon name="bulb" size={16} /> Tip from Chichi
        </span>
        <p className="text-sm font-bold leading-snug">{t.text}</p>
        <div className="flex items-center gap-3">
          <Link href={t.href} className="rounded-full border-2 border-ink bg-white px-3 py-0.5 text-xs font-extrabold">
            {t.cta}
          </Link>
          <button type="button" onClick={next} className="text-xs font-extrabold underline">
            Another tip
          </button>
        </div>
      </div>
    </section>
  );
}
