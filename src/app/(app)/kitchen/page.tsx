import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Mascot } from "@/components/mascot";
import { Badge, Empty, Label, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addRecipe, setMeal } from "@/app/(app)/more-actions";
import { getMealWeek, getPantry, getRecipes } from "@/lib/data2";
import { getUsedThisWeek } from "@/lib/data4";
import { addDaysISO, prettyDay, todayISO, dayPhrase } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Kitchen" };

const SLOTS = [
  { k: "breakfast", t: "Breakfast", e: "🥞" },
  { k: "lunch", t: "Lunch", e: "🍱" },
  { k: "dinner", t: "Dinner", e: "🍲" },
];

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "kitchen"))) return <PrivatePage ownerName={me.ownerName} what="Kitchen" />;
  const ro = me.role === "viewer";
  const sp = await searchParams;
  const tab = sp.tab ?? "recipes";
  const [recipes, pantry, used] = await Promise.all([getRecipes(me.spaceId), getPantry(me.spaceId), getUsedThisWeek(me.spaceId)]);
  const week = await getMealWeek(me.spaceId, sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : undefined);
  const today = todayISO();
  const soon = pantry.filter((p) => p.expiresOn && p.expiresOn <= addDaysISO(today, 4)).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  const cookable = recipes.filter((r) => r.need > 0 && r.score >= 0.6);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Kitchen" icon="kitchen" subtitle={`${pantry.length} food items in your stuff`} />
      {used.length > 0 && (
        <section className="flex flex-col gap-1.5 rounded-[22px] border-2 border-ink bg-sun-soft px-3.5 py-2.5">
          <span className="text-sm font-extrabold">🍽️ Used this week</span>
          <div className="flex flex-wrap gap-1.5">
            {used.map((u) => (
              <Link key={u.id} href={`/stuff/${u.id}`} className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold">
                {u.name} ×{u.used}
              </Link>
            ))}
          </div>
        </section>
      )}
      <Tabs
        base="/kitchen"
        current={tab}
        tabs={[
          { key: "recipes", label: "Recipes", icon: "kitchen", count: recipes.length },
          { key: "cook", label: "Cook now", icon: "food", count: cookable.length },
          { key: "plan", label: "Meal plan", icon: "calendar" },
        ]}
      />

      {tab === "recipes" && (
        <>
          {recipes.length === 0 ? (
            <Empty mood="happy" title="No recipes yet" text="Save the ones you love. I'll tell you which ones you can cook with what's in your fridge 🍳" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recipes.map((r) => (
                <Link key={r.id} href={`/kitchen/${r.id}`} className="sticker press flex items-center gap-3 rounded-[24px] bg-white p-3">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-sky-soft text-3xl">{r.emoji}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1 truncate text-[15px] font-extrabold">
                      {r.favorite && "⭐"} {r.title}
                    </span>
                    <span className="text-xs font-bold text-ink-soft">{[r.minutes ? `${r.minutes} min` : null, r.tags].filter(Boolean).join(", ")}</span>
                    {r.need > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
                          <span className="block h-full bg-mint" style={{ width: `${Math.round(r.score * 100)}%` }} />
                        </span>
                        <span className="text-[11px] font-extrabold">
                          {r.have}/{r.need}
                        </span>
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!ro && (
            <Panel tone="bg-sky" title="New recipe" icon="kitchen">
              <ActionForm action={addRecipe} className="flex flex-col gap-2.5">
                <div className="grid grid-cols-[4.5rem_1fr_6rem] gap-2.5">
                  <input name="emoji" defaultValue="🍳" maxLength={8} aria-label="Emoji" className="field px-0 text-center text-2xl" />
                  <input name="title" required maxLength={100} placeholder="Mama's fried rice" className="field" />
                  <input name="minutes" type="number" min={1} placeholder="Min" aria-label="Minutes" className="field" />
                </div>
                <Label text="Ingredients (one per line)">
                  <textarea name="ingredients" rows={5} placeholder={"2 eggs\n1 cup rice\nsoy sauce"} className="field py-3" />
                </Label>
                <Label text="Steps">
                  <textarea name="steps" rows={5} placeholder={"Heat the pan\nScramble the eggs\nAdd rice"} className="field py-3" />
                </Label>
                <input name="tags" maxLength={120} placeholder="Tags, like: quick, cheap, comfort" className="field" />
                <SubmitButton className="self-start">Save recipe</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </>
      )}

      {tab === "cook" && (
        <>
          {soon.length > 0 && (
            <Panel tone="bg-peach-soft" title="Use these first" icon="clock">
              <div className="flex flex-wrap gap-2">
                {soon.map((p) => (
                  <Badge key={p.name} className="bg-white">
                    {p.name}, {dayPhrase(p.expiresOn!)}
                  </Badge>
                ))}
              </div>
            </Panel>
          )}
          {cookable.length === 0 ? (
            <Empty mood="think" title="Nothing fully ready yet" text="Add your food to Stuff and save some recipes, or ask me for ideas!" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {cookable.map((r) => (
                <Link key={r.id} href={`/kitchen/${r.id}`} className="sticker press flex items-center gap-3 rounded-[22px] bg-white p-3">
                  <span className="text-3xl">{r.emoji}</span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-extrabold">{r.title}</span>
                    <span className="truncate text-xs font-bold text-ink-soft">{r.missing.length ? `Missing: ${r.missing.join(", ")}` : "You have everything! 🎉"}</span>
                  </div>
                  <Badge className={r.score === 1 ? "bg-mint" : "bg-sun"}>{Math.round(r.score * 100)}%</Badge>
                </Link>
              ))}
            </div>
          )}
          <Link href={`/ask?go=1&q=${encodeURIComponent("What can I cook with what I have? Use the food expiring soon first. Give me 2 or 3 ideas with full recipes and tell me what I still need to buy.")}`} className="sticker press flex items-center gap-1 rounded-[24px] bg-white py-1 pl-1 pr-4">
            <Mascot mood="think" size={80} animate={false} />
            <span className="font-display flex-1 text-lg font-bold">Ask Chichi for ideas from your fridge</span>
          </Link>
        </>
      )}

      {tab === "plan" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Link href={`/kitchen?tab=plan&week=${addDaysISO(week.start, -7)}`} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
              Last week
            </Link>
            <span className="text-sm font-extrabold">Week of {prettyDay(week.start)}</span>
            <Link href={`/kitchen?tab=plan&week=${addDaysISO(week.start, 7)}`} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
              Next week
            </Link>
          </div>
          <datalist id="recipe-titles">
            {recipes.map((r) => (
              <option key={r.id} value={r.title} />
            ))}
          </datalist>
          <div className="flex flex-col gap-3">
            {week.days.map((d) => (
              <section key={d} className={`sticker flex flex-col gap-2 rounded-[22px] p-3 ${d === today ? "bg-white" : "bg-white"}`}>
                <h2 className="font-display text-base font-bold">{prettyDay(d)}</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SLOTS.map((s) => {
                    const m = week.rows.find((r) => r.day === d && r.slot === s.k);
                    return ro ? (
                      <div key={s.k} className="rounded-xl border-2 border-ink bg-white px-2.5 py-2 text-sm font-bold">
                        {s.e} {m?.text || <span className="text-ink-soft">{s.t}</span>}
                      </div>
                    ) : (
                      <ActionForm key={s.k} action={setMeal} resetOnOk={false} className="flex items-center gap-1.5">
                        <input type="hidden" name="day" value={d} />
                        <input type="hidden" name="slot" value={s.k} />
                        <span className="text-xl" aria-hidden>
                          {s.e}
                        </span>
                        <input name="text" defaultValue={m?.text ?? ""} list="recipe-titles" maxLength={100} placeholder={s.t} aria-label={`${s.t} on ${d}`} className="field h-10 min-w-0 flex-1 text-sm" />
                        <button type="submit" aria-label="Save" className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-mint text-sm font-extrabold">
                          ✓
                        </button>
                      </ActionForm>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
