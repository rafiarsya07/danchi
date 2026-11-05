"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { deleteMemory, deleteReminder, deleteShop, deleteTx, markAllRead, toggleShop } from "@/app/(app)/actions";

export function DeleteTxButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete ${label}`}
      disabled={pending}
      onClick={() => start(() => deleteTx(id))}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-pink-soft disabled:opacity-40"
    >
      <Icon name="trash" size={18} />
    </button>
  );
}

export function ShopRow({
  id,
  name,
  done,
  badge,
  linked,
  readOnly,
}: {
  id: string;
  name: string;
  done: boolean;
  badge?: { text: string; cls: string };
  linked: boolean;
  readOnly: boolean;
}) {
  const [isDone, setDone] = useOptimistic(done);
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState(false);
  const [price, setPrice] = useState("");
  const [store, setStore] = useState("");
  const buy = (withPrice: boolean) =>
    start(async () => {
      setDone(!isDone);
      setPaying(false);
      await toggleShop(id, withPrice ? { price, store } : undefined);
    });
  return (
    <div className={`flex flex-col rounded-2xl border-2 border-ink bg-white px-2 ${pending ? "opacity-70" : ""}`}>
      <div className="flex min-h-12 items-center gap-2.5">
        <button
          type="button"
          disabled={readOnly}
          aria-label={`${isDone ? "Not bought" : "Bought"}: ${name}`}
          onClick={() => buy(false)}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span className={`flex size-[26px] items-center justify-center rounded-[9px] border-[2.5px] border-ink ${isDone ? "bg-mint" : "bg-white"}`}>
            {isDone && <Icon name="check" size={14} stroke={3.4} />}
          </span>
        </button>
        <span className={`min-w-0 flex-1 truncate text-[15px] font-extrabold ${isDone ? "line-through opacity-55" : ""}`}>{name}</span>
        {linked && !isDone && (
          <span title="From your stuff">
            <CuteIcon name="stuff" size={24} />
          </span>
        )}
        {badge && !isDone && (
          <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${badge.cls}`}>{badge.text}</span>
        )}
        {!readOnly && !isDone && (
          <button
            type="button"
            aria-label={`Bought ${name}, add the price`}
            aria-expanded={paying}
            onClick={() => setPaying((v) => !v)}
            className="flex h-9 shrink-0 items-center rounded-xl border-2 border-ink bg-sun-soft px-2 text-xs font-extrabold"
          >
            💰 Paid
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => start(() => deleteShop(id))}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-pink-soft"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {paying && (
        <form
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-2 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            buy(true);
          }}
        >
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" min="0.01" required inputMode="decimal" placeholder="RM" aria-label="Price paid" className="field h-11" />
          <input value={store} onChange={(e) => setStore(e.target.value)} maxLength={40} placeholder="Where? (Watsons...)" aria-label="Store" className="field h-11" />
          <button type="submit" className="h-11 rounded-xl border-2 border-ink bg-mint px-3 text-sm font-extrabold">
            Bought ✓
          </button>
        </form>
      )}
    </div>
  );
}

export function DeleteReminderButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Delete reminder ${label}`}
      disabled={pending}
      onClick={() => start(() => deleteReminder(id))}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-pink-soft disabled:opacity-40"
    >
      <Icon name="trash" size={18} />
    </button>
  );
}

/** Marks the inbox as read shortly after it's opened. */
export function MarkInboxRead({ unread }: { unread: number }) {
  const [, start] = useTransition();
  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => start(() => markAllRead()), 1200);
    return () => clearTimeout(id);
  }, [unread]);
  return null;
}

export function ForgetButton({ id, text }: { id: string; text: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Forget: ${text}`}
      disabled={pending}
      onClick={() => start(() => deleteMemory(id))}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-pink-soft disabled:opacity-40"
    >
      <Icon name="close" size={16} />
    </button>
  );
}
