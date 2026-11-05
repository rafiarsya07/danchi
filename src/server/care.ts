/** Daily gentle care: the cycle heads up. Runs from the worker. */
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { notify } from "./notify";
import { getNames } from "./names";
import { cycleStats } from "../lib/cycle";
import { todayISO, prettyDay } from "../lib/format";
import { localParts } from "../lib/time";

export async function runCare(db: Db, now = new Date()) {
  if (localParts(now).hour < 9) return 0;
  const today = todayISO(now);
  const all = await db.select().from(schema.settings);
  let n = 0;
  for (const s of all) {
    if (s.lastCycleNoticeOn === today) continue;
    await db.update(schema.settings).set({ lastCycleNoticeOn: today }).where(eq(schema.settings.ownerId, s.ownerId));
    const logs = await db
      .select({ startOn: schema.cycleLog.startOn, endOn: schema.cycleLog.endOn })
      .from(schema.cycleLog)
      .where(eq(schema.cycleLog.ownerId, s.ownerId));
    const st = cycleStats(logs, today);
    if (!st.nextStart || st.daysToNext !== 2) continue;
    await notify(db, {
      ownerId: s.ownerId,
      kind: "cycle",
      audience: "owner",
      inbox: false,
      title: "🌸 Heads up from Chichi",
      body: `Your period might start around ${prettyDay(st.nextStart)}. Maybe pack a pad and keep some chocolate close 🍫`,
      url: "/cycle",
    });
    if (s.cycleTellRafi) {
      await notify(db, {
        ownerId: s.ownerId,
        kind: "cycle",
        audience: "viewer",
        inbox: false,
        title: "🍫 A little heads up from Danchi",
        body: `${(await getNames(db)).owner} might want some extra care this week. Snacks, warm drinks and patience are a good idea 💛`,
        url: "/",
      });
    }
    n++;
  }
  return n;
}
