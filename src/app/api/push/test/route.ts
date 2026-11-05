import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { spaceIdFor } from "@/lib/session";
import { notify } from "@/server/notify";
import { pushConfigured } from "@/server/push";
import { mailConfigured, mailLayout } from "@/server/mail";

/** "Send me a test": push to the person who pressed it (+ email to owner if asked). */
export async function POST(req: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const { email } = ((await req.json().catch(() => ({}))) ?? {}) as { email?: boolean };
  const spaceId = await spaceIdFor(s.user);
  const isOwner = (s.user as { role?: string }).role === "owner";

  const res = await notify(db, {
    ownerId: spaceId,
    kind: "test",
    title: "Hi from Chichi! 🌼",
    body: "Notifications are working. I'll remind you of everything 🍑",
    url: "/",
    pushUserIds: [s.user.id],
    inbox: false,
    email:
      email && isOwner
        ? {
            subject: "Hi from Chichi! 🌼",
            text: "Email reminders are working. I'll remind you of everything!",
            html: mailLayout({ mood: "love", title: "Email works!", intro: "I'll remind you of everything, promise 🍑", cta: { label: "Open Danchi", path: "/" } }),
          }
        : null,
  });
  return NextResponse.json({ ...res, pushReady: pushConfigured(), mailReady: mailConfigured() });
}
