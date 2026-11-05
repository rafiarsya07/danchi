/**
 * Danchi's reminder worker. Runs next to the app (PM2: "danchi-worker").
 *   npm run worker
 * Every 30 seconds it sends due reminders, the morning digest and the evening nudge.
 */
import { sql as dsql } from "drizzle-orm";
import { db, sql } from "./db";
import { runDigest, runDueReminders, runNudge, runPinned } from "../src/server/jobs";
import { runSafetyTimers } from "../src/server/safety";
import { runCare } from "../src/server/care";
import { purgeOldSosPhotos } from "../src/server/sos";
import { pushConfigured } from "../src/server/push";
import { mailConfigured } from "../src/server/mail";

const EVERY = 30_000;
const LOCK = 2_604_2026; // any constant; stops two workers from double sending

async function tick() {
  const [{ ok }] = await db.execute<{ ok: boolean }>(dsql`select pg_try_advisory_lock(${LOCK}) as ok`);
  if (!ok) return;
  try {
    const safe = await runSafetyTimers(db);
    const r = await runDueReminders(db);
    const d = await runDigest(db);
    const n = await runNudge(db);
    const p = await runPinned(db);
    const c = await runCare(db);
    const sp = await purgeOldSosPhotos(db);
    if (sp) console.log(new Date().toISOString(), `removed ${sp} old SOS photos`);
    if (safe || r || d || n || p || c) console.log(new Date().toISOString(), `safety:${safe} reminders:${r} digest:${d} nudge:${n} pinned:${p} care:${c}`);
  } finally {
    await db.execute(dsql`select pg_advisory_unlock(${LOCK})`);
  }
}

async function main() {
  console.log(`Danchi worker started. push:${pushConfigured() ? "on" : "OFF (set VAPID keys)"} email:${mailConfigured() ? "on" : "OFF (set SMTP)"}`);
  if (process.argv.includes("--once")) {
    await tick();
    await sql.end();
    return;
  }
  let stopping = false;
  const stop = async () => {
    stopping = true;
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  while (!stopping) {
    try {
      await tick();
    } catch (e) {
      console.error("[worker]", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, EVERY));
  }
}

main();
