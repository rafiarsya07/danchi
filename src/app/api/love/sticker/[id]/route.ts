import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { readStored } from "@/server/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new Response("Signed out", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ stored: schema.file.storedName, mime: schema.file.mime })
    .from(schema.loveSticker)
    .innerJoin(schema.file, eq(schema.file.id, schema.loveSticker.fileId))
    .where(and(eq(schema.loveSticker.id, id), eq(schema.loveSticker.ownerId, me.spaceId)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const buf = await readStored(row.stored);
  return new Response(new Uint8Array(buf), { headers: { "content-type": row.mime, "cache-control": "private, max-age=604800, immutable", "x-content-type-options": "nosniff" } });
}
