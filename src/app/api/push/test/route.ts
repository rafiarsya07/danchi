import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { spaceIdFor } from "@/lib/session";
import { notify } from "@/server/notify";
import { pushConfigured } from "@/server/push";
import { mailConfigured, mailLayout } from "@/server/mail";

/**
 * "Send me a test": push to the person who pressed it (+ email to owner if asked).
 * `delay` (seconds, max 30) sends it a bit later, so you can lock the phone and
 * hear the real notification sound. Tests always ring, even in quiet hours.
 */
export async function POST(req: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const { email, delay } = ((await req.json().catch(() => ({}))) ?? {}) as { email?: boolean; delay?: number };
  const spaceId = await spaceIdFor(s.user);
  const isOwner = (s.user as { role?: string }).role === "owner";
  const wait = Math.min(30, Math.max(0, Math.round(Number(delay) || 0)));

  const send = () =>
    notify(db, {
      ownerId: spaceId,
      kind: "reminder",
      title: wait ? "⏰ Ding! Test ping from Chichi" : "Hi from Chichi! 🌼",
      body: wait ? "If you heard this, reminders will ring too 🍑" : "Notifications are working. I'll remind you of everything 🍑",
      url: "/settings",
      pushUserIds: [s.user.id],
      inbox: false,
      urgent: true,
      email:
        email && isOwner
          ? {
              subject: "Hi from Chichi! 🌼",
              text: "Email reminders are working. I'll remind you of everything!",
              html: mailLayout({ mood: "love", title: "Email works!", intro: "I'll remind you of everything, promise 🍑", cta: { label: "Open Danchi", path: "/" } }),
            }
          : null,
    });

  if (wait && !email) {
    // Danchi runs as a long lived server on the mini PC, so a timer is fine here.
    setTimeout(() => void send().catch((e) => console.error("[push test]", e)), wait * 1000);
    return NextResponse.json({ pushed: 0, mailed: false, scheduled: true, pushReady: pushConfigured(), mailReady: mailConfigured() });
  }
  const res = await send();
  return NextResponse.json({ ...res, pushReady: pushConfigured(), mailReady: mailConfigured() });
}
