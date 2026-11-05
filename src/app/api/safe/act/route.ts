import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { currentUser } from "@/lib/session";
import { extendTimer, timerSafe } from "@/server/safety";

const body = z.object({ id: z.string().uuid().optional(), action: z.enum(["safe", "later"]) });

/** "I'm safe" / "+15 min" straight from the phone notification. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "signed out" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: "view only" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (parsed.data.action === "safe") await timerSafe(db, me.spaceId);
  else await extendTimer(db, me.spaceId, 15);
  return NextResponse.json({ ok: true });
}
