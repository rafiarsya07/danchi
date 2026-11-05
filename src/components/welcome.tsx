"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";

const KEY = "danchi-welcome-v1";

/** First visit on a device: a friendly pointer to the Guide. Dismissed forever with one tap. */
export function WelcomeCard({ name }: { name: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) !== "done") setShow(true);
    } catch {}
  }, []);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "done");
    } catch {}
    setShow(false);
  };
  return (
    <section className="sticker pop-in flex items-center gap-2 rounded-[26px] bg-white py-2 pl-1 pr-3">
      <Mascot mood="wave" size={80} animate={false} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-display text-lg font-bold leading-tight">Welcome, {name}! New here?</span>
        <span className="text-[13px] font-bold">A 2 minute guide shows what everything does.</span>
        <div className="flex gap-2">
          <Link href="/guide" onClick={close} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
            Show me 👀
          </Link>
          <button type="button" onClick={close} className="px-2 text-sm font-extrabold underline">
            Later
          </button>
        </div>
      </div>
    </section>
  );
}
