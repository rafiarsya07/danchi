import { NextResponse } from "next/server";
import { db } from "@/db";
import { endSos } from "@/server/sos";
import { sosOwner } from "../guard";

export async function POST(req: Request) {
  const g = await sosOwner();
  if (g.error) return g.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  return NextResponse.json({ ok: await endSos(db, g.me.spaceId, id) });
}
