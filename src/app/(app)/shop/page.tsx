import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AddShopForm } from "@/components/add-forms";
import { PrivatePage } from "@/components/private-page";
import { ShopRow } from "@/components/small-actions";
import { Empty, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { setShopBudget } from "@/app/(app)/life-actions";
import { SHOP_PRIORITIES, type ShopPriority } from "@/lib/constants";
import { getSettings, getShopping } from "@/lib/data";
import { getPrices, getRestockSoon, getShopHistory, getShopMonth } from "@/lib/data4";
import { money, prettyDay } from "@/lib/format";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Shopping" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ new?: string; tab?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "stuff"))) return <PrivatePage ownerName={me.ownerName} what="Shopping" />;
  const readOnly = me.role === "viewer";
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : sp.tab === "prices" ? "prices" : "list";
  const [{ open }, s, spent, soon] = await Promise.all([getShopping(me.spaceId), getSettings(me.spaceId), getShopMonth(me.spaceId), getRestockSoon(me.spaceId)]);
  const budget = s.shopBudgetCents;
  const order = { urgent: 0, need: 1, maybe: 2 } as Record<string, number>;
  const sorted = [...open].sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Shopping" icon="shop" subtitle="What to buy, what you paid, where it's cheapest">
        <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold">{open.length}</span>
      </PageTitle>
      <Tabs
        base="/shop"
        current={tab}
        tabs={[
          { key: "list", label: "To buy", icon: "shop", count: open.length || undefined },
          { key: "history", label: "History", icon: "clock" },
          { key: "prices", label: "Prices", icon: "coins" },
        ]}
      />

      {/* Shopping budget this month */}
      <section className="sticker flex flex-col gap-2 rounded-[24px] bg-white p-3.5">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <span className="flex-1">🛍️ Shopping this month: {money(spent, s.currency)}</span>
          {budget > 0 && <span className={spent > budget ? "text-coral" : ""}>of {money(budget, s.currency)}</span>}
        </div>
        {budget > 0 && (
          <div className="flex h-3.5 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div className={spent > budget ? "bg-coral" : "bg-mint"} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
          </div>
        )}
        {!readOnly && (
          <details>
            <summary className="cursor-pointer text-xs font-extrabold underline">{budget ? "Change shopping budget" : "Set a monthly shopping budget"}</summary>
            <ActionForm action={setShopBudget} okText="Saved" className="mt-2 flex gap-2">
              <input name="amount" type="number" step="1" min="0" defaultValue={budget ? budget / 100 : ""} placeholder={s.currency} className="field h-11" />
              <SubmitButton className="h-11 shrink-0 px-4 text-base">Save</SubmitButton>
            </ActionForm>
          </details>
        )}
      </section>

      {tab === "list" && (
        <>
          {!readOnly && <AddShopForm autoFocus={sp.new === "1"} />}
          {soon.length > 0 && (
            <Panel title="Buy soon (running out)" icon="clock" tone="bg-sun-soft">
              {soon.map((i) => (
                <Link key={i.id} href={`/stuff/${i.id}`} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="text-xs text-ink-soft">{i.u?.daysLeft === 0 ? "about out now" : `~${i.u?.daysLeft} days left`}</span>
                </Link>
              ))}
            </Panel>
          )}
          {sorted.length === 0 ? (
            <Empty mood="cheer" title="Nothing to buy!" text="When something runs low, I'll add it here for you 🛍️" />
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((x) => {
                const p = SHOP_PRIORITIES[(x.priority in SHOP_PRIORITIES ? x.priority : "need") as ShopPriority];
                return <ShopRow key={x.id} id={x.id} name={x.name} done={false} linked={!!x.itemId} badge={{ text: p.label, cls: p.cls }} readOnly={readOnly} />;
              })}
              {!readOnly && <p className="text-xs font-bold text-ink-soft">Tip: tap 💰 Paid to save the price and store. It logs the spending and builds your price list.</p>}
            </div>
          )}
        </>
      )}

      {tab === "history" && <History spaceId={me.spaceId} currency={s.currency} />}
      {tab === "prices" && <Prices spaceId={me.spaceId} currency={s.currency} />}
    </div>
  );
}

async function History({ spaceId, currency }: { spaceId: string; currency: string }) {
  const rows = await getShopHistory(spaceId);
  if (!rows.length) return <Empty mood="think" title="Nothing bought yet" text="Ticked items show up here with what you paid." />;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{r.name}</span>
          {r.store && <span className="text-xs font-bold text-ink-soft">{r.store}</span>}
          {r.priceCents ? <span className="text-sm font-extrabold">{money(r.priceCents, currency)}</span> : null}
          <span className="text-xs font-bold text-ink-soft">{r.boughtAt ? prettyWhen(r.boughtAt) : ""}</span>
        </div>
      ))}
    </div>
  );
}

async function Prices({ spaceId, currency }: { spaceId: string; currency: string }) {
  const list = await getPrices(spaceId);
  if (!list.length)
    return <Empty mood="think" title="No prices yet" text="When you tick something with 💰 Paid, Danchi remembers the price and store, and shows you where it's cheapest." />;
  return (
    <div className="flex flex-col gap-2">
      {list.map((p) => (
        <div key={p.name} className="sticker-sm flex flex-col gap-1 rounded-2xl bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold capitalize">{p.name}</span>
            <span className="rounded-full border-2 border-ink bg-mint px-2 py-0.5 text-xs font-extrabold">
              Best {money(p.cheapest.cents, currency)} at {p.cheapest.store}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs font-bold text-ink-soft">
            {p.stores.map(([store, c]) => (
              <span key={store}>
                {store} {money(c, currency)}
              </span>
            ))}
            <span>, last bought {prettyDay(p.latest.on)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
