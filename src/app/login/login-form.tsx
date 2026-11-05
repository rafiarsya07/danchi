"use client";

import { useActionState, useState } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { Mascot } from "@/components/mascot";
import { googleSignIn, login, sendCode, verifyCode, type LoginState } from "./actions";

const ERRORS: Record<string, string> = {
  signup_disabled: "This Danchi only opens for its two people 🍑",
  unable_to_create_user: "This Danchi only opens for its two people 🍑",
  "account not linked": "That Google account isn't one of ours 🍑",
  access_denied: "Google sign in was cancelled. Try again?",
  google_off: "Google sign in isn't set up on the server yet.",
  google_failed: "Couldn't reach Google. Try again?",
};

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginForm({
  urlError,
  codeLogin,
  passwordLogin,
  googleReady,
}: {
  urlError?: string;
  codeLogin: boolean;
  passwordLogin: boolean;
  googleReady: boolean;
}) {
  const [mode, setMode] = useState<"google" | "code" | "password">("google");
  const [show, setShow] = useState(false);
  const [goPending, setGoPending] = useState(false);
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(login, {});
  const [sendState, sendAction, sendPending] = useActionState<LoginState, FormData>(sendCode, {});
  const [codeState, codeAction, codePending] = useActionState<LoginState, FormData>(verifyCode, {});

  const pending = goPending || pwPending || sendPending || codePending;
  const codeSent = !!(sendState.codeSent || codeState.codeSent);
  const urlMsg = urlError ? ERRORS[urlError] ?? ERRORS[urlError.toLowerCase()] ?? "Couldn't sign in. Try again?" : undefined;
  const error = mode === "password" ? pwState.error : mode === "code" ? codeState.error ?? sendState.error : urlMsg;
  const email = (mode === "password" ? pwState.email : codeState.email ?? sendState.email) ?? "";

  return (
    <>
      <div className="flex flex-col items-center">
        <Mascot mood={pending ? "think" : error ? "worried" : codeSent ? "remind" : "wave"} size={160} title="Chichi waving hello" />
        <h1 className="font-display -mt-1 text-5xl font-bold leading-none">Danchi</h1>
        <p className="mt-1.5 text-[15px] font-extrabold text-ink-soft">Welcome home 🌼</p>
      </div>

      <div className="sticker flex w-full flex-col gap-3.5 rounded-[28px] bg-white p-4">
        {mode === "google" && (
          <form action={googleSignIn} onSubmit={() => setGoPending(true)} className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={pending || !googleReady}
              className="sticker press flex h-[60px] items-center justify-center gap-3 rounded-2xl bg-white text-[18px] font-extrabold disabled:opacity-60"
            >
              <GoogleG />
              {goPending ? "Opening Google" : "Continue with Google"}
            </button>
            <p className="text-center text-[13px] font-bold text-ink-soft">Only our two Google accounts can open this door 🔒</p>
          </form>
        )}

        {mode === "password" && (
          <form action={pwAction} className="flex flex-col gap-3">
            <Field icon="inbox" label="Email">
              <input id="email" name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={email} placeholder="you@gmail.com" className="field h-14 pl-14 text-[17px]" />
            </Field>
            <Field icon="lock" label="Password">
              <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Password" required className="field h-14 pl-14 pr-14 text-[17px]" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center">
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </Field>
            <input type="hidden" name="remember" value="on" />
            <button type="submit" disabled={pending} className="sticker press font-display flex h-14 items-center justify-center rounded-2xl bg-sun text-xl font-bold disabled:opacity-60">
              {pwPending ? "Opening the door" : "Open the door"}
            </button>
          </form>
        )}

        {mode === "code" &&
          (!codeSent ? (
            <form action={sendAction} className="flex flex-col gap-3">
              <p className="text-center text-[15px] font-extrabold">I&apos;ll email you a 6 number code 💌</p>
              <Field icon="inbox" label="Email">
                <input name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={email} placeholder="you@gmail.com" className="field h-14 pl-14 text-[17px]" />
              </Field>
              <button type="submit" disabled={pending} className="sticker press font-display flex h-14 items-center justify-center rounded-2xl bg-sun text-xl font-bold disabled:opacity-60">
                {sendPending ? "Sending" : "Email me a code"}
              </button>
            </form>
          ) : (
            <form action={codeAction} className="flex flex-col gap-3">
              <p className="text-center text-[15px] font-extrabold">
                Check <span className="underline">{email}</span> for your code ✨
              </p>
              <input type="hidden" name="email" value={email} />
              <label htmlFor="otp" className="sr-only-safe">
                6 number code
              </label>
              <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000000" className="field font-display h-16 text-center text-3xl tracking-[0.4em]" />
              <button type="submit" disabled={pending} className="sticker press font-display flex h-14 items-center justify-center rounded-2xl bg-sun text-xl font-bold disabled:opacity-60">
                {codePending ? "Checking" : "Come in"}
              </button>
            </form>
          ))}

        {error && (
          <p role="alert" className="rounded-2xl border-2 border-ink bg-pink-soft px-4 py-2 text-center text-sm font-extrabold">
            {error}
          </p>
        )}

        {(codeLogin || passwordLogin) && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {mode !== "google" && googleReady && (
              <button type="button" onClick={() => setMode("google")} className="px-2 py-1 text-sm font-extrabold underline decoration-2 underline-offset-4">
                Use Google
              </button>
            )}
            {mode !== "code" && codeLogin && (
              <button type="button" onClick={() => setMode("code")} className="px-2 py-1 text-sm font-extrabold underline decoration-2 underline-offset-4">
                Email me a code instead
              </button>
            )}
            {mode !== "password" && passwordLogin && (
              <button type="button" onClick={() => setMode("password")} className="px-2 py-1 text-sm font-extrabold underline decoration-2 underline-offset-4">
                Use a password
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-1 pl-1.5 pr-3.5 text-[13px] font-extrabold">
        <CuteIcon name="lock" size={24} />
        Private, just the two of us
      </div>
    </>
  );
}

function Field({ icon, label, children }: { icon: "inbox" | "lock"; label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="sr-only-safe">{label}</span>
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
        <CuteIcon name={icon} size={32} />
      </span>
      {children}
    </div>
  );
}
