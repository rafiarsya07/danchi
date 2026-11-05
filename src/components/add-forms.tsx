"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { addItem, addReminder, addShop, addTask, setBudget, type ActionResult } from "@/app/(app)/actions";
import { REPEAT_LABEL, REPEATS, type Repeat } from "@/lib/time";
import { ITEM_CATEGORIES, ITEM_CATEGORY_KEYS, ITEM_KINDS, SHOP_PRIORITIES, type ShopPriority } from "@/lib/constants";

function useResetOnSuccess(state: ActionResult, onOk?: () => void) {
  const ref = useRef<HTMLFormElement>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state !== last.current && state.ok) {
      ref.current?.reset();
      onOk?.();
    }
    last.current = state;
  }, [state, onOk]);
  return ref;
}

function ErrorLine({ state }: { state: ActionResult }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-ink bg-pink-soft px-3 py-1.5 text-sm font-extrabold">
      {state.error}
    </p>
  );
}

/* Tasks */

export function AddTaskForm({ autoFocus }: { autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(addTask, { ok: false });
  const ref = useResetOnSuccess(state);
  const [prio, setPrio] = useState<"low" | "normal" | "high">("normal");

  return (
    <form ref={ref} action={action} className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
      <div className="flex gap-2.5">
        <label htmlFor="task-title" className="sr-only-safe">
          New task
        </label>
        <input id="task-title" name="title" placeholder="New task" autoFocus={autoFocus} required maxLength={140} className="field flex-1" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Add task"
          className="sticker-sm press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white disabled:opacity-60"
        >
          <Icon name="plus" size={24} stroke={3} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-10 items-center gap-1.5 rounded-2xl border-2 border-ink bg-white py-1 pl-1.5 pr-2.5 text-sm font-extrabold">
          <CuteIcon name="calendar" size={24} />
          <span className="sr-only-safe">Due date</span>
          <input type="date" name="dueOn" className="bg-transparent outline-none" />
        </label>
        <label className="flex min-h-10 items-center gap-1.5 rounded-2xl border-2 border-ink bg-white py-1 pl-1.5 pr-2.5 text-sm font-extrabold" title="Chichi will ping you at this time">
          <CuteIcon name="bell" size={24} />
          <span className="sr-only-safe">Remind me at</span>
          <input type="time" name="remindTime" className="bg-transparent outline-none" />
        </label>
        <label className="flex min-h-10 items-center gap-1 rounded-2xl border-2 border-ink bg-white py-1 pl-2 pr-1 text-sm font-extrabold" title="Repeat">
          🔁
          <span className="sr-only-safe">Repeat</span>
          <select name="repeat" defaultValue="none" className="bg-transparent text-sm font-extrabold outline-none">
            <option value="none">Once</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        <input type="hidden" name="priority" value={prio} />
        {(["low", "normal", "high"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={prio === p}
            onClick={() => setPrio(p)}
            className={`min-h-9 rounded-full border-2 border-ink px-3 text-sm font-extrabold capitalize ${
              prio === p ? (p === "high" ? "bg-coral text-white" : p === "low" ? "bg-sky" : "bg-white") : "bg-sun-soft"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/* Inventory */

export function AddItemForm({ onDone }: { onDone?: () => void }) {
  const [state, action, pending] = useActionState(addItem, { ok: false });
  const ref = useResetOnSuccess(state, onDone);
  const [cat, setCat] = useState<string>("beauty");
  const [kind, setKind] = useState<string>("");

  return (
    <form ref={ref} action={action} className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
      <div className="flex gap-2.5">
        <label htmlFor="item-name" className="sr-only-safe">
          Item name
        </label>
        <input id="item-name" name="name" placeholder="What is it?" autoFocus required maxLength={80} className="field flex-1" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Save item"
          className="sticker-sm press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white disabled:opacity-60"
        >
          <Icon name="check" size={24} stroke={3} />
        </button>
      </div>
      <input type="hidden" name="category" value={cat} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
        {ITEM_CATEGORY_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={cat === k}
            onClick={() => {
              setCat(k);
              setKind("");
            }}
            className={`flex min-h-11 items-center gap-1 rounded-full border-2 border-ink py-0.5 pl-1 pr-3 text-sm font-extrabold ${
              cat === k ? `${ITEM_CATEGORIES[k].bg} shadow-[0_3px_0_#2E2240]` : "bg-white"
            }`}
          >
            <CuteIcon name={ITEM_CATEGORIES[k].icon} size={28} />
            {ITEM_CATEGORIES[k].label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          How many
          <input name="quantity" type="number" min={0} defaultValue={1} inputMode="numeric" className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          Low at
          <input name="lowAt" type="number" min={0} defaultValue={1} inputMode="numeric" className="field" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          Expires
          <input name="expiresOn" type="date" className="field px-2" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          Where
          <input name="location" placeholder="Fridge" maxLength={60} className="field" />
        </label>
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type">
        {(ITEM_KINDS[cat] ?? []).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(kind === k ? "" : k)}
            className={`min-h-9 rounded-full border-2 border-ink px-3 text-xs font-extrabold ${kind === k ? "bg-sun shadow-[0_2px_0_#2E2240]" : "bg-white"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <details className="rounded-2xl border-2 border-ink/50 bg-white/60 px-3 py-1.5">
        <summary className="cursor-pointer text-xs font-extrabold">More details (brand, price)</summary>
        <div className="grid grid-cols-2 gap-2.5 pb-1 pt-2">
          <input name="brand" maxLength={60} placeholder="Brand" className="field" />
          <input name="price" type="number" step="0.01" min="0" placeholder="Price" className="field" />
        </div>
      </details>
      <ErrorLine state={state} />
    </form>
  );
}

/* Shopping */

export function AddShopForm({ autoFocus }: { autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(addShop, { ok: false });
  const ref = useResetOnSuccess(state);
  const [prio, setPrio] = useState<ShopPriority>("need");

  return (
    <form ref={ref} action={action} className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
      <div className="flex gap-2.5">
        <label htmlFor="shop-name" className="sr-only-safe">
          Add to list
        </label>
        <input id="shop-name" name="name" placeholder="Add to list" autoFocus={autoFocus} required maxLength={80} className="field flex-1" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Add to list"
          className="sticker-sm press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white disabled:opacity-60"
        >
          <Icon name="plus" size={24} stroke={3} />
        </button>
      </div>
      <input type="hidden" name="priority" value={prio} />
      <div className="flex gap-2">
        {(Object.keys(SHOP_PRIORITIES) as ShopPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={prio === p}
            onClick={() => setPrio(p)}
            className={`min-h-9 rounded-full border-2 border-ink px-3 text-sm font-extrabold ${
              prio === p ? `${SHOP_PRIORITIES[p].cls} shadow-[0_3px_0_#2E2240]` : "bg-white"
            }`}
          >
            {SHOP_PRIORITIES[p].label}
          </button>
        ))}
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/* Budget */

export function BudgetForm({ current }: { current: number }) {
  const [state, action, pending] = useActionState(setBudget, { ok: false });
  const [open, setOpen] = useState(false);
  const ref = useResetOnSuccess(state, () => setOpen(false));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[13px] font-extrabold"
      >
        Budget {current / 100}
      </button>
    );
  }
  return (
    <form ref={ref} action={action} className="flex items-center gap-2">
      <label htmlFor="budget" className="sr-only-safe">
        Monthly budget
      </label>
      <input id="budget" name="budget" type="number" min={1} step="any" defaultValue={current / 100} autoFocus className="field h-10 w-28" />
      <button type="submit" disabled={pending} className="h-10 rounded-xl border-2 border-ink bg-sun px-3 text-sm font-extrabold">
        Save
      </button>
      {state.error && <span className="text-xs font-extrabold">{state.error}</span>}
    </form>
  );
}

/* Reminders */

export function AddReminderForm({ autoFocus, today }: { autoFocus?: boolean; today: string }) {
  const [state, action, pending] = useActionState(addReminder, { ok: false });
  const ref = useResetOnSuccess(state);
  const [repeat, setRepeat] = useState<Repeat>("none");

  return (
    <form ref={ref} action={action} className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
      <div className="flex gap-2.5">
        <label htmlFor="rem-title" className="sr-only-safe">
          Remind me to
        </label>
        <input id="rem-title" name="title" placeholder="Remind me to" autoFocus={autoFocus} required maxLength={140} className="field flex-1" />
        <button
          type="submit"
          disabled={pending}
          aria-label="Save reminder"
          className="sticker-sm press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white disabled:opacity-60"
        >
          <Icon name="check" size={24} stroke={3} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          Day
          <input name="date" type="date" required defaultValue={today} className="field px-2" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-extrabold">
          Time
          <input name="time" type="time" required defaultValue="09:00" className="field px-2" />
        </label>
      </div>
      <input type="hidden" name="repeat" value={repeat} />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repeat">
        {REPEATS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={repeat === r}
            onClick={() => setRepeat(r)}
            className={`min-h-9 rounded-full border-2 border-ink px-3 text-sm font-extrabold ${
              repeat === r ? "bg-white shadow-[0_3px_0_#2E2240]" : "bg-sun-soft"
            }`}
          >
            {REPEAT_LABEL[r]}
          </button>
        ))}
      </div>
      <label htmlFor="rem-note" className="sr-only-safe">
        Note
      </label>
      <input id="rem-note" name="note" placeholder="Little note (optional)" maxLength={200} className="field" />
      <ErrorLine state={state} />
    </form>
  );
}
