import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { isLocked } from "@/lib/lock";
import { canUseRef } from "@/lib/file-access";
import type { FileRefType } from "@/lib/papers";
import { readStored } from "@/server/files";

const INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/** Serve a private file, only to someone allowed to see what it's attached to. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new NextResponse("Please sign in", { status: 401 });
  if (await isLocked(me)) return new NextResponse("Danchi is locked", { status: 423 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, id), eq(schema.file.ownerId, me.spaceId)))
    .limit(1);
  if (!f || !(await canUseRef(me, f.refType as FileRefType, f.refId))) return new NextResponse("Not found", { status: 404 });

  const buf = await readStored(f.storedName).catch(() => null);
  if (!buf) return new NextResponse("File missing", { status: 404 });
  const download = new URL(req.url).searchParams.has("download") || !INLINE.has(f.mime);
  const ascii = f.name.replace(/[^\x20-\x7e]/g, "_");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": f.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
