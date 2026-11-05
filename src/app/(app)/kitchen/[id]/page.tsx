import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Badge, PageTitle, Panel } from "@/components/ui";
import { deleteRecipe, shopMissing, toggleFavorite } from "@/app/(app)/more-actions";
import { getRecipe } from "@/lib/data2";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Recipe" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "kitchen"))) return <PrivatePage ownerName={me.ownerName} what="Kitchen" />;
  const ro = me.role === "viewer";
  const data = await getRecipe(me.spaceId, (await params).id);
  if (!data) notFound();
  const { recipe: r, lines } = data;
  const missing = lines.filter((l) => !l.have).length;
  const steps = r.steps.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title={`${r.emoji} ${r.title}`} subtitle={[r.minutes ? `${r.minutes} minutes` : null, r.tags].filter(Boolean).join(", ") || "Recipe"}>
        {!ro && (
          <>
            <ActButton action={toggleFavorite.bind(null, r.id)} label="Favorite" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white text-xl">
              {r.favorite ? "⭐" : "☆"}
            </ActButton>
            <ActButton action={deleteRecipe.bind(null, r.id)} confirmText={`Delete ${r.title}?`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
              <Icon name="trash" size={18} />
            </ActButton>
          </>
        )}
      </PageTitle>

      <Panel title="Ingredients" icon="food" tone="bg-sun-soft" right={<Badge className={missing ? "bg-white" : "bg-mint"}>{missing ? `${lines.length - missing}/${lines.length} at home` : "All at home!"}</Badge>}>
        <ul className="flex flex-col gap-1.5">
          {lines.map((l, i) => (
            <li key={i} className={`flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2 text-[15px] font-bold ${l.have ? "bg-mint-soft" : "bg-white"}`}>
              <span aria-hidden>{l.have ? "✅" : "🛒"}</span>
              <span className="flex-1">{l.line}</span>
              <span className="text-xs font-extrabold text-ink-soft">{l.have ? "have it" : "need"}</span>
            </li>
          ))}
        </ul>
        {!ro && missing > 0 && (
          <div className="flex items-center gap-2">
            <ActButton action={shopMissing.bind(null, r.id)} done="Added {n} to your shopping list 🛍️" className="sticker-sm press h-11 rounded-2xl bg-peach px-4 text-sm font-extrabold">
              🛒 Add missing to shopping
            </ActButton>
          </div>
        )}
      </Panel>

      {steps.length > 0 && (
        <Panel title="Steps" icon="kitchen">
          <ol className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px] font-bold leading-snug">
                <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun text-sm">{i + 1}</span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
