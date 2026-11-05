"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { LiveDot, LiveProvider, UnreadPill } from "@/components/live";
import { MascotBadge } from "@/components/mascot";
import { logout } from "@/app/login/actions";
import { logVisit } from "@/app/(app)/care-actions";
import { LockKeeper } from "@/components/lock-screen";
import { SECTIONS } from "@/lib/constants";
import type { IslandState } from "@/lib/data";

type NavItem = { href: string; label: string; icon: CuteIconName; tile: string };

const SIDEBAR: { group: string; items: NavItem[] }[] = [
  { group: "Every day", items: [SECTIONS.home, SECTIONS.check, SECTIONS.tasks, SECTIONS.reminders, SECTIONS.calendar, SECTIONS.habits] },
  { group: "Us", items: [SECTIONS.love, SECTIONS.music, SECTIONS.play, SECTIONS.cozy, SECTIONS.safe, SECTIONS.cycle] },
  { group: "Home life", items: [SECTIONS.stuff, SECTIONS.shop, SECTIONS.kitchen] },
  { group: "Money", items: [SECTIONS.money, SECTIONS.bills, SECTIONS.wishlist] },
  { group: "Study and growth", items: [SECTIONS.study, SECTIONS.learn, SECTIONS.projects, SECTIONS.papers, SECTIONS.notes] },
  { group: "Chichi", items: [SECTIONS.ask, SECTIONS.guide, SECTIONS.search, SECTIONS.inbox, SECTIONS.settings] },
];

/** Which privacy key hides which nav item from the viewer. */
const NAV_KEY: Record<string, string> = {
  "/tasks": "tasks",
  "/reminders": "tasks",
  "/calendar": "calendar",
  "/habits": "habits",
  "/stuff": "stuff",
  "/shop": "stuff",
  "/kitchen": "kitchen",
  "/money": "money",
  "/bills": "money",
  "/wishlist": "wishlist",
  "/study": "study",
  "/learn": "learn",
  "/projects": "projects",
  "/papers": "papers",
  "/notes": "notes",
  "/cycle": "cycle",
  "/cozy": "cozy",
  "/check": "cycle", // hers only, like cycle
};

const QUICK_ADD: NavItem[] = [
  { href: "/safe", label: "Check in", icon: "shield", tile: "bg-mint-soft" },
  { href: "/check", label: "Daily check", icon: "mood", tile: "bg-lilac-soft" },
  { href: "/tasks?new=1", label: "Task", icon: "tasks", tile: "bg-sun-soft" },
  { href: "/reminders?new=1", label: "Reminder", icon: "bell", tile: "bg-sun-soft" },
  { href: "/money", label: "Expense", icon: "money", tile: "bg-pink-soft" },
  { href: "/stuff?new=1", label: "Item", icon: "stuff", tile: "bg-peach-soft" },
  { href: "/shop?new=1", label: "To buy", icon: "shop", tile: "bg-peach-soft" },
  { href: "/study", label: "Homework", icon: "study", tile: "bg-sky-soft" },
  { href: "/study?tab=exams", label: "Exam", icon: "exam", tile: "bg-pink-soft" },
  { href: "/notes?tab=journal", label: "Journal", icon: "journal", tile: "bg-pink-soft" },
  { href: "/habits", label: "Habit", icon: "habits", tile: "bg-mint-soft" },
  { href: "/wishlist", label: "Wish", icon: "wish", tile: "bg-pink-soft" },
  { href: "/papers", label: "Paper", icon: "papers", tile: "bg-sun-soft" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Shell({
  meId,
  role,
  name,
  ownerName,
  unread,
  island,
  hidden = [],
  lockMinutes = 0,
  children,
}: {
  meId: string;
  role: "owner" | "viewer";
  name: string;
  ownerName: string;
  unread: number;
  island: IslandState;
  hidden?: string[];
  lockMinutes?: number;
  children: React.ReactNode;
}) {
  const path = usePathname();
  // The love chat is a full screen, like WhatsApp: no bottom bar on phones.
  const chatScreen = path.startsWith("/love");
  const viewer = role === "viewer";
  const hiddenSet = new Set(hidden);
  const visible = (n: NavItem) => !viewer || !hiddenSet.has(NAV_KEY[n.href] ?? "");

  useEffect(() => {
    if (viewer) void logVisit(path).catch(() => {});
  }, [viewer, path]);

  return (
    <div className="flex min-h-dvh">
      <LiveProvider initialUnread={unread} island={island} canEdit={!viewer} meId={meId} />
      <LockKeeper minutes={lockMinutes} />

      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r-[2.5px] border-ink bg-white px-3.5 py-5 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-1.5">
          <MascotBadge size={48} />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[28px] font-bold">Danchi</span>
            <span className="flex items-center gap-2 whitespace-nowrap text-xs font-extrabold text-ink-soft">
              {ownerName}&apos;s home <LiveDot />
            </span>
          </span>
        </Link>
        <nav aria-label="Sections" className="flex flex-col gap-3">
          {SIDEBAR.map((g) => ({ ...g, items: g.items.filter(visible) }))
            .filter((g) => g.items.length > 0)
            .map((g) => (
            <div key={g.group} className="flex flex-col gap-0.5">
              <span className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft">{g.group}</span>
              {g.items.map((n) => {
                const on = isActive(path, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-2xl border-2 px-2 text-[15px] font-extrabold transition-colors ${
                      on ? `border-ink ${n.tile} shadow-[0_3px_0_#2E2240]` : "border-transparent hover:bg-cream"
                    }`}
                  >
                    <CuteIcon name={n.icon} size={30} />
                    {n.label}
                    {n.href === "/inbox" && <UnreadPill initial={unread} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {viewer && <ViewerPill ownerName={ownerName} />}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-cream px-2 py-1.5">
            <MascotBadge size={34} mood={viewer ? "happy" : "love"} bg={viewer ? "bg-sky-soft" : "bg-peach-soft"} />
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{name}</span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-white"
              >
                <Icon name="logout" size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className={`mx-auto w-full max-w-6xl flex-1 px-4 pt-[68px] md:px-9 md:pb-12 md:pt-20 ${chatScreen ? "pb-0" : "pb-36"}`}>
          {viewer && (
            <div className="mb-4 md:hidden">
              <ViewerPill ownerName={ownerName} />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Phone bottom bar, with labels so every button is obvious */}
      <nav
        aria-label="Main"
        className={`sticker fixed inset-x-3 bottom-[max(14px,env(safe-area-inset-bottom))] z-30 h-[76px] grid-cols-5 items-center rounded-[28px] bg-white px-1 md:hidden ${chatScreen ? "hidden" : "grid"}`}
      >
        <BottomLink item={SECTIONS.home} label="Home" path={path} />
        <BottomLink item={SECTIONS.tasks} label="Tasks" path={path} />
        <div className="flex justify-center">
          {viewer ? (
            <Link href="/love" aria-label={`Leave ${ownerName} a love note`} className="sticker press -mt-9 flex size-[66px] items-center justify-center rounded-full bg-pink">
              <CuteIcon name="letter" size={40} />
            </Link>
          ) : (
            <QuickAdd />
          )}
        </div>
        <BottomLink item={SECTIONS.stuff} label="Stuff" path={path} />
        <BottomLink item={SECTIONS.ask} label="Chichi" path={path} />
      </nav>
    </div>
  );
}

function BottomLink({ item, label, path }: { item: NavItem; label: string; path: string }) {
  const on = isActive(path, item.href);
  return (
    <Link href={item.href} aria-current={on ? "page" : undefined} className="flex flex-col items-center gap-0.5">
      <span
        className={`flex h-10 w-14 items-center justify-center rounded-2xl transition ${
          on ? `${item.tile} border-2 border-ink` : "border-2 border-transparent"
        }`}
      >
        <CuteIcon name={item.icon} size={on ? 32 : 30} />
      </span>
      <span className={`text-[11px] leading-none ${on ? "font-black" : "font-extrabold text-ink-soft"}`}>{label}</span>
    </Link>
  );
}

function QuickAdd() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="pop-in absolute bottom-[86px] left-1/2 w-[340px] max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-[26px] border-[2.5px] border-ink bg-white p-3 shadow-[0_5px_0_#2E2240]">
          <p className="font-display mb-2 text-center text-[15px] font-bold">What are we adding? 🌼</p>
          <div className="grid grid-cols-4 gap-x-1 gap-y-2">
            {QUICK_ADD.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                onClick={() => setOpen(false)}
                className="press flex flex-col items-center gap-1 rounded-2xl py-1 text-[11px] font-extrabold"
              >
                <span className={`flex size-[52px] items-center justify-center rounded-2xl border-2 border-ink ${q.tile}`}>
                  <CuteIcon name={q.icon} size={36} />
                </span>
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        aria-label="Add something"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="sticker press -mt-9 flex size-[66px] items-center justify-center rounded-full bg-sun"
      >
        <Icon name={open ? "close" : "plus"} size={30} stroke={3.2} />
      </button>
    </div>
  );
}

function ViewerPill({ ownerName }: { ownerName: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border-[2.5px] border-ink bg-sky px-3.5 py-2 text-sm font-extrabold">
      <Icon name="eye" size={18} stroke={2.4} />
      <span>
        Viewing {ownerName}&apos;s Danchi<span className="text-xs font-bold text-ink-soft">, she sees your visits</span>
      </span>
    </div>
  );
}
