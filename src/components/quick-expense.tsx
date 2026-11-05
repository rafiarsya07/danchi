"use client";

import { useState, useTransition } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { addTx } from "@/app/(app)/actions";
import { MONEY_CATEGORIES, MONEY_CATEGORY_KEYS, type MoneyCategory } from "@/lib/constants";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

export function QuickExpense({ currency }: { currency: string }) {
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<MoneyCategory>("food");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const press = (k: (typeof KEYS)[number]) => {
    setToast(null);
    setError(null);
    setAmount((a) => {
      if (k === "del") return a.slice(0, -1);
      if (k === ".") return a.includes(".") ? a : (a || "0") + ".";
      const [, dec] = a.split(".");
      if (dec !== undefined && dec.length >= 2) return a;
      if (a.replace(".", "").length >= 7) return a;
      return a === "0" ? k : a + k;
    });
  };

  const value = parseFloat(amount) || 0;
  const ready = value > 0 && !pending;

  const submit = () =>
    start(async () => {
      const res = await addTx({ amount, category: cat, note });
      if (res.ok) {
        setToast(`+${currency} ${value.toFixed(2).replace(/\.00$/, "")} ${MONEY_CATEGORIES[cat].label}`);
        setAmount("");
        setNote("");
      } else {
        setError(res.error ?? "Could not save");
      }
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {MONEY_CATEGORY_KEYS.map((k) => {
          const on = k === cat;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCat(k)}
              className="flex flex-col items-center gap-1 text-[11px] font-extrabold"
            >
              <span
                className={`flex size-[46px] items-center justify-center rounded-2xl border-[2.5px] border-ink transition ${
                  on ? `${MONEY_CATEGORIES[k].bg} -translate-y-0.5 shadow-[0_4px_0_#2E2240]` : "bg-white"
                }`}
              >
                <CuteIcon name={MONEY_CATEGORIES[k].icon} size={34} />
              </span>
              {MONEY_CATEGORIES[k].label}
            </button>
          );
        })}
      </div>

      <div className="flex h-[76px] items-center gap-2 rounded-[22px] border-[2.5px] border-ink bg-white px-4">
        <span className="font-display text-xl font-semibold text-ink-soft">{currency}</span>
        <output aria-live="polite" className="font-display min-w-0 flex-1 truncate text-[42px] font-bold leading-none">
          {amount || "0"}
        </output>
        <span className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-[13px] font-extrabold ${MONEY_CATEGORIES[cat].bg}`}>
          {MONEY_CATEGORIES[cat].label}
        </span>
      </div>

      <label className="sr-only-safe" htmlFor="tx-note">
        Note
      </label>
      <input
        id="tx-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={120}
        placeholder="Note (optional)"
        className="field"
      />

      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "del" ? "Delete" : k === "." ? "Decimal point" : k}
            className="sticker-sm press font-display flex h-14 items-center justify-center rounded-[18px] bg-white text-2xl font-semibold"
          >
            {k === "del" ? <Icon name="backspace" size={26} /> : k}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!ready}
        onClick={submit}
        className={`font-display flex h-[60px] items-center justify-center gap-2 rounded-[20px] border-[2.5px] border-ink text-xl font-bold transition ${
          ready ? "press bg-sun shadow-[0_5px_0_#2E2240]" : "bg-[#F3EEE6] shadow-[0_2px_0_#2E2240]"
        }`}
      >
        <Icon name="plus" size={22} stroke={3} />
        {pending ? "Saving" : value > 0 ? `Add ${currency} ${amount}` : "Add"}
      </button>

      {toast && (
        <p role="status" className="self-center rounded-full border-2 border-ink bg-mint px-4 py-1.5 text-sm font-extrabold">
          {toast}
        </p>
      )}
      {error && (
        <p role="alert" className="self-center rounded-full border-2 border-ink bg-pink-soft px-4 py-1.5 text-sm font-extrabold">
          {error}
        </p>
      )}
    </div>
  );
}
