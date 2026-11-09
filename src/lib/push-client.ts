"use client";

/**
 * Phone notifications, the browser side. Shared by Settings (PushSetup) and
 * the always-on PushKeeper.
 *
 * Why notifications used to "reset": the browser can drop a push
 * subscription by itself (app update, service worker update, Chrome/Android
 * refreshing the push token). The old code only made a subscription when
 * someone tapped "Turn on". Now every app open checks it and quietly makes a
 * new one when the permission is still "allowed", so it heals itself.
 */

export type PushState = "loading" | "unsupported" | "ios-install" | "nokey" | "denied" | "ask" | "off" | "on";

const WANT_KEY = "danchi-push-want"; // "1" wants pings on this device, "0" turned them off on purpose
const SYNC_KEY = "danchi-push-sync"; // last endpoint we saved on the server + when
const SOUND_KEY = "danchi-chime"; // "off" = no in-app chime
const RESYNC_MS = 6 * 60 * 60 * 1000;

/* ---------- small helpers ---------- */

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {}
}

export function wantsPush(): "yes" | "no" | "unknown" {
  const v = ls(WANT_KEY);
  return v === "1" ? "yes" : v === "0" ? "no" : "unknown";
}

export function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** True when the saved subscription was made with this server's key. */
function sameKey(sub: PushSubscription, publicKey: string) {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // browser doesn't tell us; assume fine
  const a = new Uint8Array(k);
  const b = keyToBytes(publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getReg(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js").catch(() => null);
  return navigator.serviceWorker.ready;
}

export type ServerSync = { ok: boolean; lastOkAt: string | null; devices: number };

async function saveOnServer(sub: PushSubscription, oldEndpoint?: string | null): Promise<ServerSync | null> {
  const r = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), oldEndpoint: oldEndpoint || undefined }),
  });
  if (!r.ok) return null;
  lsSet(SYNC_KEY, JSON.stringify({ endpoint: sub.endpoint, at: Date.now() }));
  return (await r.json()) as ServerSync;
}

/* ---------- the main bits ---------- */

/** What this device looks like right now, without asking anything. */
export async function readPushState(publicKey: string | null): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (!publicKey) return "nokey";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return wantsPush() === "yes" ? "ask" : "off";
  if (wantsPush() === "no") return "off";
  const reg = await getReg();
  const sub = await reg.pushManager.getSubscription();
  return sub && sameKey(sub, publicKey) ? "on" : "ask";
}

/**
 * Make sure this device gets pings. With `ask` it may show the browser's
 * permission popup (must come from a tap). Without it, it only repairs things
 * when permission is already allowed. Safe to call as often as you like.
 */
export async function enablePush(
  publicKey: string | null,
  opts: { ask?: boolean; force?: boolean } = {},
): Promise<{ state: PushState; server: ServerSync | null; healed: boolean }> {
  const base = await readPushState(publicKey).catch(() => "unsupported" as PushState);
  if (base === "unsupported" || base === "ios-install" || base === "nokey") return { state: base, server: null, healed: false };

  let perm = Notification.permission;
  if (perm === "default") {
    if (!opts.ask) return { state: base, server: null, healed: false };
    perm = await Notification.requestPermission();
  }
  if (perm === "denied") return { state: "denied", server: null, healed: false };
  if (perm !== "granted") return { state: wantsPush() === "yes" ? "ask" : "off", server: null, healed: false };
  if (!opts.ask && wantsPush() === "no") return { state: "off", server: null, healed: false };

  const reg = await getReg();
  let sub = await reg.pushManager.getSubscription();
  let healed = false;
  let oldEndpoint: string | null = null;
  if (sub && !sameKey(sub, publicKey!)) {
    oldEndpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey!) });
    healed = true;
  }
  lsSet(WANT_KEY, "1");

  // Tell the server (always on a new subscription, otherwise every few hours).
  let last: { endpoint?: string; at?: number } = {};
  try {
    last = JSON.parse(ls(SYNC_KEY) || "{}");
  } catch {}
  const stale = last.endpoint !== sub.endpoint || !last.at || Date.now() - last.at > RESYNC_MS;
  const server = healed || stale || opts.force ? await saveOnServer(sub, oldEndpoint) : null;
  return { state: "on", server, healed };
}

/** Turn pings off on this device only. */
export async function disablePush() {
  lsSet(WANT_KEY, "0");
  lsSet(SYNC_KEY, null);
  if (!pushSupported()) return;
  const reg = await getReg();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

/** Remove notifications with this tag from this phone (e.g. the pinned status). */
export async function closeNotifications(tag: string) {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const list = (await reg?.getNotifications({ tag })) ?? [];
  list.forEach((n) => n.close());
}

/* ---------- Chichi's chime (plays inside the app) ---------- */

export function chimeOn() {
  return ls(SOUND_KEY) !== "off";
}
export function setChime(on: boolean) {
  lsSet(SOUND_KEY, on ? "on" : "off");
  window.dispatchEvent(new Event("danchi-chime"));
}

let ctx: AudioContext | null = null;

/**
 * A cute little chime made in the browser (no sound file).
 *   "reminder" two bright rings, "safety" urgent triple, anything else a soft pop.
 */
export function playChime(kind?: string) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ctx = ctx ?? new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    const notes: [number, number][] =
      kind === "safety"
        ? [[988, 0], [988, 0.22], [1319, 0.44], [988, 0.8], [988, 1.02], [1319, 1.24]]
        : kind === "reminder"
          ? [[784, 0], [1047, 0.16], [1319, 0.32], [1047, 0.7], [1319, 0.86]]
          : [[880, 0], [1175, 0.14], [1568, 0.28]];
    const vol = kind === "safety" ? 0.5 : kind === "reminder" ? 0.42 : 0.3;
    for (const [f, at] of notes) {
      for (const [type, mult, gainMul] of [["sine", 1, 1], ["triangle", 2, 0.25]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = f * mult;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(vol * gainMul, t0 + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.45);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at);
        o.stop(t0 + at + 0.5);
      }
    }
  } catch {}
  try {
    navigator.vibrate?.(kind === "safety" ? [300, 120, 300, 120, 500] : kind === "reminder" ? [200, 100, 200] : [80]);
  } catch {}
}
