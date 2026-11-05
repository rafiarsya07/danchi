import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { todayISO } from "@/lib/format";

/** Her data is hers: everything in one JSON file. Owner only. */
export async function GET() {
  const me = await currentUser();
  if (!me) return new NextResponse("Please sign in", { status: 401 });
  if (me.role !== "owner") return new NextResponse("Only the owner can export", { status: 403 });
  if (await isLocked(me)) return new NextResponse("Danchi is locked", { status: 423 });
  const S = schema;
  const tables = {
    settings: S.settings,
    tasks: S.task,
    reminders: S.reminder,
    items: S.item,
    shopping: S.shoppingItem,
    money: S.transaction,
    debts: S.debt,
    bills: S.bill,
    wishes: S.wish,
    projects: S.project,
    courses: S.course,
    assignments: S.assignment,
    exams: S.exam,
    decks: S.deck,
    cards: S.card,
    notes: S.note,
    habits: S.habit,
    habitLog: S.habitLog,
    recipes: S.recipe,
    mealPlan: S.mealPlan,
    papers: S.paper,
    files: S.file,
    moods: S.moodLog,
    cycle: S.cycleLog,
    loveNotes: S.loveNote,
    checkins: S.checkin,
    chichiMemory: S.aiMemory,
  } as const;
  const out: Record<string, unknown> = { app: "Danchi", exportedAt: new Date().toISOString(), owner: me.name };
  for (const [k, t] of Object.entries(tables)) {
    out[k] = await db.select().from(t).where(eq(t.ownerId, me.spaceId));
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="danchi-${todayISO()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
