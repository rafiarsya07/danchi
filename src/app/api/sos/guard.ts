import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

/** SOS works even when Danchi is PIN locked: being signed in as her is enough. */
export async function sosOwner() {
  const me = await currentUser();
  if (!me) return { error: NextResponse.json({ error: "Please sign in again" }, { status: 401 }) };
  if (me.role !== "owner") return { error: NextResponse.json({ error: "Only she can start an SOS" }, { status: 403 }) };
  return { me };
}

export const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= min && n <= max ? n : null;
};
