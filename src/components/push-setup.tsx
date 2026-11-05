"use client";

import { useActionState, useEffect, useState } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Mascot } from "@/components/mascot";
import { saveNotifySettings, type ActionResult } from "@/app/(app)/actions";
import { setIslandPref, useIslandPref } from "@/components/island";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "nokey" | "denied" | "off" | "on" | "ios-install";

/** Turn push notifications on/off for THIS device, and send a test. */
export function PushSetup({ publicKey, isOwner, mailReady }: { publicKey: string | null; isOwner: boolean; mailReady: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (!publicKey) return setState("nokey");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      const r = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error("save failed");
      setState("on");
      setMsg("Yay! This phone will get Chichi's pings 🌼");
    } catch {
      setMsg("Hmm, that didn't work. Try again?");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function test(email: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const d = (await r.json()) as { pushed: number; mailed: boolean; pushReady: boolean; mailReady: boolean };
      if (email) setMsg(d.mailed ? "Email sent! Check your inbox 💌" : d.mailReady ? "Email couldn't be sent. Rafi should check SMTP." : "Email isn't set up yet (SMTP in .env).");
      else setMsg(d.pushed ? "Sent! Look at your notifications 🔔" : d.pushReady ? "No device got it. Turn notifications on first." : "Push isn't set up yet (VAPID keys in .env).");
    } catch {
      setMsg("Couldn't reach Danchi. Try again?");
    } finally {
      setBusy(false);
    }
  }

  const status: Record<State, { text: string; tone: string }> = {
    loading: { text: "Checking", tone: "bg-white" },
    unsupported: { text: "This browser can't do notifications. Try Chrome.", tone: "bg-pink-soft" },
    "ios-install": { text: "On iPhone: Share → Add to Home Screen, then open Danchi from there.", tone: "bg-sun-soft" },
    nokey: { text: "Push isn't set up on the server yet (VAPID keys).", tone: "bg-pink-soft" },
    denied: { text: "Notifications are blocked. Allow them in the browser's site settings.", tone: "bg-pink-soft" },
    off: { text: "Off on this device", tone: "bg-white" },
    on: { text: "On for this device", tone: "bg-mint" },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Mascot mood={state === "on" ? "cheer" : "remind"} size={84} animate={state !== "loading"} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-lg font-bold leading-tight">Pings on this phone</p>
          <span className={`self-start rounded-full border-2 border-ink px-2.5 py-0.5 text-[13px] font-extrabold ${status[state].tone}`}>{status[state].text}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {state === "off" && (
          <button type="button" onClick={turnOn} disabled={busy} className="sticker press font-display h-12 rounded-2xl bg-sun px-5 text-lg font-bold disabled:opacity-60">
            Turn on notifications
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" onClick={() => test(false)} disabled={busy} className="sticker-sm press h-11 rounded-2xl bg-sun px-4 text-sm font-extrabold disabled:opacity-60">
              🔔 Send me a test
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className="h-11 rounded-2xl border-2 border-ink bg-white px-4 text-sm font-extrabold disabled:opacity-60">
              Turn off here
            </button>
          </>
        )}
        {isOwner && mailReady && (
          <button type="button" onClick={() => test(true)} disabled={busy} className="h-11 rounded-2xl border-2 border-ink bg-white px-4 text-sm font-extrabold disabled:opacity-60">
            💌 Test email
          </button>
        )}
      </div>
      {msg && (
        <p role="status" className="pop-in self-start rounded-2xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
          {msg}
        </p>
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const label = (h: number) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);

export function NotifyForm({
  digestHour,
  nudgeHour,
  emailDigest,
  emailReminders,
  pinnedStatus,
  readOnly,
}: {
  digestHour: number;
  nudgeHour: number;
  emailDigest: boolean;
  emailReminders: boolean;
  pinnedStatus: boolean;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveNotifySettings, { ok: false });
  const saved = state.ok && !pending;

  return (
    <form action={action} className="flex flex-col gap-3">
      <fieldset disabled={readOnly} className="flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-2.5">
          <CuteIcon name="calendar" size={36} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-extrabold">Morning summary</span>
            <span className="text-xs font-bold text-ink-soft">Today&apos;s tasks, reminders, expiring &amp; low stuff</span>
          </span>
          <select name="digestHour" defaultValue={digestHour} className="field h-11 w-28 px-2 text-sm">
            <option value={-1}>Off</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-2.5">
          <CuteIcon name="tasks" size={36} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-extrabold">Evening nudge</span>
            <span className="text-xs font-bold text-ink-soft">Only if today&apos;s tasks are still open</span>
          </span>
          <select name="nudgeHour" defaultValue={nudgeHour} className="field h-11 w-28 px-2 text-sm">
            <option value={-1}>Off</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3">
          <input type="checkbox" name="emailDigest" defaultChecked={emailDigest} className="size-5 accent-[#FF8A5C]" />
          <span className="flex-1 text-[15px] font-extrabold">Email me the morning summary</span>
          <CuteIcon name="inbox" size={30} />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3">
          <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} className="size-5 accent-[#FF8A5C]" />
          <span className="flex-1 text-[15px] font-extrabold">Email every reminder too</span>
          <CuteIcon name="bell" size={30} />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3 py-2">
          <input type="checkbox" name="pinnedStatus" defaultChecked={pinnedStatus} className="size-5 accent-[#FF8A5C]" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-extrabold">Pinned status on the phone</span>
            <span className="text-xs font-bold text-ink-soft">One quiet notification that updates itself: next reminder, tasks left, expiring stuff. Android &ldquo;Dynamic Island&rdquo; apps can show it at the top of the screen.</span>
          </span>
          <CuteIcon name="clock" size={30} />
        </label>
      </fieldset>
      {!readOnly && (
        <button type="submit" disabled={pending} className="sticker press font-display h-12 self-start rounded-2xl bg-sun px-6 text-lg font-bold disabled:opacity-60">
          {pending ? "Saving" : saved ? "Saved ✓" : "Save"}
        </button>
      )}
    </form>
  );
}

/** This device only: show the Chichi Island pill at the top of the app. */
export function IslandToggle() {
  const on = useIslandPref();
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3 py-2">
      <input type="checkbox" checked={on} onChange={(e) => setIslandPref(e.target.checked)} className="size-5 accent-[#FF8A5C]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-extrabold">Show Chichi Island on this device</span>
        <span className="text-xs font-bold text-ink-soft">The little live pill at the top: countdown to your next reminder, tap it for quick actions.</span>
      </span>
      <Mascot mood="happy" size={40} animate={false} />
    </label>
  );
}
