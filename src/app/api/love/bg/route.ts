import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { removeStored, sniffOk, storeFile } from "@/server/files";
import { CHAT_BGS } from "@/lib/chat-bg";

/** Set my chat wallpaper: a preset (JSON {preset}) or my own photo (multipart "photo"). */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  if (await isLocked(me)) return NextResponse.json({ error: "Danchi is locked" }, { status: 423 });

  let code: string;
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const b = (await req.json().catch(() => ({}))) as { preset?: string };
    if (!CHAT_BGS.some((p) => p.id === b.preset)) return NextResponse.json({ error: "Unknown wallpaper" }, { status: 400 });
    code = `p:${b.preset}`;
  } else {
    if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024) return NextResponse.json({ error: "That photo is too big" }, { status: 413 });
    const form = await req.formData().catch(() => null);
    const f = form?.get("photo");
    if (!(f instanceof File) || f.type !== "image/jpeg") return NextResponse.json({ error: "Pick a photo" }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024 || !sniffOk("image/jpeg", buf)) return NextResponse.json({ error: "That doesn't look like a photo" }, { status: 415 });
    const storedName = await storeFile(buf, "image/jpeg");
    const [row] = await db
      .insert(schema.file)
      .values({ ownerId: me.spaceId, refType: "chatbg", refId: crypto.randomUUID(), name: `wallpaper-${me.id}.jpg`, mime: "image/jpeg", size: buf.length, storedName })
      .returning({ id: schema.file.id });
    code = `f:${row.id}`;
  }

  // forget my old photo wallpaper
  const [old] = await db.select().from(schema.chatPref).where(eq(schema.chatPref.userId, me.id)).limit(1);
  if (old?.bg.startsWith("f:")) {
    const [f] = await db
      .delete(schema.file)
      .where(and(eq(schema.file.id, old.bg.slice(2)), eq(schema.file.refType, "chatbg"), eq(schema.file.ownerId, me.spaceId)))
      .returning({ storedName: schema.file.storedName });
    if (f) await removeStored(f.storedName);
  }
  await db
    .insert(schema.chatPref)
    .values({ userId: me.id, bg: code })
    .onConflictDoUpdate({ target: schema.chatPref.userId, set: { bg: code, updatedAt: new Date() } });
  return NextResponse.json({ ok: true, bg: code });
}
