"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { AddItemForm } from "@/components/add-forms";

/** The "+" button in the Stuff header that opens the add item form. */
export function AddItemToggle({ startOpen }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close" : "Add an item"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="sticker-sm press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sun"
      >
        <Icon name={open ? "close" : "plus"} size={24} stroke={3} />
      </button>
      {open && (
        <div className="order-last mt-4 w-full basis-full">
          <AddItemForm />
        </div>
      )}
    </>
  );
}
