"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Mascot } from "@/components/mascot";

/* ======================= helpers (phone hardware) ======================= */

type Pos = { lat: number; lng: number; accuracy: number };

function onePosition(timeout: number): Promise<Pos | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const t = setTimeout(() => resolve(null), timeout + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => (clearTimeout(t), resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) })),
      () => (clearTimeout(t), resolve(null)),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    );
  });
}

async function batteryLevel(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    const b = await nav.getBattery?.();
    return b ? Math.round(b.level * 100) : null;
  } catch {
    return null;
  }
}

/** Open one camera for a moment, take one photo, close it again. */
async function snap(facing: "user" | "environment"): Promise<Blob | null> {
  let stream: MediaStream | null = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    const v = document.createElement("video");
    v.playsInline = true;
    v.muted = true;
    v.srcObject = stream;
    await v.play();
    await new Promise((r) => setTimeout(r, 800)); // let the camera adjust to the light
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 960;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), "image/jpeg", 0.82));
  } catch {
    return null;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).then((r) => r.json().catch(() => ({})));

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

/* ======================= the button ======================= */

export type SosActive = { id: string; token: string } | null;

/**
 * The red SOS button. Needs 3 presses within ~3 seconds, then a 5 second
 * countdown that can be cancelled, so a pocket tap never calls anyone.
 */
export function SosButton({
  numbers,
  phoneReady,
  active = null,
  autoStart = false,
  size = "big",
  camera = false,
}: {
  numbers: string[];
  phoneReady: boolean;
  active?: SosActive;
  autoStart?: boolean;
  size?: "big" | "small";
  camera?: boolean;
}) {
  const [taps, setTaps] = useState(0);
  const [open, setOpen] = useState<"countdown" | "live" | "practice" | null>(active ? "live" : autoStart ? "countdown" : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function press() {
    buzz(60);
    const n = taps + 1;
    if (timer.current) clearTimeout(timer.current);
    if (n >= 3) {
      setTaps(0);
      setOpen("countdown");
      return;
    }
    setTaps(n);
    timer.current = setTimeout(() => setTaps(0), 3000);
  }

  const big = size === "big";
  return (
    <>
      <button
        type="button"
        onClick={press}
        aria-label={taps ? `SOS, press ${3 - taps} more times` : "SOS, press 3 times"}
        className={`press relative flex flex-col items-center justify-center rounded-full border-[3px] border-ink bg-linear-to-b from-[#FF6B6B] to-[#E0344A] font-extrabold text-white shadow-[0_6px_0_#2E2240] ${
          big ? "size-40" : "size-24"
        } ${taps ? "animate-pulse" : ""}`}
      >
        <span className={`font-display font-bold leading-none ${big ? "text-[44px]" : "text-[26px]"}`}>SOS</span>
        <span className={`mt-1 flex gap-1.5 ${big ? "" : "scale-75"}`} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`size-3 rounded-full border-2 border-white ${i < taps ? "bg-white" : ""}`} />
          ))}
        </span>
        <span className={`mt-1 font-extrabold ${big ? "text-[13px]" : "text-[10px]"}`}>{taps ? `${3 - taps} more` : "press 3×"}</span>
      </button>
      {open && (
        <SosScreen
          mode={open}
          numbers={numbers}
          phoneReady={phoneReady}
          resume={active}
          camera={camera}
          onGoLive={() => setOpen("live")}
          onClose={() => setOpen(null)}
        />
      )}
      {size === "big" && (
        <button type="button" onClick={() => setOpen("practice")} className="text-[13px] font-extrabold underline">
          Practice SOS (nobody gets called)
        </button>
      )}
    </>
  );
}

/* ======================= full screen SOS ======================= */

function SosScreen({
  mode,
  numbers,
  phoneReady,
  resume,
  camera,
  onGoLive,
  onClose,
}: {
  mode: "countdown" | "live" | "practice";
  numbers: string[];
  phoneReady: boolean;
  resume: SosActive;
  camera: boolean;
  onGoLive: () => void;
  onClose: () => void;
}) {
  const practice = mode === "practice";
  const [phase, setPhase] = useState<"countdown" | "live" | "ended">(mode === "live" ? "live" : "countdown");
  const [count, setCount] = useState(5);
  const [sos, setSos] = useState<SosActive>(resume);
  const [calling, setCalling] = useState<number | null>(resume ? (phoneReady ? numbers.length : 0) : null);
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [acc, setAcc] = useState<number | null>(null);
  const [photos, setPhotos] = useState(0);
  const [preview, setPreview] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hold, setHold] = useState(0);
  const started = useRef(false);
  const watch = useRef<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const sentAt = useRef(0);

  // countdown, with a buzz every second
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      if (!practice) onGoLive();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("live");
      return;
    }
    buzz([200]);
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, count, practice, onGoLive]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const uploadPhoto = useCallback(
    async (id: string | null, which: "front" | "back") => {
      const blob = await snap(which === "front" ? "user" : "environment");
      if (!blob) return false;
      if (practice || !id) {
        setPreview((p) => [...p, URL.createObjectURL(blob)]);
        setPhotos((n) => n + 1);
        return true;
      }
      const fd = new FormData();
      fd.append("id", id);
      fd.append("which", which);
      fd.append("file", blob, `${which}.jpg`);
      const r = await fetch("/api/sos/photo", { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) setPhotos((n) => n + 1);
      return !!r?.ok;
    },
    [practice],
  );

  // go live: alert, location, photos
  useEffect(() => {
    if (phase !== "live" || started.current) return;
    started.current = true;
    let stop = false;
    (async () => {
      buzz([400, 150, 400]);
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        lock.current = (await wl?.request("screen")) ?? null;
      } catch {}
      if (!lock.current) setNote("Keep this screen open so your location keeps updating.");

      const [first, battery] = await Promise.all([onePosition(3000), batteryLevel()]);
      if (first) setAcc(first.accuracy);
      let id = resume?.id ?? null;
      if (!practice) {
        const r = (await post("/api/sos/start", { ...(first ?? {}), battery }).catch(() => ({}))) as { id?: string; token?: string; calling?: number };
        if (r.id) {
          id = r.id;
          setSos({ id: r.id, token: r.token ?? "" });
          setCalling(r.calling ?? 0);
          if (first) {
            sentAt.current = Date.now();
            setLastSent(Date.now());
          }
        } else setNote("No internet? Use the call buttons below right now.");
      }

      if ("geolocation" in navigator) {
        watch.current = navigator.geolocation.watchPosition(
          async (p) => {
            const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
            setAcc(pos.accuracy);
            if (Date.now() - sentAt.current < 8000) return;
            sentAt.current = Date.now();
            if (practice || !id) return setLastSent(Date.now());
            const r = (await post("/api/sos/point", { id, ...pos, battery: await batteryLevel() }).catch(() => null)) as { ok?: boolean } | null;
            if (r?.ok) setLastSent(Date.now());
          },
          () => setNote("Location is off. Turn on Location in your phone settings."),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
        );
      }

      // Photos only if SHE turned the SOS camera on. One from each camera now, and again after 45 seconds.
      if (!camera) return;
      for (const round of [0, 1]) {
        if (round) await new Promise((r) => setTimeout(r, 45_000));
        if (stop) return;
        const a = await uploadPhoto(id, "front");
        const b = await uploadPhoto(id, "back");
        if (!a && !b && round === 0) setNote((n) => n ?? "Camera is blocked. Allow the camera for Danchi in your browser settings.");
        if (practice) break;
      }
    })();
    return () => {
      stop = true;
    };
  }, [phase, practice, resume, uploadPhoto, camera]);

  // cleanup
  useEffect(
    () => () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
      lock.current?.release().catch(() => {});
    },
    [],
  );

  // press and hold 2s to say "I'm safe"
  useEffect(() => {
    if (!hold) return;
    if (hold >= 20) {
      (async () => {
        if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
        lock.current?.release().catch(() => {});
        if (!practice && sos) await post("/api/sos/end", { id: sos.id }).catch(() => {});
        buzz(80);
        setPhase("ended");
        setHold(0);
      })();
      return;
    }
    const t = setTimeout(() => setHold((h) => (h ? h + 1 : 0)), 100);
    return () => clearTimeout(t);
  }, [hold, practice, sos]);

  const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

  if (phase === "countdown") {
    return (
      <div role="alertdialog" aria-modal className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-linear-to-b from-[#FF6B6B] to-[#C9213A] p-6 text-center text-white">
        <p className="font-display text-2xl font-bold">{practice ? "Practice SOS" : "Sending SOS in"}</p>
        <p className="font-display text-[120px] font-bold leading-none">{count}</p>
        <p className="max-w-xs text-[15px] font-bold">
          {practice
            ? "This is only practice. Nobody will be called."
            : `Then Chichi calls ${phoneReady && numbers.length ? `${numbers.length} numbers` : "Rafi"} and shares your live location${camera ? " and a photo from both cameras" : ""}.`}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="press h-20 w-full max-w-xs rounded-[28px] border-[3px] border-ink bg-white text-[26px] font-extrabold text-ink shadow-[0_6px_0_#2E2240]"
        >
          Cancel
        </button>
        <button type="button" onClick={() => setCount(0)} className="text-sm font-extrabold underline">
          {practice ? "Skip the countdown" : "Send now"}
        </button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-mint-soft p-6 text-center">
        <Mascot mood="cheer" size={140} />
        <p className="font-display text-3xl font-bold">{practice ? "Practice done 💛" : "Glad you're safe 💛"}</p>
        <p className="max-w-xs text-[15px] font-bold text-ink-soft">
          {practice ? "Now you know how it works. In a real emergency just press SOS 3 times." : "Rafi was told you're okay now."}
        </p>
        {practice && preview.length > 0 && (
          <div className="flex gap-2">
            {preview.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt="Practice photo" className="size-24 rounded-2xl border-2 border-ink object-cover" />
            ))}
          </div>
        )}
        <button type="button" onClick={onClose} className="sticker press rounded-2xl bg-sun px-6 py-3 text-lg font-extrabold">
          Close
        </button>
      </div>
    );
  }

  const fresh = lastSent != null && now - lastSent < 30_000;
  return (
    <div role="alertdialog" aria-modal className="fixed inset-0 z-[200] flex flex-col gap-3 overflow-y-auto bg-linear-to-b from-[#E0344A] to-[#9E1630] p-4 pb-8 text-white">
      <div className="flex items-center gap-3 pt-2">
        <span className="relative flex size-4">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-4 rounded-full bg-white" />
        </span>
        <p className="font-display text-[28px] font-bold leading-none">{practice ? "Practice SOS" : "SOS is on"}</p>
      </div>
      <p className="text-[15px] font-bold">{practice ? "Nothing is being sent. This is what you'd see." : "Help is being called. Stay on this screen if you can."}</p>

      <ul className="flex flex-col gap-2 rounded-[22px] border-[3px] border-ink bg-white p-3 text-[15px] font-extrabold text-ink">
        <li className="flex items-center gap-2">
          <CuteIcon name="sos" size={30} />
          <span className="flex-1">
            {practice
              ? `Would call ${numbers.length || 0} numbers + ring Rafi's Danchi`
              : calling == null
                ? "Alerting"
                : calling > 0
                  ? `Calling ${calling} numbers + texting them your live link`
                  : "Rafi's phone is ringing (Danchi alert + email)"}
          </span>
          <span>{calling != null || practice ? "✓" : ""}</span>
        </li>
        <li className="flex items-center gap-2">
          <CuteIcon name="compass" size={30} />
          <span className="flex-1">
            {lastSent ? `Live location ${practice ? "found" : "sent"} ${ago(now - lastSent)}` : "Finding your location"}
            {acc != null && <span className="block text-xs text-ink-soft">accurate to about {acc} m</span>}
          </span>
          <span>{fresh ? "✓" : ""}</span>
        </li>
        {camera && (
          <li className="flex items-center gap-2">
            <CuteIcon name="image" size={30} />
            <span className="flex-1">{photos ? `${photos} photo${photos > 1 ? "s" : ""} ${practice ? "taken" : "sent"} (front and back camera)` : "Taking photos"}</span>
            <span>{photos ? "✓" : ""}</span>
          </li>
        )}
      </ul>
      {note && <p className="rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-sm font-extrabold text-ink">{note}</p>}

      <div className="grid grid-cols-2 gap-2">
        {numbers[0] && (
          <a href={tel(numbers[0])} className="press col-span-2 flex h-16 animate-pulse items-center justify-center gap-2 rounded-2xl border-[3px] border-ink bg-white text-[19px] font-extrabold text-ink">
            📞 Call {numbers.length > 1 ? "number 1" : "now"}
            <span className="text-[13px] font-bold text-ink-soft">ends {numbers[0].slice(-4)}</span>
          </a>
        )}
        {numbers.slice(1, 4).map((n, i) => (
          <a key={n} href={tel(n)} className="press flex h-14 flex-col items-center justify-center rounded-2xl border-[3px] border-ink bg-white text-[15px] font-extrabold leading-tight text-ink">
            📞 Call number {i + 2}
            <span className="text-[11px] font-bold text-ink-soft">ends {n.slice(-4)}</span>
          </a>
        ))}
        <a href="tel:999" className="press col-span-2 flex h-14 items-center justify-center gap-1 rounded-2xl border-[3px] border-ink bg-sun text-[17px] font-extrabold text-ink">
          🚑 Call 999 (police, ambulance)
        </a>
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 pt-3">
        <button
          type="button"
          onPointerDown={() => setHold(1)}
          onPointerUp={() => setHold(0)}
          onPointerLeave={() => setHold(0)}
          onContextMenu={(e) => e.preventDefault()}
          className="relative h-16 w-full max-w-sm overflow-hidden rounded-[24px] border-[3px] border-ink bg-mint text-[18px] font-extrabold text-ink select-none"
        >
          <span className="absolute inset-y-0 left-0 bg-white/70 transition-[width] duration-100" style={{ width: `${hold * 5}%` }} aria-hidden />
          <span className="relative">{hold ? "Keep holding" : "Hold 2 seconds: I'm safe now"}</span>
        </button>
        {practice && (
          <button type="button" onClick={() => setPhase("ended")} className="text-sm font-extrabold underline">
            End practice
          </button>
        )}
      </div>
    </div>
  );
}

/* ======================= get ready ======================= */

/** Ask for location once, calmly, so an emergency never waits on a permission popup. */
export function SosReady({ camera }: { camera: boolean }) {
  const [state, setState] = useState<{ loc?: boolean; cam?: boolean; busy?: boolean }>({});
  async function check() {
    setState({ busy: true });
    const pos = await onePosition(8000);
    let cam: boolean | undefined;
    if (camera) {
      cam = false;
      try {
        const s = await navigator.mediaDevices?.getUserMedia({ video: true, audio: false });
        cam = !!s;
        s?.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    setState({ loc: !!pos, cam });
  }
  const row = (ok: boolean | undefined, t: string) => (
    <span className="flex items-center gap-2">
      <span className={`flex size-6 items-center justify-center rounded-full border border-line text-xs ${ok ? "bg-mint" : ok === false ? "bg-coral text-white" : "bg-white"}`}>
        {ok ? "✓" : ok === false ? "!" : "?"}
      </span>
      {t}
    </span>
  );
  const ready = state.loc && (!camera || state.cam);
  return (
    <div className="flex flex-col gap-2 text-sm font-bold">
      {row(state.loc, state.loc === false ? "Location blocked: allow it for Danchi in Chrome settings" : "Location allowed")}
      {camera && row(state.cam, state.cam === false ? "Camera blocked: allow it for Danchi in Chrome settings" : "Camera allowed")}
      <button type="button" onClick={check} disabled={state.busy} className="sticker-sm press self-start rounded-2xl bg-white px-3.5 py-2 font-extrabold">
        {state.busy ? "Checking" : ready ? "All ready ✓ Check again" : camera ? "Allow location + camera" : "Allow location"}
      </button>
    </div>
  );
}

/* ======================= her camera choice ======================= */

/** Off by default. Only she can switch it on, and the browser asks her too. */
export function SosCameraToggle({ on }: { on: boolean }) {
  const [val, setVal] = useState(on);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function flip() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!val) {
        if (!confirm("Turn on the SOS camera?\n\nOnly when YOU press SOS 3 times, Danchi takes one photo with the front and back camera to help find you. You can turn this off any time and delete the photos.")) return;
        try {
          const s = await navigator.mediaDevices?.getUserMedia({ video: true, audio: false });
          s?.getTracks().forEach((t) => t.stop());
        } catch {
          setMsg("Chrome didn't allow the camera, so it stays off.");
          return;
        }
      }
      const { setSosCamera } = await import("@/app/(app)/care-actions");
      await setSosCamera(!val);
      setVal(!val);
      setMsg(!val ? "SOS camera is on. Only used when you press SOS." : "SOS camera is off. No photos will be taken.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" role="switch" aria-checked={val} onClick={flip} disabled={busy} className="flex items-center gap-3 text-left disabled:opacity-60">
        <span className={`relative h-7 w-12 shrink-0 rounded-full border border-line transition-colors ${val ? "bg-leaf" : "bg-white"}`}>
          <span className={`absolute top-0.5 size-[22px] rounded-full bg-white shadow transition-transform ${val ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-extrabold">📸 SOS camera {val ? "on" : "off"}</span>
          <span className="text-xs font-bold text-ink-soft">
            {val ? "When you press SOS, one photo from each camera is sent. Deleted automatically after 7 days." : "Off: SOS never uses your camera. Turn on only if you want it."}
          </span>
        </span>
      </button>
      {msg && <p className="text-xs font-extrabold">{msg}</p>}
    </div>
  );
}

/* ======================= test the calls ======================= */

type TestRes = { ready: boolean; results: { to: string; ok: boolean; info: string }[]; error: string | null };

function hintFor(info: string) {
  if (/unverified|verify/i.test(info)) return "Twilio trial: verify this number in Twilio (Phone Numbers, Verified Caller IDs) first.";
  if (/permission|geo|not authorized to call|international/i.test(info)) return "Turn on calls to Malaysia and Indonesia in Twilio: Voice, Settings, Geo permissions.";
  if (/from|caller id|not a valid phone number.*from/i.test(info)) return "TWILIO_FROM must be a phone number you bought in Twilio (with +).";
  if (/authenticate|credentials|20003/i.test(info)) return "The Twilio SID or Auth Token is wrong. Run deploy/keys.sh again.";
  if (/balance|funds|credit/i.test(info)) return "Your Twilio balance is empty. Top it up a little.";
  return "";
}

export function SosTestCall() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TestRes | null>(null);
  async function run() {
    if (!confirm("Ring every SOS number now with a short test message? (It says clearly that it's only a test.)")) return;
    setBusy(true);
    try {
      const { testSosCall } = await import("@/app/(app)/care-actions");
      setRes(await testSosCall());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2 text-sm font-bold">
      <button type="button" onClick={run} disabled={busy} className="sticker-sm press self-start rounded-2xl bg-white px-3.5 py-2 font-extrabold disabled:opacity-60">
        {busy ? "Calling" : "📞 Test SOS call"}
      </button>
      {res?.error && <p className="text-coral">{res.error}</p>}
      {res && !res.ready && (
        <p className="rounded-xl bg-sun-soft p-2.5 text-[13px]">
          Phone calls aren&apos;t set up yet, so SOS can&apos;t ring a normal phone. Rafi needs a Twilio account and then runs <b>bash deploy/keys.sh</b> on the mini PC (fill in the Twilio part). Until then SOS rings his Danchi app, emails him, and shows you big call buttons.
        </p>
      )}
      {res?.results.map((r) => (
        <p key={r.to} className={`rounded-xl p-2.5 text-[13px] ${r.ok ? "bg-mint-soft" : "bg-pink-soft"}`}>
          {r.ok ? "✓" : "✗"} {r.to}: {r.ok ? "ringing now" : r.info}
          {!r.ok && hintFor(r.info) && <span className="block font-semibold">{hintFor(r.info)}</span>}
        </p>
      ))}
    </div>
  );
}
