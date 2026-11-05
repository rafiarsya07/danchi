import type { CuteIconName } from "@/components/cute-icon";

export const ITEM_CATEGORIES = {
  beauty: { label: "Beauty", icon: "beauty", bg: "bg-pink-soft" },
  food: { label: "Food", icon: "food", bg: "bg-sun-soft" },
  clothes: { label: "Clothes", icon: "clothes", bg: "bg-sky-soft" },
  home: { label: "Home", icon: "house", bg: "bg-mint-soft" },
  other: { label: "Other", icon: "other", bg: "bg-lilac-soft" },
} as const satisfies Record<string, { label: string; icon: CuteIconName; bg: string }>;

export type ItemCategory = keyof typeof ITEM_CATEGORIES;

/** Finer types inside each category (her list: makeup, skincare, hijab, fridge, freezer...). */
export const ITEM_KINDS: Record<string, string[]> = {
  beauty: ["Makeup", "Skincare", "Bodycare", "Haircare", "Perfume"],
  food: ["Pantry", "Fridge", "Freezer", "Snacks", "Drinks"],
  clothes: ["Clothing", "Hijab", "Accessories", "Shoes", "Bags"],
  home: ["Household", "Cleaning", "Belongings", "Electronics"],
  other: ["Medicine", "Stationery", "Other"],
};
export const ITEM_CATEGORY_KEYS = Object.keys(ITEM_CATEGORIES) as ItemCategory[];

export const MONEY_CATEGORIES = {
  food: { label: "Food", icon: "food", bg: "bg-sun-soft", hex: "#FFD95A" },
  beauty: { label: "Beauty", icon: "beauty", bg: "bg-pink-soft", hex: "#FFA9C9" },
  ride: { label: "Ride", icon: "ride", bg: "bg-sky-soft", hex: "#9FD3FF" },
  study: { label: "Study", icon: "study", bg: "bg-peach-soft", hex: "#FFB38A" },
  fun: { label: "Fun", icon: "fun", bg: "bg-mint-soft", hex: "#9EE6C4" },
  bills: { label: "Bills", icon: "bills", bg: "bg-lilac-soft", hex: "#C9B6FF" },
  shop: { label: "Shopping", icon: "shop", bg: "bg-peach-soft", hex: "#FFE1CF" },
  other: { label: "Other", icon: "coins", bg: "bg-white", hex: "#F3EEE6" },
} as const satisfies Record<string, { label: string; icon: CuteIconName; bg: string; hex: string }>;

export type MoneyCategory = keyof typeof MONEY_CATEGORIES;
export const MONEY_CATEGORY_KEYS = Object.keys(MONEY_CATEGORIES) as MoneyCategory[];

export const SHOP_PRIORITIES = {
  urgent: { label: "Urgent", cls: "bg-coral text-white" },
  need: { label: "Need", cls: "bg-sun" },
  maybe: { label: "Maybe", cls: "bg-lilac-soft" },
} as const;

export type ShopPriority = keyof typeof SHOP_PRIORITIES;

/** Every section of Danchi, in one place, so nav, home and search agree. */
export const SECTIONS = {
  home: { href: "/", label: "Home", icon: "home", tile: "bg-peach-soft" },
  tasks: { href: "/tasks", label: "Tasks", icon: "tasks", tile: "bg-sun-soft" },
  reminders: { href: "/reminders", label: "Reminders", icon: "bell", tile: "bg-sun-soft" },
  stuff: { href: "/stuff", label: "Stuff", icon: "stuff", tile: "bg-peach-soft" },
  shop: { href: "/shop", label: "Shopping", icon: "shop", tile: "bg-peach-soft" },
  money: { href: "/money", label: "Money", icon: "money", tile: "bg-pink-soft" },
  ask: { href: "/ask", label: "Ask Chichi", icon: "ask", tile: "bg-lilac-soft" },
  calendar: { href: "/calendar", label: "Calendar", icon: "calendar", tile: "bg-pink-soft" },
  habits: { href: "/habits", label: "Habits", icon: "habits", tile: "bg-mint-soft" },
  study: { href: "/study", label: "Study", icon: "study", tile: "bg-sky-soft" },
  kitchen: { href: "/kitchen", label: "Kitchen", icon: "kitchen", tile: "bg-sky-soft" },
  notes: { href: "/notes", label: "Notes", icon: "notes", tile: "bg-lilac-soft" },
  bills: { href: "/bills", label: "Bills", icon: "bills", tile: "bg-lilac-soft" },
  projects: { href: "/projects", label: "Projects", icon: "projects", tile: "bg-sun-soft" },
  wishlist: { href: "/wishlist", label: "Wishlist", icon: "wish", tile: "bg-pink-soft" },
  papers: { href: "/papers", label: "Papers", icon: "papers", tile: "bg-sun-soft" },
  learn: { href: "/learn", label: "Learning", icon: "learn", tile: "bg-mint-soft" },
  check: { href: "/check", label: "Daily check", icon: "mood", tile: "bg-lilac-soft" },
  guide: { href: "/guide", label: "Guide", icon: "guide", tile: "bg-sun-soft" },
  safe: { href: "/safe", label: "Safety", icon: "shield", tile: "bg-mint-soft" },
  music: { href: "/music", label: "Our music", icon: "music", tile: "bg-mint-soft" },
  cozy: { href: "/cozy", label: "Cozy corner", icon: "cozy", tile: "bg-peach-soft" },
  play: { href: "/play", label: "Play together", icon: "party", tile: "bg-sun-soft" },
  love: { href: "/love", label: "Love notes", icon: "letter", tile: "bg-pink-soft" },
  cycle: { href: "/cycle", label: "Cycle", icon: "cycle", tile: "bg-pink-soft" },
  search: { href: "/search", label: "Search", icon: "search", tile: "bg-sky-soft" },
  inbox: { href: "/inbox", label: "Inbox", icon: "inbox", tile: "bg-pink-soft" },
  settings: { href: "/settings", label: "Settings", icon: "settings", tile: "bg-lilac-soft" },
} as const satisfies Record<string, { href: string; label: string; icon: CuteIconName; tile: string }>;

/** Soft + strong Tailwind classes for the colours people can pick. */
export const COLOR_CLASSES: Record<string, { soft: string; strong: string }> = {
  peach: { soft: "bg-peach-soft", strong: "bg-peach" },
  sun: { soft: "bg-sun-soft", strong: "bg-sun" },
  mint: { soft: "bg-mint-soft", strong: "bg-mint" },
  sky: { soft: "bg-sky-soft", strong: "bg-sky" },
  lilac: { soft: "bg-lilac-soft", strong: "bg-lilac" },
  pink: { soft: "bg-pink-soft", strong: "bg-pink" },
};
export const colorOf = (c?: string | null) => COLOR_CLASSES[c ?? ""] ?? COLOR_CLASSES.sky;
export const COLOR_KEYS = Object.keys(COLOR_CLASSES);
