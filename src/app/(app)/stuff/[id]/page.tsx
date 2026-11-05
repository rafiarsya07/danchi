import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Attachments } from "@/components/attachments";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { deleteItemAndBack, saveItem } from "@/app/(app)/life-actions";
import { ITEM_CATEGORIES, ITEM_CATEGORY_KEYS, ITEM_KINDS, type ItemCategory } from "@/lib/constants";
import { getSettings } from "@/lib/data";
import { getItem } from "@/lib/data4";
import { money, prettyDay } from "@/lib/format";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Item" };

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "stuff"))) return <PrivatePage ownerName={me.ownerName} what="Stuff" />;
  const [data, s] = await Promise.all([getItem(me.spaceId, (await params).id), getSettings(me.spaceId)]);
  if (!data) notFound();
  const { item: it, history, usage, prices } = data;
  const ro = me.role === "viewer";
  const cat = ITEM_CATEGORIES[(it.category in ITEM_CATEGORIES ? it.category : "other") as ItemCategory];
  const cheapest = prices.length ? prices.reduce((a, b) => (b.priceCents < a.priceCents ? b : a)) : null;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title={it.name} icon="stuff" help={false} subtitle={[it.kind ?? cat.label, it.brand].filter(Boolean).join(", ")}>
          {!ro && (
            <ActButton action={deleteItemAndBack.bind(null, it.id)} confirmText={`Delete ${it.name}?`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
              <Icon name="trash" size={18} />
            </ActButton>
          )}
        </PageTitle>

        <section className={`sticker grid grid-cols-3 gap-2 rounded-[26px] p-3 ${cat.bg}`}>
          <Stat label="Have" value={String(it.quantity)} />
          <Stat label="Runs out" value={usage?.daysLeft != null ? (usage.daysLeft === 0 ? "now" : `~${usage.daysLeft}d`) : "?"} />
          <Stat label="Expires" value={it.expiresOn ? prettyDay(it.expiresOn) : "never"} />
        </section>
        <p className="rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-bold">
          {usage
            ? `📈 You use about ${usage.usedPerWeek} a week. ${usage.runsOutOn ? `Next buy around ${prettyDay(usage.runsOutOn)}.` : ""}`
            : "📈 Tap minus every time you use one, and Danchi will learn how fast it goes and when to buy again."}
        </p>

        <Panel title="Photo and files" icon="clip">
          <Attachments spaceId={me.spaceId} refType="item" refId={it.id} canEdit={!ro} />
        </Panel>

        {prices.length > 0 && (
          <Panel title="Prices you paid" icon="coins">
            {cheapest && (
              <p className="rounded-xl bg-mint-soft px-3 py-1.5 text-sm font-extrabold">
                Cheapest: {money(cheapest.priceCents, s.currency)} at {cheapest.store || "somewhere"}
              </p>
            )}
            {prices.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm font-bold">
                <span className="flex-1">{p.store || "Somewhere"}</span>
                <span className="text-xs text-ink-soft">{prettyDay(p.on)}</span>
                <span className="font-extrabold">{money(p.priceCents, s.currency)}</span>
              </div>
            ))}
          </Panel>
        )}

        {history.length > 0 && (
          <Panel title="Used and restocked" icon="clock">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-sm font-bold">
                <span>{h.delta < 0 ? "➖ Used" : "➕ Added"} {Math.abs(h.delta)}</span>
                <span className="ml-auto text-xs text-ink-soft">{prettyWhen(h.at)}</span>
              </div>
            ))}
          </Panel>
        )}
      </div>

      {!ro && (
        <div className="flex min-w-0 flex-col gap-4 lg:pt-[68px]">
          <Panel title="Details" icon="settings">
            <ActionForm action={saveItem} resetOnOk={false} okText="Saved ✓" className="flex flex-col gap-2.5">
              <input type="hidden" name="id" value={it.id} />
              <Label text="Name">
                <input name="name" defaultValue={it.name} required maxLength={80} className="field" />
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <Label text="Category">
                  <select name="category" defaultValue={it.category} className="field px-2">
                    {ITEM_CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {ITEM_CATEGORIES[k].label}
                      </option>
                    ))}
                  </select>
                </Label>
                <Label text="Type">
                  <input name="kind" defaultValue={it.kind ?? ""} list="item-kinds" maxLength={30} placeholder="Skincare" className="field" />
                  <datalist id="item-kinds">
                    {Object.values(ITEM_KINDS)
                      .flat()
                      .map((k) => (
                        <option key={k} value={k} />
                      ))}
                  </datalist>
                </Label>
                <Label text="Brand">
                  <input name="brand" defaultValue={it.brand ?? ""} maxLength={60} className="field" />
                </Label>
                <Label text="Where">
                  <input name="location" defaultValue={it.location ?? ""} maxLength={60} placeholder="Fridge" className="field" />
                </Label>
                <Label text="How many">
                  <input name="quantity" type="number" min={0} defaultValue={it.quantity} className="field" />
                </Label>
                <Label text="Low at">
                  <input name="lowAt" type="number" min={0} defaultValue={it.lowAt} className="field" />
                </Label>
                <Label text="Bought on">
                  <input name="boughtOn" type="date" defaultValue={it.boughtOn ?? ""} className="field px-2" />
                </Label>
                <Label text="Expires">
                  <input name="expiresOn" type="date" defaultValue={it.expiresOn ?? ""} className="field px-2" />
                </Label>
                <Label text={`Price (${s.currency})`}>
                  <input name="price" type="number" step="0.01" min="0" defaultValue={it.priceCents ? (it.priceCents / 100).toFixed(2) : ""} className="field" />
                </Label>
              </div>
              <Label text="Notes">
                <textarea name="notes" defaultValue={it.notes ?? ""} rows={2} maxLength={500} placeholder="Shade, size, where to buy" className="field py-2" />
              </Label>
              <SubmitButton className="self-start bg-sun">Save</SubmitButton>
            </ActionForm>
          </Panel>
          <p className="flex items-center gap-2 text-xs font-bold text-ink-soft">
            <CuteIcon name="shop" size={22} /> When it drops to the low number it jumps onto your shopping list by itself.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-ink bg-white px-2 py-2 text-center">
      <span className="font-display text-xl font-bold leading-tight">{value}</span>
      <span className="text-[11px] font-extrabold text-ink-soft">{label}</span>
    </div>
  );
}
