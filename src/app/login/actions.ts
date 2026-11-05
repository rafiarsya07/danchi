"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleConfigured, isAllowed } from "@/lib/auth";

export type LoginState = { error?: string; codeSent?: boolean; email?: string };

// Small in memory limiter: 6 failed tries per 15 minutes per IP + email.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX = 6;

function clientKey(h: Headers, email: string) {
  const ip =
    h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return `${ip}:${email}`;
}

function blocked(key: string) {
  const f = failures.get(key);
  return !!f && f.count >= MAX && f.until > Date.now();
}

function fail(key: string) {
  const now = Date.now();
  const f = failures.get(key);
  failures.set(key, f && f.until > now ? { count: f.count + 1, until: f.until } : { count: 1, until: now + WINDOW });
}

const cleanEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase().slice(0, 200);
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** Continue with Google: Better Auth gives us Google's URL (and sets the state cookie). */
export async function googleSignIn() {
  if (!googleConfigured()) redirect("/login?error=google_off");
  const res = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/", errorCallbackURL: "/login", disableRedirect: true },
    headers: await headers(),
  });
  if (!res?.url) redirect("/login?error=google_failed");
  redirect(res.url);
}

/** Email + password (only when ALLOW_PASSWORD_LOGIN=true) */
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = cleanEmail(form.get("email"));
  const password = String(form.get("password") ?? "");
  const remember = form.get("remember") === "on";
  if (!looksLikeEmail(email)) return { error: "Type your email first 💌", email };
  if (!password) return { error: "And your password 🔑", email };
  if (!isAllowed(email)) return { error: "This Danchi only opens for its two people 🍑", email };

  const h = await headers();
  const key = clientKey(h, email);
  if (blocked(key)) return { error: "Too many tries. Take a little break and try again later.", email };

  try {
    await auth.api.signInEmail({ body: { email, password, rememberMe: remember }, headers: h });
  } catch {
    fail(key);
    return { error: "Hmm, that email or password doesn't fit this door.", email };
  }
  failures.delete(key);
  redirect("/");
}

/** Step 1 of "email me a code". Same answer whether or not the email exists. */
export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = cleanEmail(form.get("email"));
  if (!looksLikeEmail(email)) return { error: "Type your email first 💌", email };
  const h = await headers();
  const key = clientKey(h, `code:${email}`);
  if (blocked(key)) return { error: "Too many codes. Try again in a bit.", email };
  fail(key); // every send counts towards the limit
  try {
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers: h });
  } catch {
    return { error: "Couldn't send a code right now. Use your password?", email };
  }
  return { codeSent: true, email };
}

/** Step 2: the 6 digit code. */
export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = cleanEmail(form.get("email"));
  const otp = String(form.get("otp") ?? "").replace(/\D/g, "").slice(0, 6);
  if (otp.length !== 6) return { error: "The code has 6 numbers.", codeSent: true, email };
  const h = await headers();
  const key = clientKey(h, email);
  if (blocked(key)) return { error: "Too many tries. Take a little break and try again later.", codeSent: true, email };
  try {
    await auth.api.signInEmailOTP({ body: { email, otp }, headers: h });
  } catch {
    fail(key);
    return { error: "That code didn't work. Check your email again?", codeSent: true, email };
  }
  failures.delete(key);
  redirect("/");
}

export async function logout() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
