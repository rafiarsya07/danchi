import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

export type Me = {
  id: string;
  name: string;
  role: "owner" | "viewer";
  /** The id that owns every row we read or write. For a viewer this is the owner's id. */
  spaceId: string;
  ownerName: string;
  email: string;
  sessionId: string;
  sessionCreatedAt: Date;
};

/** Who is looking at the page. Redirects to /login when signed out. */
export const getMe = cache(async (): Promise<Me> => {
  const me = await currentUser();
  if (!me) redirect("/login");
  return me;
});

/** Same as getMe, but null instead of a redirect (for Route Handlers). */
export const currentUser = cache(async (): Promise<Me | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;

  const role = (s.user as { role?: string }).role === "owner" ? "owner" : "viewer";
  const base = { id: s.user.id, name: s.user.name, email: s.user.email, sessionId: s.session.id, sessionCreatedAt: new Date(s.session.createdAt) };
  if (role === "owner") {
    return { ...base, role, spaceId: s.user.id, ownerName: s.user.name };
  }

  const [owner] = await db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.role, "owner"))
    .limit(1);
  if (!owner) return null;

  return { ...base, role, spaceId: owner.id, ownerName: owner.name };
});

/** Use at the top of every Server Action that changes data. */
export async function requireOwner(): Promise<Me> {
  const me = await getMe();
  if (me.role !== "owner") {
    throw new Error("View only account. Changes are not allowed.");
  }
  return me;
}

/** The Danchi space a signed-in user belongs to (their own id for the owner). */
export async function spaceIdFor(u: { id: string; role?: unknown }): Promise<string> {
  if ((u as { role?: string }).role === "owner") return u.id;
  const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.role, "owner")).limit(1);
  return owner?.id ?? u.id;
}
