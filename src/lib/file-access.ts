import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { canSee, type SectionKey } from "@/lib/privacy";
import type { Me } from "@/lib/session";
import type { FileRefType } from "@/lib/papers";

const SECTION: Record<FileRefType, SectionKey> = { paper: "papers", note: "notes", course: "study", project: "projects", item: "stuff", learning: "learn" };

/** Does the thing a file hangs off exist in this space, and may this person see it? */
export async function canUseRef(me: Me, refType: FileRefType, refId: string, write = false): Promise<boolean> {
  if (write && me.role !== "owner") return false;
  const S = schema;
  const t = { paper: S.paper, note: S.note, course: S.course, project: S.project, item: S.item, learning: S.learning }[refType];
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, refId), eq(t.ownerId, me.spaceId)))
    .limit(1);
  if (!row) return false;
  if (me.role === "owner") return true;
  if (refType === "note") {
    const n = row as typeof S.note.$inferSelect;
    if (n.private) return false;
    return canSee(me, n.kind === "journal" ? "journal" : "notes");
  }
  return canSee(me, SECTION[refType]);
}
