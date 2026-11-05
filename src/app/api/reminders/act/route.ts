import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { spaceIdFor } from "@/lib/session";
import { nextOccurrence, type Repeat } from "@/lib/time";

const body = z.object({
  id: z.string().uuid(),
  action: z.enum(["done", "snooze"]),
  minutes: z.number().int().min(1).max(24 * 60).optional(),
});

/**
 * "Done" / "Snooze" for a reminder. Called from Chichi Island and straight
 * from the buttons on the phone notification (service worker).
 */
export async function POST(req: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  if ((s.user as { role?: string }).role !== "owner") return NextResponse.json({ error: "view only" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const spaceId = await spaceIdFor(s.user);
  const { id, action, minutes = 10 } = parsed.data;
  const r = schema.reminder;
  const [row] = await db.select().from(r).where(and(eq(r.id, id), eq(r.ownerId, spaceId))).limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "done") {
    if (row.repeat === "none") await db.update(r).set({ done: true }).where(eq(r.id, id));
    else if (row.remindAt > new Date()) {
      // Done early with a repeating one: skip to the next time.
      const next = nextOccurrence(row.remindAt, row.repeat as Repeat, row.remindAt);
      if (next) await db.update(r).set({ remindAt: next }).where(eq(r.id, id));
    }
    if (row.taskId) {
      await db
        .update(schema.task)
        .set({ done: true, doneAt: new Date() })
        .where(and(eq(schema.task.id, row.taskId), eq(schema.task.ownerId, spaceId)));
    }
    return NextResponse.json({ ok: true });
  }

  const at = new Date(Date.now() + minutes * 60_000);
  if (row.repeat === "none") {
    await db.update(r).set({ done: false, remindAt: at }).where(eq(r.id, id));
  } else {
    // Keep the repeating one on schedule; add a one-off nudge.
    await db.insert(r).values({ ownerId: spaceId, title: row.title, note: row.note, remindAt: at, repeat: "none", taskId: row.taskId });
  }
  return NextResponse.json({ ok: true, at: at.toISOString() });
}
