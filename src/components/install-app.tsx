"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Mode = "loading" | "installed" | "prompt" | "ios" | "manual";

const HIDE_KEY = "danchi-install-hidden";

function detect(): Mode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
  if (standalone) return "installed";
  if ((window as unknown as { __danchiInstall?: BIPEvent }).__danchiInstall) return "prompt";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "manual";
}

/**
 * "Install Danchi" so it lives on the home screen like a real app (own icon,
 * full screen, notifications). On Android Chrome it's one tap.
 */
export function InstallApp({ variant = "card" }: { variant?: "card" | "settings" }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const update = () => setMode(detect());
    update();
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {}
    window.addEventListener("danchi-installable", update);
    window.addEventListener("appinstalled", () => setDone(true));
    return () => window.removeEventListener("danchi-installable", update);
  }, []);

  async function install() {
    const e = (window as unknown as { __danchiInstall?: BIPEvent }).__danchiInstall;
    if (!e) return;
    await e.prompt();
    const r = await e.userChoice;
    if (r.outcome === "accepted") setDone(true);
    (window as unknown as { __danchiInstall?: BIPEvent }).__danchiInstall = undefined;
  }

  if (mode === "loading") return null;
  if (variant === "card" && (mode === "installed" || mode === "manual" || hidden || done)) return null;

  const steps =
    mode === "ios"
      ? ["Tap the Share button (square with an arrow) at the bottom", "Scroll and tap Add to Home Screen", "Tap Add. Danchi appears on your home screen 🍑"]
      : ["Open Danchi in Chrome", "Tap the menu ⋮ at the top right", "Tap Install app (or Add to Home screen), then Install"];

  return (
    <section className={`flex flex-col gap-2.5 ${variant === "card" ? "sticker pop-in rounded-[26px] bg-white p-3.5" : ""}`}>
      {variant === "card" && (
        <div className="flex items-center gap-2">
          <Mascot mood="cheer" size={60} animate={false} />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="font-display text-lg font-bold">Put Danchi on your home screen</span>
            <span className="text-[13px] font-bold">Opens like a real app, full screen, with notifications.</span>
          </div>
        </div>
      )}
      {mode === "installed" || done ? (
        <p className="rounded-2xl border-2 border-ink bg-mint-soft px-3 py-2 text-sm font-extrabold">✓ Danchi is installed on this device. Open it from your home screen 🍑</p>
      ) : mode === "prompt" ? (
        <button type="button" onClick={install} className="sticker-sm press font-display h-12 rounded-2xl bg-white text-lg font-bold">
          📲 Install Danchi
        </button>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-2 text-sm font-bold">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-extrabold text-cream">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
      {variant === "card" && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {}
            setHidden(true);
          }}
          className="self-start text-xs font-extrabold underline"
        >
          Not now
        </button>
      )}
    </section>
  );
}
