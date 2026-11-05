/**
 * Set a new password for one of the two accounts.
 *   npm run password -- owner
 *   npm run password -- viewer
 * Signs that account out everywhere.
 */
import { createInterface } from "node:readline/promises";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, schema, sql } from "./db";

async function main() {
  const who = process.argv[2];
  if (who !== "owner" && who !== "viewer") {
    console.error("Usage: npm run password -- owner   (or viewer)");
    process.exit(1);
  }
  const email = (who === "owner" ? process.env.DANCHI_OWNER_EMAIL : process.env.DANCHI_VIEWER_EMAIL)?.trim().toLowerCase();
  if (!email) throw new Error("Email for that account is missing in .env");

  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!u) throw new Error("Account not found. Run `npm run seed` first.");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pw = (await rl.question(`New password for ${email}: `)).trim();
  rl.close();
  if (pw.length < 8) throw new Error("Use at least 8 characters.");

  await db
    .update(schema.account)
    .set({ password: await hashPassword(pw), updatedAt: new Date() })
    .where(and(eq(schema.account.userId, u.id), eq(schema.account.providerId, "credential")));
  await db.delete(schema.session).where(eq(schema.session.userId, u.id));
  console.log("Password updated. That account was signed out everywhere.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await sql.end();
  process.exit(1);
});
