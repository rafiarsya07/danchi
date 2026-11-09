"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";
import { chimeOn, enablePush, playChime, wantsPush, type PushState } from "@/lib/push-client";

const SNOOZE_KEY = "danchi-push-banner-later";

/**
 * Lives on every screen. It
 *  1. quietly repairs phone notifications after an update (no tap needed
 *     while the permission is still "allowed"),
 *  2. shows a one tap banner when the phone really forgot the permission,
 *  3. plays Chichi's chime when a ping arrives while Danchi is open.
 */
export function PushKeeper({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [later, setLater] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(SNOOZE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [noDevices, setNoDevices] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await enablePush(publicKey);
      setState(r.state);
      if (r.healed && wantsPush() === "yes") {
        setFlash("Pings are back on 🔔");
        setTimeout(() => setFlash(null), 4000);
      }
    } catch {
      /* offline or the browser said no; try again next time */
    }
  }, [publicKey]);

  // On open, whenever the app comes back to the front, and every 30 minutes.
  useEffect(() => {
    const first = setTimeout(() => void check(), 300);
    const onVis = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => document.visibilityState === "visible" && void check(), 30 * 60_000);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, [check]);

  // If this device never said yes or no, but the account has no phone at all,
  // offer it too (helps after the browser data was wiped).
  useEffect(() => {
    if (state !== "off" || wantsPush() !== "unknown") return;
    fetch("/api/push")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { devices?: number } | null) => setNoDevices(!!d && d.devices === 0))
      .catch(() => {});
  }, [state]);

  // Chime when a ping lands while the app is open (the service worker keeps
  // the phone's own sound quiet then, so you hear this one instead).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; chime?: boolean; kind?: string } | null;
      if (d?.type === "danchi-push" && d.chime && chimeOn()) playChime(d.kind);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      const r = await enablePush(publicKey, { ask: true, force: true });
      setState(r.state);
      if (r.state === "on") {
        playChime();
        setFlash("Yay, pings are on 🔔");
        setTimeout(() => setFlash(null), 4000);
      }
    } finally {
      setBusy(false);
    }
  }

  function snooze() {
    setLater(true);
    try {
      sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {}
  }

  const showAsk = !later && (state === "ask" || (state === "off" && noDevices));
  const showDenied = !later && state === "denied" && wantsPush() === "yes";

  return (
    <>
      {flash && (
        <div
          role="status"
          className="pop-in fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border-2 border-ink bg-mint px-4 py-2 text-sm font-extrabold shadow-[0_3px_0_#2E2240]"
        >
          {flash}
        </div>
      )}
      {showAsk && (
        <div className="pop-in sticker mb-4 flex items-center gap-3 rounded-[24px] bg-sun p-3">
          <Mascot mood="remind" size={64} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-display text-[17px] font-bold leading-tight">Chichi can&apos;t ping this phone right now</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="sticker-sm press h-11 rounded-2xl bg-white px-4 text-sm font-extrabold disabled:opacity-60"
              >
                {busy ? "Turning on..." : "🔔 Turn pings on"}
              </button>
              <button type="button" onClick={snooze} className="h-11 rounded-2xl px-3 text-sm font-extrabold text-ink-soft">
                Later
              </button>
            </div>
          </div>
        </div>
      )}
      {showDenied && (
        <div className="pop-in mb-4 flex items-center gap-3 rounded-[24px] border-[2.5px] border-ink bg-pink-soft p-3">
          <Mascot mood="worried" size={56} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-[15px] font-extrabold leading-tight">Pings are blocked on this phone</p>
            <p className="text-xs font-bold text-ink-soft">
              Tap the 🔒 next to the address (or App info → Notifications) and allow them.{" "}
              <Link href="/settings" className="underline">
                Help
              </Link>
            </p>
          </div>
          <button type="button" onClick={snooze} aria-label="Hide" className="flex size-11 shrink-0 items-center justify-center text-lg font-extrabold">
            ✕
          </button>
        </div>
      )}
    </>
  );
}
