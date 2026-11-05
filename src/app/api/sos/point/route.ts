import { NextResponse } from "next/server";
import { db } from "@/db";
import { addPoint } from "@/server/sos";
import { num, sosOwner } from "../guard";

export async function POST(req: Request) {
  const g = await sosOwner();
  if (g.error) return g.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const ok = await addPoint(db, g.me.spaceId, id, {
    lat: num(b.lat, -90, 90),
    lng: num(b.lng, -180, 180),
    accuracy: num(b.accuracy, 0, 100000),
    battery: num(b.battery, 0, 100),
  });
  return NextResponse.json({ ok, active: ok });
}
