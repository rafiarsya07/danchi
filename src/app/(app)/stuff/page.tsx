import { HelpStrip } from "@/components/ui";
import { helpFor } from "@/lib/help";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { ItemCard } from "@/components/item-card";
import { AddItemToggle } from "@/components/toggle-panel";
import { Empty } from "@/components/ui";
import { ITEM_CATEGORIES, ITEM_CATEGORY_KEYS, ITEM_KINDS, type ItemCategory } from "@/lib/constants";
import { getItems } from "@/lib/data";
import { daysUntil } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Stuff" };

type Filter = "all" | "low" | "expiring" | ItemCategory;

export default async function StuffPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; new?: string; kind?: string }>;
}) {
  const me = await getMe();
  if (!(await canSee(me, "stuff"))) return <PrivatePage ownerName={me.ownerName} what="Stuff" />;
  const readOnly = me.role === "viewer";
  const sp = await searchParams;
  const filter: Filter =
    sp.filter === "low" || sp.filter === "expiring" || (sp.filter && sp.filter in ITEM_CATEGORIES)
      ? (sp.filter as Filter)
      : "all";

  const all = await getItems(me.spaceId);
  const items = all.filter((i) => {
    if (filter === "all") return true;
    if (filter === "low") return i.quantity <= i.lowAt;
    if (filter === "expiring") return i.expiresOn !== null && daysUntil(i.expiresOn) <= 7 && i.quantity > 0;
    return i.category === filter && (!sp.kind || i.kind === sp.kind);
  });
  const kinds = filter in ITEM_KINDS ? ITEM_KINDS[filter] : [];

  const chips: { key: Filter; label: string; on: string; icon: CuteIconName }[] = [
    { key: "all", label: "All", on: "bg-peach", icon: "stuff" },
    { key: "low", label: "Low", on: "bg-pink", icon: "low" },
    { key: "expiring", label: "Expiring", on: "bg-mint", icon: "clock" },
    ...ITEM_CATEGORY_KEYS.map((k) => ({ key: k as Filter, label: ITEM_CATEGORIES[k].label, on: ITEM_CATEGORIES[k].bg, icon: ITEM_CATEGORIES[k].icon })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Back to home"
          className="sticker-sm flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white md:hidden"
        >
          <Icon name="back" stroke={2.6} />
        </Link>
        <CuteIcon name="stuff" size={52} className="wiggle hidden sm:block" />
        <h1 className="font-display min-w-0 flex-1 text-[28px] font-bold md:text-4xl">My stuff</h1>
        <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold">{all.length}</span>
        {!readOnly && <AddItemToggle startOpen={sp.new === "1"} />}
      </div>
      <HelpStrip h={helpFor("stuff")!} />

      <nav aria-label="Filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.key === "all" ? "/stuff" : `/stuff?filter=${c.key}`}
            aria-current={filter === c.key ? "true" : undefined}
            className={`flex h-[46px] shrink-0 items-center gap-1 rounded-full border-[2.5px] border-ink pl-1.5 pr-4 text-sm font-extrabold ${
              filter === c.key ? `${c.on} shadow-[0_3px_0_#2E2240]` : "bg-white"
            }`}
          >
            <CuteIcon name={c.icon} size={28} />
            {c.label}
          </Link>
        ))}
      </nav>

      {kinds.length > 0 && (
        <nav aria-label="Type" className="-mx-1 -mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["", ...kinds].map((k) => (
            <Link
              key={k || "all"}
              href={k ? `/stuff?filter=${filter}&kind=${encodeURIComponent(k)}` : `/stuff?filter=${filter}`}
              className={`flex h-9 shrink-0 items-center rounded-full border-2 border-ink px-3 text-xs font-extrabold ${(sp.kind ?? "") === k ? "bg-sun shadow-[0_2px_0_#2E2240]" : "bg-white"}`}
            >
              {k || "All types"}
            </Link>
          ))}
        </nav>
      )}

      {items.length === 0 ? (
        <Empty
          mood={all.length === 0 ? "wave" : "happy"}
          title={all.length === 0 ? "Your shelves are empty" : "Nothing here"}
          text={all.length === 0 ? "Add your first thing with the + button. I'll watch expiry dates for you!" : "All good in this corner ✨"}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((i) => (
            <ItemCard
              key={i.id}
              id={i.id}
              name={i.name}
              category={i.category}
              quantity={i.quantity}
              lowAt={i.lowAt}
              location={[i.kind, i.brand, i.location].filter(Boolean).join(", ") || null}
              expiresIn={i.expiresOn ? daysUntil(i.expiresOn) : null}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
