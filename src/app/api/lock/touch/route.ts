import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getLock, grantUnlock, isLocked } from "@/lib/lock";

/** Keeps the PIN unlock fresh while she's actually using Danchi. */
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ locked: true }, { status: 401 });
  const lock = await getLock(me.id);
  if (!lock) return NextResponse.json({ locked: false, minutes: 0 });
  if (await isLocked(me)) return NextResponse.json({ locked: true, minutes: lock.lockMinutes });
  await grantUnlock(me, lock.lockMinutes);
  return NextResponse.json({ locked: false, minutes: lock.lockMinutes });
}
