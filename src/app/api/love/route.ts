import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { sniffOk, storeFile } from "@/server/files";
import { notify } from "@/server/notify";
import { parseSticker } from "@/lib/stickers";
import { allow } from "@/lib/rate";

const EMOJI = ["💌", "💛", "🌼", "🍑", "🫶", "🧸", "☕", "🌙", "📸"];
const PHOTO = new Set(["image/jpeg", "image/png", "image/webp"]);

/** A love note (or a pap, a photo) from either of them, optionally replying to one. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  if (await isLocked(me)) return NextResponse.json({ error: "Danchi is locked" }, { status: 423 });
  if (!allow(`love:${me.id}`, 40, 60_000)) return NextResponse.json({ error: "Slow down a little 😅 Try again in a minute" }, { status: 429 });
  if (Number(req.headers.get("content-length") || 0) > 9 * 1024 * 1024) return NextResponse.json({ error: "That photo is too big" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Something's missing" }, { status: 400 });

  let replyToId: string | null = null;
  const rt = String(form.get("replyTo") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(rt)) {
    const [r] = await db
      .select({ id: schema.loveNote.id })
      .from(schema.loveNote)
      .where(and(eq(schema.loveNote.id, rt), eq(schema.loveNote.ownerId, me.spaceId)))
      .limit(1);
    replyToId = r?.id ?? null;
  }

  // A sticker: built in ("b:hug") or one they made ("c:<id>")
  const stickerCode = String(form.get("sticker") ?? "");
  if (stickerCode) {
    const p = parseSticker(stickerCode);
    if (!p) return NextResponse.json({ error: "Unknown sticker" }, { status: 400 });
    if (p.type === "c") {
      const [st] = await db
        .select({ id: schema.loveSticker.id })
        .from(schema.loveSticker)
        .where(and(eq(schema.loveSticker.id, p.id), eq(schema.loveSticker.ownerId, me.spaceId)))
        .limit(1);
      if (!st) return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
    const [note] = await db.insert(schema.loveNote).values({ ownerId: me.spaceId, fromUserId: me.id, text: stickerCode, emoji: "✨", kind: "sticker", replyToId }).returning();
    await notify(db, {
      ownerId: me.spaceId,
      kind: "love",
      audience: me.role === "owner" ? "viewer" : "owner",
      inbox: false,
      title: `✨ ${me.name} sent you a sticker`,
      body: p.type === "b" ? p.s.label : "A little sticker 💛",
      url: "/love",
    }).catch(() => {});
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, id: note.id });
  }

  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  const text = String(form.get("text") ?? "").trim().slice(0, 500);
  if (!text && !hasPhoto) return NextResponse.json({ error: "Write something sweet first" }, { status: 400 });
  const e = String(form.get("emoji") ?? "");
  const emoji = EMOJI.includes(e) ? e : hasPhoto ? "📸" : "💌";

  let buf: Buffer | null = null;
  let mime = "image/jpeg";
  if (hasPhoto) {
    mime = (photo as File).type;
    if (!PHOTO.has(mime)) return NextResponse.json({ error: "Photos only (JPG, PNG, WEBP)" }, { status: 415 });
    buf = Buffer.from(await (photo as File).arrayBuffer());
    if (buf.length > 8 * 1024 * 1024 || !sniffOk(mime, buf)) return NextResponse.json({ error: "That doesn't look like a photo" }, { status: 415 });
  }

  const [note] = await db
    .insert(schema.loveNote)
    .values({ ownerId: me.spaceId, fromUserId: me.id, text: text || "📸", emoji, kind: hasPhoto ? "pap" : "note", replyToId })
    .returning();
  if (buf) {
    const storedName = await storeFile(buf, mime);
    await db.insert(schema.file).values({ ownerId: me.spaceId, refType: "love", refId: note.id, name: "pap.jpg", mime, size: buf.length, storedName });
  }

  await notify(db, {
    ownerId: me.spaceId,
    kind: "love",
    audience: me.role === "owner" ? "viewer" : "owner",
    inbox: false,
    title: hasPhoto ? `📸 ${me.name} sent you a pap` : replyToId ? `${emoji} ${me.name} replied to you` : `${emoji} ${me.name} left you a note`,
    body: text || "Open Danchi to see it 💛",
    url: "/love",
  }).catch(() => {});
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, id: note.id });
}
