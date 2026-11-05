import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getNames } from "@/server/names";
import { sosByToken } from "@/server/sos";
import { SosLive } from "@/components/sos-live";

export const metadata: Metadata = { title: "SOS live", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The page the SOS SMS links to. Works without signing in; the long secret link is the key. */
export default async function SosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await sosByToken(db, token);
  if (!row) notFound();
  const name = (await getNames(db)).owner;
  return <SosLive token={token} name={name} />;
}
