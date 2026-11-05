import "server-only";
import { cache } from "react";
import { getSettings } from "@/lib/data";
import type { Me } from "@/lib/session";

/**
 * Sections she can hide from the viewer. Cycle is never shareable (it's hers),
 * Safety is always visible to the viewer (that's what it's for).
 */
export const SHAREABLE = [
  { key: "tasks", label: "Tasks and reminders", emoji: "✅" },
  { key: "calendar", label: "Calendar", emoji: "📅" },
  { key: "habits", label: "Habits", emoji: "🌱" },
  { key: "stuff", label: "Stuff and shopping", emoji: "🧺" },
  { key: "kitchen", label: "Kitchen", emoji: "🍳" },
  { key: "money", label: "Money, bills and debts", emoji: "💸" },
  { key: "wishlist", label: "Wishlist", emoji: "🎁" },
  { key: "study", label: "Study", emoji: "📚" },
  { key: "learn", label: "Learning and goals", emoji: "🌱" },
  { key: "projects", label: "Projects", emoji: "📁" },
  { key: "notes", label: "Notes", emoji: "📝" },
  { key: "journal", label: "Journal (private pages stay private anyway)", emoji: "💗" },
  { key: "papers", label: "Papers (documents and applications)", emoji: "🗂️" },
  { key: "cozy", label: "Cozy corner (happy jar, countdowns, focus)", emoji: "☕" },
] as const;

export type SectionKey = (typeof SHAREABLE)[number]["key"] | "cycle";

/** Which section a path belongs to (for the visit log and guards). */
export function sectionOfPath(path: string): SectionKey | "home" | "other" {
  const p = path.split("?")[0];
  if (p === "/") return "home";
  const map: [string, SectionKey][] = [
    ["/tasks", "tasks"],
    ["/reminders", "tasks"],
    ["/calendar", "calendar"],
    ["/habits", "habits"],
    ["/stuff", "stuff"],
    ["/shop", "stuff"],
    ["/kitchen", "kitchen"],
    ["/money", "money"],
    ["/bills", "money"],
    ["/wishlist", "wishlist"],
    ["/study", "study"],
    ["/learn", "learn"],
    ["/projects", "projects"],
    ["/notes", "notes"],
    ["/papers", "papers"],
    ["/cycle", "cycle"],
    ["/cozy", "cozy"],
  ];
  return map.find(([pre]) => p.startsWith(pre))?.[1] ?? "other";
}

export const getHidden = cache(async (spaceId: string): Promise<Set<string>> => {
  const s = await getSettings(spaceId);
  return new Set(Array.isArray(s.hiddenSections) ? s.hiddenSections : []);
});

/** Can this person open that section? The owner always can. */
export async function canSee(me: Me, key: SectionKey): Promise<boolean> {
  if (me.role === "owner") return true;
  if (key === "cycle") return false;
  return !(await getHidden(me.spaceId)).has(key);
}

/** Everything the viewer may not see, for filtering mixed lists (home, search, calendar). */
export async function hiddenFor(me: Me): Promise<Set<string>> {
  if (me.role === "owner") return new Set();
  const h = new Set(await getHidden(me.spaceId));
  h.add("cycle");
  return h;
}
