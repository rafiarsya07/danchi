import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUser } from "@/lib/session";
import { redirectUri, SPOTIFY_SCOPES, spotifyReady } from "@/server/spotify";

/** Send Rafi (or Adis) to Spotify to connect once. */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.redirect(new URL("/login", redirectUri()));
  if (!spotifyReady()) return NextResponse.redirect(new URL("/music?spotify=missing", redirectUri()));
  const state = randomBytes(16).toString("hex");
  const url = new URL(`${process.env.SPOTIFY_ACCOUNTS_BASE || "https://accounts.spotify.com"}/authorize`);
  url.search = new URLSearchParams({ client_id: process.env.SPOTIFY_CLIENT_ID!, response_type: "code", redirect_uri: redirectUri(), scope: SPOTIFY_SCOPES, state }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("danchi_sp_state", state, { httpOnly: true, sameSite: "lax", secure: redirectUri().startsWith("https"), path: "/api/spotify", maxAge: 600 });
  return res;
}
