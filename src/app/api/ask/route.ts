import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getMe } from "@/lib/session";
import { todayISO } from "@/lib/format";
import { zonedToUtc } from "@/lib/time";
import { AI_DAILY_LIMIT, aiConfigured } from "@/server/ai";
import { askChichi, type ChichiEvent } from "@/server/chichi";

export const maxDuration = 120;

const body = z.object({
  message: z.string().trim().max(4000).default(""),
  image: z
    .object({
      mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      data: z.string().max(4_500_000).regex(/^[A-Za-z0-9+/=]+$/),
    })
    .nullish(),
});

function friendly(e: unknown) {
  const msg = String((e as Error)?.message || "");
  if (/api key|authentication|permission|401|403|invalid x-api-key/i.test(msg)) return "Chichi's API key doesn't work. Rafi should check the AI key in .env.";
  if (/credit|billing|balance/i.test(msg)) return "Chichi's AI account is out of credit. Rafi needs to top it up 🍑";
  if (/quota|429|exhausted|rate.?limit|overloaded|529/i.test(msg)) return "Chichi is a bit busy right now. Try again in a minute 🌼";
  return "Oops, Chichi tripped over something. Try again?";
}

/**
 * Streams newline separated JSON events:
 * {type:"status"|"delta"|"action"|"sources"} ... then {type:"done", text, actions, sources, left}
 * or {type:"error", error}.
 */
export async function POST(req: NextRequest) {
  const me = await getMe();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.message && !parsed.data.image)) {
    return NextResponse.json({ error: "Type something first 🍑" }, { status: 400 });
  }
  if (!aiConfigured()) {
    return NextResponse.json({ error: "Chichi's brain isn't plugged in yet. Rafi needs to add an AI key (bash deploy/keys.sh)." }, { status: 503 });
  }

  const m = schema.aiMessage;
  const startOfDay = zonedToUtc(todayISO(), "00:00");
  const [{ n }] = await db
    .select({ n: count() })
    .from(m)
    .where(and(eq(m.userId, me.id), eq(m.role, "user"), gte(m.createdAt, startOfDay)));
  if (n >= AI_DAILY_LIMIT) {
    return NextResponse.json({ error: `Chichi is sleepy 😴 You've used today's ${AI_DAILY_LIMIT} questions. See you tomorrow!` }, { status: 429 });
  }

  const history = (
    await db.select({ role: m.role, text: m.text }).from(m).where(eq(m.userId, me.id)).orderBy(desc(m.createdAt), sql`case when ${m.role} = 'model' then 0 else 1 end`).limit(16)
  )
    .reverse()
    .map((h) => ({ role: h.role === "model" ? ("model" as const) : ("user" as const), text: h.text }));
  while (history.length && history[0].role !== "user") history.shift();

  const askedAt = new Date();
  const { message, image } = parsed.data;
  const said = message || "What do you see in this photo?";
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: ChichiEvent | Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          /* client went away; keep going so the answer is still saved */
        }
      };
      send({ type: "status", text: image ? "Looking at your photo" : "Thinking" });
      try {
        const res = await askChichi(
          { db, spaceId: me.spaceId, ownerName: me.ownerName, speaker: { name: me.name, role: me.role }, history, message: said, image: image ?? null },
          send,
        );
        await db.insert(m).values([
          { ownerId: me.spaceId, userId: me.id, role: "user", text: image ? `📷 ${said}` : said, createdAt: askedAt },
          {
            ownerId: me.spaceId,
            userId: me.id,
            role: "model",
            text: res.text,
            actions: res.actions.length ? res.actions : null,
            sources: res.sources.length ? res.sources : null,
            createdAt: new Date(Math.max(Date.now(), askedAt.getTime() + 1)),
          },
        ]);
        if (res.actions.length) revalidatePath("/", "layout");
        send({ type: "done", text: res.text, actions: res.actions, sources: res.sources, left: AI_DAILY_LIMIT - n - 1, model: res.model });
      } catch (e) {
        console.error("[ask]", e);
        send({ type: "error", error: friendly(e) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    // event-stream + no-transform so compression and the Cloudflare tunnel don't buffer it
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" },
  });
}

/** Clear this person's chat. */
export async function DELETE() {
  const me = await getMe();
  await db.delete(schema.aiMessage).where(eq(schema.aiMessage.userId, me.id));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const me = await getMe();
  const rows = await db
    .select()
    .from(schema.aiMessage)
    .where(eq(schema.aiMessage.userId, me.id))
    .orderBy(desc(schema.aiMessage.createdAt), sql`case when ${schema.aiMessage.role} = 'model' then 0 else 1 end`)
    .limit(60);
  return NextResponse.json(rows.reverse());
}
