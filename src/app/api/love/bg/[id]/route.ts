import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { currentUser } from "@/lib/session";
import { readStored } from "@/server/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return new Response("Signed out", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, id), eq(schema.file.refType, "chatbg"), eq(schema.file.ownerId, me.spaceId)))
    .limit(1);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await readStored(f.storedName)), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=604800, immutable", "x-content-type-options": "nosniff" },
  });
}
