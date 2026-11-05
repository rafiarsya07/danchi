/**
 * Creates (or updates) the only two accounts Danchi will ever have:
 *   owner  -> DANCHI_OWNER_EMAIL  (can change everything)
 *   viewer -> DANCHI_VIEWER_EMAIL (view only)
 *
 * A new account gets a random password that is printed once.
 * Change it any time with:  npm run password -- owner
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, schema, sql } from "./db";

type Role = "owner" | "viewer";

async function upsertUser(role: Role, email: string | undefined, name: string) {
  if (!email) {
    console.error(`Missing ${role === "owner" ? "DANCHI_OWNER_EMAIL" : "DANCHI_VIEWER_EMAIL"} in .env`);
    process.exit(1);
  }
  email = email.trim().toLowerCase();

  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  let userId: string;
  if (existing) {
    userId = existing.id;
    // Keep the name they chose in Settings; only make sure the role is right.
    await db.update(schema.user).set({ role, updatedAt: new Date() }).where(eq(schema.user.id, userId));
  } else {
    userId = randomUUID();
    await db.insert(schema.user).values({ id: userId, email, name, role, emailVerified: true });
  }

  const [acc] = await db
    .select()
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
    .limit(1);

  if (!acc) {
    const temp = randomBytes(9).toString("base64url");
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(temp),
    });
    console.log(`  ${role.padEnd(6)} ${email}  (signs in with Google; backup password: ${temp})`);
  } else {
    console.log(`  ${role.padEnd(6)} ${email}  (password unchanged)`);
  }

  if (role === "owner") {
    await db.insert(schema.settings).values({ ownerId: userId }).onConflictDoNothing();
  }
  return userId;
}

async function main() {
  console.log("Setting up Danchi accounts...");
  await upsertUser("owner", process.env.DANCHI_OWNER_EMAIL, process.env.DANCHI_OWNER_NAME || "Adis");
  await upsertUser("viewer", process.env.DANCHI_VIEWER_EMAIL, process.env.DANCHI_VIEWER_NAME || "Rafi");

  // Make sure there is exactly one owner.
  const owners = await db.select().from(schema.user).where(eq(schema.user.role, "owner"));
  if (owners.length > 1) {
    console.warn("Warning: more than one owner account exists. Check the user table.");
  }
  console.log("Done. Both of you sign in with Google. The backup passwords only work if ALLOW_PASSWORD_LOGIN=true.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
