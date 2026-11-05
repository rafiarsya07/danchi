import type { Metadata } from "next";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Chat, type Msg } from "@/components/chat";
import { CuteIcon } from "@/components/cute-icon";
import { ForgetButton } from "@/components/small-actions";
import { PageTitle } from "@/components/ui";
import { db, schema } from "@/db";
import { getMe } from "@/lib/session";
import { aiConfigured } from "@/server/ai";
import { brainLabel } from "@/server/llm";

export const metadata: Metadata = { title: "Ask Chichi" };

const KIND: Record<string, { emoji: string; label: string; tone: string }> = {
  wish: { emoji: "🎁", label: "Wishes", tone: "bg-pink-soft" },
  goal: { emoji: "🌱", label: "Goals", tone: "bg-mint-soft" },
  date: { emoji: "📅", label: "Dates", tone: "bg-sky-soft" },
  like: { emoji: "💛", label: "Likes", tone: "bg-sun-soft" },
  dislike: { emoji: "🙅‍♀️", label: "Not a fan", tone: "bg-lilac-soft" },
  note: { emoji: "📝", label: "Notes", tone: "bg-peach-soft" },
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string; go?: string }> }) {
  const me = await getMe();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 500);
  const [rows, memories] = await Promise.all([
    db
      .select()
      .from(schema.aiMessage)
      .where(eq(schema.aiMessage.userId, me.id))
      .orderBy(desc(schema.aiMessage.createdAt), sql`case when ${schema.aiMessage.role} = 'model' then 0 else 1 end`)
      .limit(60)
      .then((r) => r.reverse()),
    db.select().from(schema.aiMemory).where(eq(schema.aiMemory.ownerId, me.spaceId)).orderBy(asc(schema.aiMemory.createdAt)),
  ]);
  const initial: Msg[] = rows.map((r) => ({ id: r.id, role: r.role === "model" ? "model" : "user", text: r.text, actions: r.actions, sources: r.sources }));
  const groups = Object.entries(KIND)
    .map(([k, v]) => ({ ...v, k, items: memories.filter((m) => m.kind === k) }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title="Ask Chichi" icon="ask" subtitle="Ask anything: life, uni, recipes, photos" />
        <Chat initial={initial} ready={aiConfigured()} readOnly={me.role === "viewer"} ownerName={me.ownerName} prefill={q} autoSend={sp.go === "1"} brain={brainLabel()} />
      </div>
      <aside className="flex min-w-0 flex-col gap-3 lg:pt-[76px]">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold">
          <CuteIcon name="notes" size={30} /> Chichi remembers
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-2xl border-2 border-ink/40 bg-white/70 px-3 py-3 text-sm font-bold text-ink-soft">
            Tell Chichi what you wish for, love, or want to do someday (&ldquo;I really want a film camera&rdquo;). She&apos;ll remember and bring it up at the right time 🌼
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.k} className={`rounded-[22px] border-[2.5px] border-ink ${g.tone} p-2.5`}>
              <h3 className="px-1 pb-1 text-sm font-extrabold">
                {g.emoji} {g.label}
              </h3>
              <div className="flex flex-col gap-1.5">
                {g.items.map((m) => (
                  <div key={m.id} className="flex items-center gap-1 rounded-xl border-2 border-ink bg-white py-1 pl-2.5 pr-1 text-sm font-bold">
                    <span className="min-w-0 flex-1">{m.text}</span>
                    {me.role === "owner" && <ForgetButton id={m.id} text={m.text} />}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </aside>
    </div>
  );
}
