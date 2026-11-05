import { NextResponse } from "next/server";
import { db } from "@/db";
import { getNames } from "@/server/names";
import { sosByToken, sosDetails } from "@/server/sos";

/** No-login live data for the SOS link (the token is the key). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await sosByToken(db, token);
  if (!row) return NextResponse.json({ error: "This SOS link has expired" }, { status: 404, headers: { "cache-control": "no-store" } });
  const [{ points, photos }, names] = await Promise.all([sosDetails(db, row), getNames(db)]);
  return NextResponse.json(
    {
      name: names.owner,
      status: row.status,
      startedAt: row.createdAt,
      endedAt: row.endedAt,
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      battery: row.battery,
      lastAt: row.lastAt,
      points: points.map((p) => ({ lat: p.lat, lng: p.lng, accuracy: p.accuracy, at: p.at })),
      photos: photos.map((p) => ({ id: p.id, name: p.name, at: p.at })),
      calls: row.calls.map((c) => ({ kind: c.kind, ok: c.ok })),
    },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}
