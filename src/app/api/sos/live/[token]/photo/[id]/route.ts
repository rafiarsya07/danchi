import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readStored } from "@/server/files";
import { sosByToken } from "@/server/sos";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const row = await sosByToken(db, token);
  if (!row || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [f] = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, id), eq(schema.file.refType, "sos"), eq(schema.file.refId, row.id)))
    .limit(1);
  if (!f) return new Response("Not found", { status: 404 });
  const buf = await readStored(f.storedName);
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" },
  });
}
