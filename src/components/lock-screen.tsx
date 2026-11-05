"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Mascot } from "@/components/mascot";
import { SosButton, type SosActive } from "@/components/sos";
import { unlock } from "@/app/(app)/care-actions";
import { logout } from "@/app/login/actions";
import type { ActionResult } from "@/app/(app)/actions";

/** The PIN door. Shown instead of the app when Danchi is locked. */
export function LockScreen({ name, sos = null }: { name: string; sos?: { numbers: string[]; phoneReady: boolean; active: SosActive; camera: boolean } | null }) {
  const [pin, setPin] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, run, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await unlock(prev, fd);
    if (r.ok) router.refresh();
    else setPin("");
    return r;
  }, { ok: false });

  useEffect(() => {
    if (pin.length >= 4 && pin.length <= 6) {
      // Auto submit at 6 digits; for 4 or 5 digit PINs she taps the check.
      if (pin.length === 6) form.current?.requestSubmit();
    }
  }, [pin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      if (e.key === "Enter") form.current?.requestSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const key = "sticker-sm press flex h-16 items-center justify-center rounded-[22px] bg-white font-display text-[28px] font-bold";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-peach-soft px-4 py-8">
      <div className="flex w-full max-w-[340px] flex-col items-center gap-4">
        <Mascot mood={state.error ? "worried" : "love"} size={130} />
        <div className="text-center">
          <h1 className="font-display text-[28px] font-bold leading-tight">Welcome back, {name}</h1>
          <p className="text-sm font-extrabold text-ink-soft">Type your PIN to open Danchi 🔒</p>
        </div>
        <form ref={form} action={run} className="flex w-full flex-col items-center gap-4">
          <input type="hidden" name="pin" value={pin} />
          <div className="flex gap-3" aria-label={`${pin.length} digits typed`}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <span key={i} className={`flex size-9 items-center justify-center rounded-xl border-[2.5px] border-ink text-lg ${i < pin.length ? "bg-pink" : "bg-white"}`}>
                {i < pin.length ? "🍑" : ""}
              </span>
            ))}
          </div>
          {state.error && (
            <p role="alert" className="rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-center text-sm font-extrabold">
              {state.error}
            </p>
          )}
          <div className="grid w-full grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" disabled={pending} onClick={() => setPin((p) => (p.length < 6 ? p + d : p))} className={key}>
                {d}
              </button>
            ))}
            <button type="button" aria-label="Delete" disabled={pending} onClick={() => setPin((p) => p.slice(0, -1))} className={`${key} bg-lilac-soft`}>
              <Icon name="backspace" size={26} />
            </button>
            <button type="button" disabled={pending} onClick={() => setPin((p) => (p.length < 6 ? p + "0" : p))} className={key}>
              0
            </button>
            <button type="submit" aria-label="Unlock" disabled={pending || pin.length < 4} className={`${key} bg-mint disabled:opacity-50`}>
              <Icon name="check" size={28} stroke={3} />
            </button>
          </div>
        </form>
        {sos && (
          <div className="flex w-full flex-col items-center gap-1 rounded-[24px] border-2 border-solid border-ink/40 p-3">
            <span className="text-xs font-extrabold text-ink-soft">In danger? No PIN needed</span>
            <SosButton numbers={sos.numbers} phoneReady={sos.phoneReady} active={sos.active} camera={sos.camera} size="small" />
          </div>
        )}
        <form action={logout} className="text-center">
          <button type="submit" className="text-sm font-extrabold underline">
            Forgot your PIN? Sign in with Google again
          </button>
        </form>
      </div>
    </main>
  );
}

/**
 * Keeps the PIN unlock alive while she's using Danchi, and shows the lock
 * again after `minutes` away (phone in pocket, app in the background).
 */
export function LockKeeper({ minutes }: { minutes: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!minutes) return;
    let hiddenAt = 0;
    let last = 0;
    let active = Date.now();
    const touch = async () => {
      if (Date.now() - last < 30_000) return;
      last = Date.now();
      const r = await fetch("/api/lock/touch", { method: "POST" }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { locked?: boolean } | null;
      if (j?.locked) router.refresh();
    };
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > minutes * 60_000) router.refresh();
      else void touch();
    };
    const onAct = () => {
      active = Date.now();
      void touch();
    };
    void touch();
    // Idle on screen for too long counts as away too.
    const id = setInterval(() => {
      if (Date.now() - active > minutes * 60_000) router.refresh();
    }, 30_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", onAct);
    window.addEventListener("keydown", onAct);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", onAct);
      window.removeEventListener("keydown", onAct);
    };
  }, [minutes, router]);
  return null;
}
