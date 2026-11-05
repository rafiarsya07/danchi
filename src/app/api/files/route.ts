import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { canUseRef } from "@/lib/file-access";
import { FILE_REF_TYPES, type FileRefType } from "@/lib/papers";
import { ALLOWED, MAX_FILE_BYTES, sniffOk, storeFile } from "@/server/files";

/** Upload one private file and attach it to a paper, note, course or project. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  if (me.role !== "owner") return NextResponse.json({ error: "View only" }, { status: 403 });
  if (await isLocked(me)) return NextResponse.json({ error: "Danchi is locked" }, { status: 423 });

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: "That file is too big (max 15 MB)" }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  const refType = String(form?.get("refType") ?? "") as FileRefType;
  const refId = String(form?.get("refId") ?? "");
  if (!(f instanceof File) || !FILE_REF_TYPES.includes(refType) || !/^[0-9a-f-]{36}$/i.test(refId)) {
    return NextResponse.json({ error: "Something's missing" }, { status: 400 });
  }
  if (f.size > MAX_FILE_BYTES) return NextResponse.json({ error: "That file is too big (max 15 MB)" }, { status: 413 });
  const mime = f.type || "application/octet-stream";
  if (!ALLOWED[mime]) return NextResponse.json({ error: "PDF, photos, Word, Excel, PowerPoint or text only" }, { status: 415 });
  if (!(await canUseRef(me, refType, refId, true))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = Buffer.from(await f.arrayBuffer());
  if (!sniffOk(mime, buf)) return NextResponse.json({ error: "That file doesn't look like a real " + ALLOWED[mime].toUpperCase() }, { status: 415 });
  const storedName = await storeFile(buf, mime);
  const name = (f.name || "file").replace(/[\\/\r\n"]/g, "_").slice(0, 120);
  const [row] = await db
    .insert(schema.file)
    .values({ ownerId: me.spaceId, refType, refId, name, mime, size: f.size, storedName })
    .returning({ id: schema.file.id });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, id: row.id });
}
