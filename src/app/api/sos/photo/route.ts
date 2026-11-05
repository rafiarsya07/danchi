import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sniffOk, storeFile } from "@/server/files";
import { sosOwner } from "../guard";

/** A photo from the front or back camera while SOS is on. */
export async function POST(req: Request) {
  const g = await sosOwner();
  if (g.error) return g.error;
  if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024) return NextResponse.json({ error: "too big" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  const id = String(form?.get("id") ?? "");
  const which = String(form?.get("which") ?? "") === "back" ? "back" : "front";
  if (!(f instanceof File) || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "missing" }, { status: 400 });
  const [row] = await db
    .select({ id: schema.sos.id })
    .from(schema.sos)
    .where(and(eq(schema.sos.id, id), eq(schema.sos.ownerId, g.me.spaceId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Her choice: no photos unless she turned the SOS camera on.
  const [st] = await db.select({ on: schema.settings.sosCamera }).from(schema.settings).where(eq(schema.settings.ownerId, g.me.spaceId)).limit(1);
  if (!st?.on) return NextResponse.json({ error: "SOS camera is off" }, { status: 403 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > 6 * 1024 * 1024 || !sniffOk("image/jpeg", buf)) return NextResponse.json({ error: "not a photo" }, { status: 415 });
  const storedName = await storeFile(buf, "image/jpeg");
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  await db.insert(schema.file).values({ ownerId: g.me.spaceId, refType: "sos", refId: id, name: `sos-${which}-${stamp}.jpg`, mime: "image/jpeg", size: buf.length, storedName });
  return NextResponse.json({ ok: true });
}
