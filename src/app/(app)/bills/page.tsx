import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { ActButton, ActionForm } from "@/components/action-form";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { Badge, Empty, Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addBill, deleteBill, payBill, toggleBill } from "@/app/(app)/more-actions";
import { MONEY_CATEGORIES, MONEY_CATEGORY_KEYS, type MoneyCategory } from "@/lib/constants";
import { getSettings } from "@/lib/data";
import { getBills } from "@/lib/data2";
import { daysUntil, money, prettyDay, todayISO, dayPhrase } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Bills" };

const CYCLE: Record<string, string> = { weekly: "every week", monthly: "every month", yearly: "every year", once: "one time" };

export default async function BillsPage() {
  const me = await getMe();
  if (!(await canSee(me, "money"))) return <PrivatePage ownerName={me.ownerName} what="Bills" />;
  const ro = me.role === "viewer";
  const [{ rows, monthly }, settings] = await Promise.all([getBills(me.spaceId), getSettings(me.spaceId)]);
  const cur = settings.currency;
  const active = rows.filter((b) => b.active);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Bills" icon="bills" subtitle="Bills and subscriptions, never late again" />

      <section className="sticker flex items-center gap-4 rounded-[26px] bg-white p-4">
        <CuteIcon name="bills" size={56} />
        <div className="flex flex-col">
          <span className="text-xs font-extrabold">Every month, about</span>
          <span className="font-display text-3xl font-bold leading-tight">{money(monthly, cur)}</span>
          <span className="text-xs font-extrabold">{active.length} active</span>
        </div>
      </section>

      {rows.length === 0 ? (
        <Empty mood="remind" title="No bills yet" text="Add rent, phone, Spotify. I'll ping you a couple of days before each one 💸" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((b) => {
            const d = daysUntil(b.nextDue);
            const c = MONEY_CATEGORIES[(b.category in MONEY_CATEGORIES ? b.category : "bills") as MoneyCategory];
            return (
              <div key={b.id} className={`flex items-center gap-3 rounded-[22px] border-[2.5px] border-ink p-3 shadow-[0_3px_0_#2E2240] ${!b.active ? "bg-white/60 opacity-60" : d < 0 ? "bg-pink-soft" : d <= 3 ? "bg-sun-soft" : "bg-white"}`}>
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink ${c.bg}`}>
                  <CuteIcon name={b.kind === "subscription" ? "fun" : c.icon} size={34} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-extrabold">{b.name}</span>
                  <span className="text-xs font-bold text-ink-soft">
                    {money(b.amountCents, cur)} {CYCLE[b.cycle]}
                  </span>
                  {b.active && <span className={`text-xs font-extrabold ${d < 0 ? "text-coral" : ""}`}>{d < 0 ? `Overdue since ${prettyDay(b.nextDue)}` : `Due ${dayPhrase(b.nextDue)}`}</span>}
                </div>
                {!ro && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {b.active && (
                      <ActButton action={payBill.bind(null, b.id)} confirmText={`Mark ${b.name} as paid? It goes into Money too.`} className="h-9 rounded-xl border-2 border-ink bg-mint px-3 text-xs font-extrabold">
                        Paid ✓
                      </ActButton>
                    )}
                    <div className="flex items-center gap-1">
                      <ActButton action={toggleBill.bind(null, b.id)} className="text-[11px] font-extrabold underline">
                        {b.active ? "Pause" : "Resume"}
                      </ActButton>
                      <ActButton action={deleteBill.bind(null, b.id)} confirmText={`Delete ${b.name}?`} label="Delete" className="flex size-7 items-center justify-center text-ink-soft">
                        <Icon name="trash" size={14} />
                      </ActButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!ro && (
        <Panel tone="bg-lilac-soft" title="Add a bill" icon="bills">
          <ActionForm action={addBill} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[1fr_7rem] gap-2.5">
              <input name="name" required maxLength={80} placeholder="Phone bill, Netflix" className="field" />
              <input name="amount" type="number" step="0.01" min="0" required placeholder={cur} aria-label="Amount" className="field" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Label text="Type">
                <select name="kind" className="field px-2">
                  <option value="bill">Bill</option>
                  <option value="subscription">Subscription</option>
                </select>
              </Label>
              <Label text="Repeats">
                <select name="cycle" defaultValue="monthly" className="field px-2">
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="weekly">Weekly</option>
                  <option value="once">Just once</option>
                </select>
              </Label>
              <Label text="Next due">
                <input name="nextDue" type="date" required defaultValue={todayISO()} className="field px-2" />
              </Label>
              <Label text="Remind me">
                <select name="remindDaysBefore" defaultValue="2" className="field px-2">
                  <option value="0">On the day</option>
                  <option value="1">1 day before</option>
                  <option value="2">2 days before</option>
                  <option value="3">3 days before</option>
                  <option value="7">A week before</option>
                </select>
              </Label>
            </div>
            <Label text="Category in Money">
              <select name="category" defaultValue="bills" className="field px-2">
                {MONEY_CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {MONEY_CATEGORIES[k].label}
                  </option>
                ))}
              </select>
            </Label>
            <SubmitButton className="self-start">Add bill</SubmitButton>
          </ActionForm>
        </Panel>
      )}
      <p className="text-center text-xs font-bold text-ink-soft">
        <Badge className="bg-white">Tip</Badge> Pressing Paid saves it in Money and moves the bill to next time.
      </p>
    </div>
  );
}
