import Link from "next/link";
import { AskChichiLink } from "@/components/ask-chichi-link";
import { getNotes } from "@/lib/data2";
import { addNote } from "@/app/(app)/more-actions";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { CuteIcon } from "@/components/cute-icon";
import { BudgetForm } from "@/components/add-forms";
import { QuickExpense } from "@/components/quick-expense";
import { DeleteTxButton } from "@/components/small-actions";
import { Empty, PageTitle, Panel, Ring, SubmitButton } from "@/components/ui";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { addDebt, deleteDebt, settleDebt } from "@/app/(app)/papers-actions";
import { getDebts, getMoneyTrend } from "@/lib/data3";
import { getSavings } from "@/lib/data4";
import { addGoal, addToGoal, deleteGoal } from "@/app/(app)/life-actions";
import { MONEY_CATEGORIES, MONEY_CATEGORY_KEYS, type MoneyCategory } from "@/lib/constants";
import { getMonthMoney, getSettings } from "@/lib/data";
import { money, prettyDay } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Money" };

function catOf(k: string) {
  return MONEY_CATEGORIES[(k in MONEY_CATEGORIES ? k : "other") as MoneyCategory];
}

export default async function MoneyPage() {
  const me = await getMe();
  if (!(await canSee(me, "money"))) return <PrivatePage ownerName={me.ownerName} what="Money" />;
  const readOnly = me.role === "viewer";
  const [month, settings, trend, debts, goals, moneyNotes] = await Promise.all([
    getMonthMoney(me.spaceId),
    getSettings(me.spaceId),
    getMoneyTrend(me.spaceId),
    getDebts(me.spaceId),
    getSavings(me.spaceId),
    getNotes(me.spaceId, "note", "money", me.role === "viewer"),
  ]);
  const peak = Math.max(1, ...trend.map((t) => Math.max(t.spent, t.earned)));
  const budget = settings.monthlyBudgetCents;
  const left = budget - month.spent;
  const pct = budget > 0 ? Math.round((month.spent / budget) * 100) : 0;
  const cats = MONEY_CATEGORY_KEYS.filter((k) => month.byCategory[k]);

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title="Money" icon="money">
          <span className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[13px] font-extrabold">{month.label}</span>
        </PageTitle>

        <section className="sticker flex items-center gap-4 rounded-[26px] bg-white p-4">
          <Ring value={month.spent} max={budget} size={100} track="#FFE0EC" fill={pct > 100 ? "#FF7A6B" : "#7C5CFF"}>
            <span className="font-display text-[22px] font-bold">{pct}%</span>
          </Ring>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="font-display text-[32px] font-bold leading-none">{money(month.spent, settings.currency)}</span>
            <span className={`self-start rounded-full border-2 border-ink px-2.5 py-0.5 text-[13px] font-extrabold ${left < 0 ? "bg-coral text-white" : "bg-white"}`}>
              {left >= 0 ? `${money(left, settings.currency)} left` : `${money(-left, settings.currency)} over`}
            </span>
            {readOnly ? (
              <span className="text-[13px] font-extrabold">of {money(budget, settings.currency)}</span>
            ) : (
              <BudgetForm current={budget} />
            )}
          </div>
        </section>
        {!readOnly && (
          <AskChichiLink q="Look at my spending this month and my bills, savings goals and debts. Give me 3 realistic, specific tips to save money this month." label="How can I save more this month?" hint="Chichi reads your spending and gives 3 real tips" />
        )}

        {cats.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <div aria-hidden className="flex h-[18px] overflow-hidden rounded-full border-2 border-ink">
              {cats.map((k, i) => (
                <div
                  key={k}
                  style={{ width: `${(month.byCategory[k] / month.spent) * 100}%`, background: catOf(k).hex }}
                  className={i < cats.length - 1 ? "border-r-2 border-ink" : ""}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {cats.map((k) => (
                <div key={k} className="flex items-center gap-1.5 text-[13px] font-extrabold">
                  <span className="size-3.5 rounded-[5px] border-2 border-ink" style={{ background: catOf(k).hex }} />
                  {catOf(k).label}
                  <span className="ml-auto">{money(month.byCategory[k], settings.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!readOnly && <QuickExpense currency={settings.currency} />}

        <Panel title="Last 6 months" icon="coins">
          <div className="flex h-36 items-end gap-2" role="img" aria-label={trend.map((t) => `${t.label}: spent ${money(t.spent, settings.currency)}`).join(", ")}>
            {trend.map((t, i) => (
              <div key={t.ym} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-extrabold text-ink-soft">{t.spent ? Math.round(t.spent / 100) : ""}</span>
                <div className="flex w-full items-end justify-center gap-0.5" style={{ height: "100%" }}>
                  <div
                    className={`w-full max-w-7 rounded-t-lg border-2 border-b-0 border-ink ${i === trend.length - 1 ? "bg-pink" : "bg-pink-soft"}`}
                    style={{ height: `${Math.max(4, (t.spent / peak) * 100)}%` }}
                  />
                  {t.earned > 0 && <div className="w-2 rounded-t-md border-2 border-b-0 border-ink bg-mint" style={{ height: `${Math.max(4, (t.earned / peak) * 100)}%` }} />}
                </div>
                <span className="text-[11px] font-extrabold">{t.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-bold text-ink-soft">Pink is spending, green is money in. Numbers are in {settings.currency}.</p>
        </Panel>

        <Panel title="Money notes" icon="notes" tone="bg-lilac-soft">
          {moneyNotes.length === 0 && <p className="text-sm font-bold text-ink-soft">Plans, things to remember about money, bank info hints. Saved as notes tagged money.</p>}
          {moneyNotes.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
              <CuteIcon name="notes" size={22} />
              <span className="min-w-0 flex-1 truncate">{n.title || n.body.slice(0, 50)}</span>
            </Link>
          ))}
          {!readOnly && (
            <ActionForm action={addNote} className="flex gap-2">
              <input type="hidden" name="kind" value="note" />
              <input type="hidden" name="tags" value="money" />
              <input name="body" required maxLength={2000} placeholder="Save RM 200 every month for" className="field h-11" />
              <SubmitButton className="h-11 shrink-0 bg-white px-4 text-base">Save</SubmitButton>
            </ActionForm>
          )}
        </Panel>

        <Panel title="Savings goals" icon="coins" tone="bg-mint-soft">
          {goals.length === 0 && <p className="text-sm font-bold text-ink-soft">Saving for something? A trip, a laptop, an emergency fund. Add it and watch it grow 🐷</p>}
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
            return (
              <div key={g.id} className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{g.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{g.name}</span>
                  <span className="text-xs font-extrabold">
                    {money(g.savedCents, settings.currency)} / {money(g.targetCents, settings.currency)}
                  </span>
                </div>
                <div className="flex h-3.5 overflow-hidden rounded-full border-2 border-ink bg-cream">
                  <div className="bg-mint" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-ink-soft">
                  {pct >= 100 ? "Done! 🎉" : `${pct}%${g.dueOn ? `, by ${prettyDay(g.dueOn)}` : ""}`}
                </span>
                {!readOnly && (
                  <ActionForm action={addToGoal} className="flex gap-1.5">
                    <input type="hidden" name="id" value={g.id} />
                    <input name="amount" type="number" step="0.01" min="0.01" required placeholder={settings.currency} aria-label="Amount" className="field h-10 min-w-0" />
                    <button type="submit" name="dir" value="in" className="h-10 shrink-0 rounded-xl border-2 border-ink bg-mint px-2.5 text-xs font-extrabold">
                      + Save
                    </button>
                    <button type="submit" name="dir" value="out" className="h-10 shrink-0 rounded-xl border-2 border-ink bg-white px-2.5 text-xs font-extrabold">
                      Take out
                    </button>
                    <ActButton action={deleteGoal.bind(null, g.id)} confirmText={`Remove ${g.name}?`} label="Delete" className="flex size-10 shrink-0 items-center justify-center text-ink-soft">
                      <Icon name="trash" size={14} />
                    </ActButton>
                  </ActionForm>
                )}
              </div>
            );
          })}
          {!readOnly && (
            <details>
              <summary className="cursor-pointer text-sm font-extrabold underline">+ New goal</summary>
              <ActionForm action={addGoal} className="mt-2 flex flex-col gap-2">
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_6.5rem] gap-2">
                  <input name="emoji" defaultValue="🐷" maxLength={4} aria-label="Emoji" className="field px-2 text-center" />
                  <input name="name" required maxLength={60} placeholder="Trip to Japan" className="field" />
                  <input name="target" required type="number" step="1" min="1" placeholder={settings.currency} aria-label="Target" className="field" />
                </div>
                <div className="flex gap-2">
                  <input name="dueOn" type="date" aria-label="By when" className="field max-w-44 px-2" />
                  <SubmitButton className="h-12 shrink-0 bg-white px-4 text-base">Add goal</SubmitButton>
                </div>
              </ActionForm>
            </details>
          )}
        </Panel>

        <Panel title="Owe and owed" icon="debt" tone="bg-sun-soft" className="scroll-mt-20" >
          <div id="debts" className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border-2 border-ink bg-mint px-3 py-2">
              <span className="block text-xs font-extrabold">People owe you</span>
              <span className="font-display text-xl font-bold">{money(debts.owedToMe, settings.currency)}</span>
            </div>
            <div className="rounded-2xl border-2 border-ink bg-pink px-3 py-2">
              <span className="block text-xs font-extrabold">You owe</span>
              <span className="font-display text-xl font-bold">{money(debts.iOwe, settings.currency)}</span>
            </div>
          </div>
          {debts.open.map((d) => (
            <div key={d.id} className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
              <CuteIcon name={d.direction === "i_owe" ? "coinOut" : "coinIn"} size={32} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-extrabold">
                  {d.direction === "i_owe" ? `You owe ${d.person}` : `${d.person} owes you`}
                </span>
                <span className="truncate text-xs font-bold text-ink-soft">{[d.note, d.dueOn ? `by ${prettyDay(d.dueOn)}` : null].filter(Boolean).join(", ")}</span>
              </span>
              <span className="font-display font-bold">{money(d.amountCents, settings.currency)}</span>
              {!readOnly && (
                <ActButton action={settleDebt.bind(null, d.id)} className="h-9 rounded-xl border-2 border-ink bg-mint px-2 text-xs font-extrabold">
                  Settled ✓
                </ActButton>
              )}
            </div>
          ))}
          {!readOnly && (
            <ActionForm action={addDebt} className="flex flex-col gap-2">
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <input name="person" required maxLength={60} placeholder="Who? (Aina, Mum...)" className="field" />
                <input name="amount" required type="number" step="0.01" min="0.01" placeholder={settings.currency} aria-label="Amount" className="field" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
                <select name="direction" defaultValue="owes_me" aria-label="Who owes" className="field px-2">
                  <option value="owes_me">They owe me</option>
                  <option value="i_owe">I owe them</option>
                </select>
                <input name="dueOn" type="date" aria-label="Pay back by" className="field px-2" />
              </div>
              <input name="note" maxLength={200} placeholder="What for? (concert tickets...)" className="field" />
              <SubmitButton className="self-start bg-white">Add</SubmitButton>
            </ActionForm>
          )}
          {debts.settled.length > 0 && (
            <details className="text-sm font-bold">
              <summary className="cursor-pointer font-extrabold">Settled ({debts.settled.length})</summary>
              {debts.settled.map((d) => (
                <div key={d.id} className="flex items-center gap-2 py-1">
                  <span className="flex-1 truncate">
                    {d.direction === "i_owe" ? `You paid ${d.person}` : `${d.person} paid you`} {money(d.amountCents, settings.currency)}
                  </span>
                  {!readOnly && (
                    <ActButton action={deleteDebt.bind(null, d.id)} label="Delete" className="text-ink-soft">
                      <Icon name="trash" size={14} />
                    </ActButton>
                  )}
                </div>
              ))}
            </details>
          )}
        </Panel>
      </div>

      <section className="flex flex-col gap-2.5 lg:pt-[68px]">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold">
          <CuteIcon name="bills" size={30} /> This month
        </h2>
        {month.rows.length === 0 ? (
          <Empty mood="love" title="No spending yet" text="Your piggy is very happy 🐷" />
        ) : (
          month.rows.map((r) => {
            const c = catOf(r.category);
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-2 pl-2.5">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink ${c.bg}`}>
                  <CuteIcon name={c.icon} size={32} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-extrabold">{r.note || c.label}</span>
                  <span className="text-xs font-bold text-ink-soft">{prettyDay(r.occurredOn)}</span>
                </div>
                <span className="font-display text-lg font-bold">
                  {r.kind === "income" ? "+" : ""}
                  {money(r.amountCents, settings.currency)}
                </span>
                {!readOnly && <DeleteTxButton id={r.id} label={r.note || c.label} />}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
