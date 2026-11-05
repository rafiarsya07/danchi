import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { spaceIdFor } from "@/lib/session";
import { subscribe } from "@/server/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events: every open Danchi screen keeps this open and hears about
 * changes the moment they happen (from any device, Chichi, or the worker).
 */
export async function GET(req: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return new Response("signed out", { status: 401 });
  const spaceId = await spaceIdFor(s.user);

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send(`retry: 3000\nevent: hello\ndata: {}\n\n`);
      const unsub = subscribe(spaceId, (e) => send(`event: change\ndata: ${JSON.stringify({ t: e.t, op: e.op })}\n\n`));
      // Keep Cloudflare and phones from closing an idle stream.
      const ping = setInterval(() => send(`: ping\n\n`), 20_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
