import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq, gt } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { getUnreadCount } from "@/lib/data";
import { spaceIdFor } from "@/lib/session";

/** Polled by the app every ~20s: unread count + anything new since `since`. */
export async function GET(req: NextRequest) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ error: "signed out" }, { status: 401 });
  const spaceId = await spaceIdFor(s.user);
  const sinceRaw = req.nextUrl.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw) : null;

  const [unread, fresh] = await Promise.all([
    getUnreadCount(spaceId),
    since
      ? db
          .select({ id: schema.notification.id, title: schema.notification.title, body: schema.notification.body, url: schema.notification.url, kind: schema.notification.kind, createdAt: schema.notification.createdAt })
          .from(schema.notification)
          .where(and(eq(schema.notification.ownerId, spaceId), gt(schema.notification.createdAt, since)))
          .orderBy(desc(schema.notification.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);
  return NextResponse.json({ unread, fresh, now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
