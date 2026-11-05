import { NextResponse, after } from "next/server";
import { db } from "@/db";
import { alertEveryone, sosNumbers, startSos } from "@/server/sos";
import { phoneReady } from "@/server/phone";
import { num, sosOwner } from "../guard";

export async function POST(req: Request) {
  const g = await sosOwner();
  if (g.error) return g.error;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { row, fresh } = await startSos(db, g.me.spaceId, {
    lat: num(b.lat, -90, 90),
    lng: num(b.lng, -180, 180),
    accuracy: num(b.accuracy, 0, 100000),
    battery: num(b.battery, 0, 100),
  });
  if (fresh) after(() => alertEveryone(db, row).catch((e) => console.error("[sos] alert", e)));
  const numbers = await sosNumbers(db, g.me.spaceId);
  return NextResponse.json({ ok: true, id: row.id, token: row.token, fresh, calling: phoneReady() ? numbers.length : 0 });
}
