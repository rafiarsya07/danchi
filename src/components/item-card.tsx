"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { addItemToList, bumpItem, deleteItem } from "@/app/(app)/actions";
import { ITEM_CATEGORIES, type ItemCategory } from "@/lib/constants";

export function ItemCard({
  id,
  name,
  category,
  quantity,
  lowAt,
  location,
  expiresIn,
  readOnly,
}: {
  id: string;
  name: string;
  category: string;
  quantity: number;
  lowAt: number;
  location: string | null;
  /** days until expiry, null when it doesn't expire */
  expiresIn: number | null;
  readOnly: boolean;
}) {
  const cat = ITEM_CATEGORIES[(category as ItemCategory) in ITEM_CATEGORIES ? (category as ItemCategory) : "other"];
  const [qty, setQty] = useOptimistic(quantity);
  const [, start] = useTransition();
  const [menu, setMenu] = useState(false);

  let badge: { text: string; cls: string } | null = null;
  if (qty === 0) badge = { text: "Out", cls: "bg-coral text-white" };
  else if (qty <= lowAt) badge = { text: "Low", cls: "bg-pink" };
  else if (expiresIn !== null && expiresIn < 0) badge = { text: "Expired", cls: "bg-coral text-white" };
  else if (expiresIn !== null && expiresIn <= 14) badge = { text: `${expiresIn}d`, cls: expiresIn <= 3 ? "bg-peach" : "bg-sun-soft" };

  const bump = (d: 1 | -1) =>
    start(async () => {
      setQty(Math.max(0, qty + d));
      await bumpItem(id, d);
    });

  return (
    <div className="sticker relative flex min-w-0 flex-col gap-2 rounded-3xl bg-white p-3">
      <div className="flex items-start justify-between gap-1.5">
        <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-ink ${cat.bg}`}>
          <CuteIcon name={cat.icon} size={40} />
        </span>
        <div className="flex items-center gap-1">
          {badge && (
            <span className={`whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${badge.cls}`}>
              {badge.text}
            </span>
          )}
          {!readOnly && (
            <button
              type="button"
              aria-label={`More for ${name}`}
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="-mr-1 flex size-9 items-center justify-center rounded-xl"
            >
              <Icon name="dots" size={20} stroke={3.2} />
            </button>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <Link href={`/stuff/${id}`} className="font-display truncate text-[17px] font-semibold underline-offset-2 hover:underline">
          {name}
        </Link>
        {location && <span className="truncate text-xs font-bold text-ink-soft">{location}</span>}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={readOnly || qty === 0}
          onClick={() => bump(-1)}
          aria-label={`Use one ${name}`}
          className="flex h-10 w-11 items-center justify-center rounded-[14px] border-2 border-ink bg-cream disabled:opacity-40"
        >
          <Icon name="minus" size={18} stroke={3} />
        </button>
        <span className="font-display text-[22px] font-bold" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => bump(1)}
          aria-label={`Add one ${name}`}
          className="flex h-10 w-11 items-center justify-center rounded-[14px] border-2 border-ink bg-cream disabled:opacity-40"
        >
          <Icon name="plus" size={18} stroke={3} />
        </button>
      </div>

      {menu && (
        <div className="absolute right-2 top-12 z-10 flex w-40 flex-col overflow-hidden rounded-2xl border-[2.5px] border-ink bg-white shadow-[0_4px_0_#2E2240]">
          <Link href={`/stuff/${id}`} className="flex min-h-11 items-center gap-2 border-b-2 border-ink px-3 text-left text-sm font-extrabold hover:bg-pink-soft">
            <Icon name="eye" size={17} /> Details, photo
          </Link>
          <button
            type="button"
            onClick={() => start(async () => { setMenu(false); await addItemToList(id); })}
            className="flex min-h-11 items-center gap-2 px-3 text-left text-sm font-extrabold hover:bg-pink-soft"
          >
            <CuteIcon name="shop" size={24} /> To shopping
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete ${name}?`)) start(() => deleteItem(id));
              setMenu(false);
            }}
            className="flex min-h-11 items-center gap-2 border-t-2 border-ink px-3 text-left text-sm font-extrabold hover:bg-pink-soft"
          >
            <Icon name="trash" size={17} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
