"use client";

import { useState, useTransition } from "react";
import { addTx } from "@/app/(app)/actions";
import { setNoSpend, wrapUpDay } from "@/app/(app)/care-actions";
import { MONEY_CATEGORIES, MONEY_CATEGORY_KEYS, type MoneyCategory } from "@/lib/constants";
import { CuteIcon } from "@/components/cute-icon";

/** A small "what did you spend today" line: amount, category chip, note. */
export function SpendLine({ currency, noSpend }: { currency: string; noSpend: boolean }) {
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<MoneyCategory>("food");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {MONEY_CATEGORY_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setCat(k)}
            aria-pressed={cat === k}
            className={`flex h-10 shrink-0 items-center gap-1 rounded-full border-2 border-ink pl-1 pr-3 text-xs font-extrabold ${cat === k ? `${MONEY_CATEGORIES[k].bg} shadow-[0_2px_0_#2E2240]` : "bg-white"}`}
          >
            <CuteIcon name={MONEY_CATEGORIES[k].icon} size={26} />
            {MONEY_CATEGORIES[k].label}
          </button>
        ))}
      </div>
      <form
        className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addTx({ amount, category: cat, note });
            if (r.ok) {
              setMsg(`Added ${currency} ${amount} ${MONEY_CATEGORIES[cat].label} ✓`);
              setAmount("");
              setNote("");
            } else setMsg(r.error ?? "Check the amount");
          });
        }}
      >
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" type="number" step="0.01" min="0.01" required placeholder={currency} aria-label="Amount" className="field" />
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="What for?" className="field" />
        <button type="submit" disabled={pending} className="sticker-sm press h-12 rounded-2xl bg-pink px-4 text-sm font-extrabold disabled:opacity-60">
          Add
        </button>
      </form>
      {msg && (
        <p role="status" className="pop-in text-sm font-extrabold">
          {msg}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm font-extrabold">
        <input type="checkbox" defaultChecked={noSpend} onChange={(e) => start(() => setNoSpend(e.target.checked))} className="size-5 accent-[#2EB67D]" />
        I didn&apos;t spend anything today 🐷
      </label>
    </div>
  );
}

export function WrapUpButton({ done }: { done: boolean }) {
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(done);
  if (ok) {
    return (
      <p className="pop-in rounded-2xl border-2 border-ink bg-mint px-4 py-3 text-center text-[15px] font-extrabold">
        Day wrapped 🌙 Sleep well, you did good today.
      </p>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await wrapUpDay();
          setOk(true);
        })
      }
      className="sticker press font-display h-14 rounded-[22px] bg-lilac text-xl font-bold disabled:opacity-60"
    >
      Wrap up my day 🌙
    </button>
  );
}
