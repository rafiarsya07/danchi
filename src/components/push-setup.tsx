"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Mascot } from "@/components/mascot";
import { saveNotifySettings, type ActionResult } from "@/app/(app)/actions";
import { setIslandPref, useIslandPref } from "@/components/island";
import {
  chimeOn,
  closeNotifications,
  disablePush,
  enablePush,
  playChime,
  readPushState,
  setChime,
  wantsPush,
  type PushState,
} from "@/lib/push-client";

type Health = { lastOkAt: string | null; devices: number } | null;

function ago(iso: string | null) {
  if (!iso) return "not yet";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function subscribeChime(cb: () => void) {
  window.addEventListener("danchi-chime", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("danchi-chime", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Turn push notifications on/off for THIS device, test them, and check the sound. */
export function PushSetup({ publicKey, isOwner, mailReady }: { publicKey: string | null; isOwner: boolean; mailReady: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [health, setHealth] = useState<Health>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const chime = useSyncExternalStore(subscribeChime, chimeOn, () => true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Read first, then repair quietly if the browser dropped the subscription.
      const r = await enablePush(publicKey, { force: true });
      if (!alive) return;
      setState(r.state === "loading" ? await readPushState(publicKey) : r.state);
      if (r.server) setHealth({ lastOkAt: r.server.lastOkAt, devices: r.server.devices });
      if (r.healed && wantsPush() === "yes") setMsg("Notifications were switched off by an update. Fixed them for you 🔧");
    })().catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [publicKey]);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enablePush(publicKey, { ask: true, force: true });
      setState(r.state);
      if (r.server) setHealth({ lastOkAt: r.server.lastOkAt, devices: r.server.devices });
      if (r.state === "on") {
        playChime();
        setMsg("Yay! This phone will get Chichi's pings 🌼 They stay on after updates now.");
      } else if (r.state === "denied") {
        setMsg("The phone said no. Allow notifications in the site settings, then come back.");
      }
    } catch {
      setMsg("Hmm, that didn't work. Try again?");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
      setHealth(null);
      setMsg(null);
    } finally {
      setBusy(false);
    }
  }

  async function test(opts: { email?: boolean; delay?: number }) {
    setBusy(true);
    setMsg(null);
    try {
      // make sure the server has this phone before testing
      if (!opts.email) await enablePush(publicKey, { force: true }).catch(() => null);
      const r = await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(opts) });
      const d = (await r.json()) as { pushed: number; mailed: boolean; pushReady: boolean; mailReady: boolean; scheduled?: boolean; devices?: number };
      if (opts.email) setMsg(d.mailed ? "Email sent! Check your inbox 💌" : d.mailReady ? "Email couldn't be sent. Rafi should check SMTP." : "Email isn't set up yet (SMTP in .env).");
      else if (d.scheduled) setMsg("Okay! Lock the phone or close Danchi now. The ping comes in 10 seconds, with the phone's sound 🔔");
      else setMsg(d.pushed ? "Sent! Look at your notifications 🔔" : d.pushReady ? "No device got it. Tap Turn on first." : "Push isn't set up yet (VAPID keys in .env).");
    } catch {
      setMsg("Couldn't reach Danchi. Try again?");
    } finally {
      setBusy(false);
    }
  }

  const status: Record<PushState, { text: string; tone: string }> = {
    loading: { text: "Checking", tone: "bg-white" },
    unsupported: { text: "This browser can't do notifications. Try Chrome.", tone: "bg-pink-soft" },
    "ios-install": { text: "On iPhone: Share → Add to Home Screen, then open Danchi from there.", tone: "bg-sun-soft" },
    nokey: { text: "Push isn't set up on the server yet (VAPID keys).", tone: "bg-pink-soft" },
    denied: { text: "Blocked. Allow notifications in the site settings.", tone: "bg-pink-soft" },
    ask: { text: "Needs one tap to come back on", tone: "bg-sun-soft" },
    off: { text: "Off on this device", tone: "bg-white" },
    on: { text: "On for this device", tone: "bg-mint" },
  };

  const chip = (ok: boolean, label: string) => (
    <span className={`rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold ${ok ? "bg-mint" : "bg-white"}`}>
      {ok ? "✓" : "•"} {label}
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Mascot mood={state === "on" ? "cheer" : "remind"} size={84} animate={state !== "loading"} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-lg font-bold leading-tight">Pings on this phone</p>
          <span className={`self-start rounded-full border-2 border-ink px-2.5 py-0.5 text-[13px] font-extrabold ${status[state].tone}`}>{status[state].text}</span>
        </div>
      </div>

      {state === "on" && (
        <div className="flex flex-wrap gap-1.5">
          {chip(true, "Allowed")}
          {chip(!!health, "Saved")}
          {chip(!!health?.lastOkAt, `Last ping ${ago(health?.lastOkAt ?? null)}`)}
          {health && health.devices > 1 && chip(true, `${health.devices} devices`)}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(state === "off" || state === "ask") && (
          <button type="button" onClick={turnOn} disabled={busy} className="sticker press font-display h-12 rounded-2xl bg-sun px-5 text-lg font-bold disabled:opacity-60">
            🔔 Turn on notifications
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" onClick={() => test({})} disabled={busy} className="sticker-sm press h-11 rounded-2xl bg-sun px-4 text-sm font-extrabold disabled:opacity-60">
              🔔 Test now
            </button>
            <button type="button" onClick={() => test({ delay: 10 })} disabled={busy} className="sticker-sm press h-11 rounded-2xl bg-sky px-4 text-sm font-extrabold disabled:opacity-60">
              ⏱ Test in 10s
            </button>
          </>
        )}
        <button type="button" onClick={() => playChime("reminder")} className="h-11 rounded-2xl border-2 border-ink bg-white px-4 text-sm font-extrabold">
          🔊 Hear the chime
        </button>
        {isOwner && mailReady && (
          <button type="button" onClick={() => test({ email: true })} disabled={busy} className="h-11 rounded-2xl border-2 border-ink bg-white px-4 text-sm font-extrabold disabled:opacity-60">
            💌 Test email
          </button>
        )}
        {state === "on" && (
          <button type="button" onClick={turnOff} disabled={busy} className="h-11 rounded-2xl px-3 text-sm font-extrabold text-ink-soft underline disabled:opacity-60">
            Turn off here
          </button>
        )}
      </div>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3 py-2">
        <input type="checkbox" checked={chime} onChange={(e) => setChime(e.target.checked)} className="size-5 accent-[#FF8A5C]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-extrabold">Chichi&apos;s chime while Danchi is open</span>
          <span className="text-xs font-bold text-ink-soft">When the app is closed, the phone plays its own notification sound.</span>
        </span>
        <CuteIcon name="bell" size={30} />
      </label>

      {msg && (
        <p role="status" className="pop-in self-start rounded-2xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
          {msg}
        </p>
      )}

      <details className="rounded-2xl bg-cream px-3 py-2 text-[13px] font-bold text-ink-soft">
        <summary className="cursor-pointer py-1 font-extrabold text-ink">No sound? 🔇</summary>
        <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5">
          <li>Phone not on silent / Do Not Disturb, and the volume for notifications is up.</li>
          <li>
            Android: long press a Danchi notification → <b>Settings</b> (or App info → Notifications) → set it to <b>Default / Alerting</b> with
            sound on. If Danchi isn&apos;t installed, do the same for <b>Chrome</b>.
          </li>
          <li>iPhone: Settings → Notifications → Danchi → Sounds on.</li>
          <li>Quiet hours in Settings make pings silent at night (safety alerts still ring).</li>
          <li>Tap <b>Test in 10s</b>, then lock the phone to hear the real sound.</li>
        </ol>
      </details>
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
          <input
            type="checkbox"
            name="pinnedStatus"
            defaultChecked={pinnedStatus}
            onChange={(e) => {
              if (!e.target.checked) void closeNotifications("danchi-island").catch(() => {});
            }}
            className="size-5 accent-[#FF8A5C]"
          />
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
