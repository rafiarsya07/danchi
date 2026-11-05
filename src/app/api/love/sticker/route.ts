import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { sniffOk, storeFile } from "@/server/files";
import { allow } from "@/lib/rate";

/** Save a sticker they made from a photo (already cropped + captioned on the phone). */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  if (await isLocked(me)) return NextResponse.json({ error: "Danchi is locked" }, { status: 423 });
  if (!allow(`sticker:${me.id}`, 10, 60_000)) return NextResponse.json({ error: "Slow down a little 😅" }, { status: 429 });
  if (Number(req.headers.get("content-length") || 0) > 3 * 1024 * 1024) return NextResponse.json({ error: "Too big" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!(f instanceof File)) return NextResponse.json({ error: "Pick a photo first" }, { status: 400 });
  const mime = f.type === "image/png" ? "image/png" : "image/jpeg";
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024 || !sniffOk(mime, buf)) return NextResponse.json({ error: "That doesn't look like a photo" }, { status: 415 });
  const [{ n }] = await db.select({ n: count() }).from(schema.loveSticker).where(eq(schema.loveSticker.ownerId, me.spaceId));
  if (n >= 200) return NextResponse.json({ error: "That's a lot of stickers! Delete some first" }, { status: 400 });
  const storedName = await storeFile(buf, mime);
  const [file] = await db
    .insert(schema.file)
    .values({ ownerId: me.spaceId, refType: "sticker", refId: "00000000-0000-0000-0000-000000000000", name: "sticker", mime, size: buf.length, storedName })
    .returning({ id: schema.file.id });
  const label = String(form?.get("label") ?? "").trim().slice(0, 40) || null;
  const [st] = await db.insert(schema.loveSticker).values({ ownerId: me.spaceId, createdBy: me.id, fileId: file.id, label }).returning();
  revalidatePath("/love");
  return NextResponse.json({ ok: true, id: st.id });
}
