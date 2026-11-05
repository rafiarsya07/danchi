import type { Metadata } from "next";
import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { HelpStrip, PageTitle, Tabs } from "@/components/ui";
import { db } from "@/db";
import { HELP } from "@/lib/help";
import { getMe } from "@/lib/session";
import { getNames } from "@/server/names";

export const metadata: Metadata = { title: "Guide" };

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Every day", keys: ["check", "tasks", "bell", "habits", "mood", "calendar"] },
  { title: "Us", keys: ["letter", "party", "cozy", "shield", "cycle"] },
  { title: "Home life", keys: ["stuff", "shop", "kitchen"] },
  { title: "Money", keys: ["money", "bills", "wish"] },
  { title: "Study and growth", keys: ["study", "learn", "projects", "papers", "notes", "journal"] },
  { title: "Helpers", keys: ["ask", "search", "inbox", "settings"] },
];

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  const names = await getNames(db);
  const tab = (await searchParams).tab === "rafi" || (me.role === "viewer" && (await searchParams).tab !== "her") ? "rafi" : "her";
  const her = names.owner;
  const him = names.viewer;

  const firstSteps =
    tab === "her"
      ? [
          { t: "Turn on notifications on your phone", d: "So reminders actually ring. Settings, Turn on notifications, Allow.", href: "/settings" },
          { t: "Add Danchi to your home screen", d: "Chrome menu ⋮, Add to Home screen. It opens like a real app.", href: "/settings" },
          { t: "Fill in your emergency card", d: "Blood type, allergies, who to call. 1 minute, just in case.", href: "/safe" },
          { t: `Choose what ${him} can see`, d: "Settings, Privacy. Untick anything you want to keep to yourself.", href: "/settings#privacy" },
          { t: "Add your courses and next deadlines", d: "Chichi reminds you before every assignment and exam.", href: "/study" },
          { t: "Add one habit and one task", d: "Start tiny. Drink water counts!", href: "/habits" },
          { t: "Tonight, do your first Daily check", d: "2 minutes: mood, tasks, habits, money, one line of journal.", href: "/check" },
        ]
      : [
          { t: "Turn on notifications on your phone", d: `So you hear her check ins (Home safe, Need you) right away.`, href: "/settings" },
          { t: `Leave ${her} a love note`, d: "The pink envelope button in the middle. It pops up on her phone.", href: "/love" },
          { t: "Check Safety now and then", d: "Her last check in, her safe arrival timer, and her emergency card.", href: "/safe" },
          { t: "Peek at her wishlist", d: "Gift ideas, straight from her 😉", href: "/wishlist" },
        ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="How Danchi works" icon="ask" help={false} subtitle="Everything explained, in plain words" />
      <Tabs
        base="/guide"
        current={tab}
        tabs={[
          { key: "her", label: `For ${her}`, icon: "home" },
          { key: "rafi", label: `For ${him}`, icon: "letter" },
        ]}
      />

      <section className="sticker flex items-center gap-2 rounded-[26px] bg-white py-2 pl-1 pr-4">
        <Mascot mood="wave" size={92} animate={false} className="shrink-0" />
        <p className="text-[15px] font-bold leading-snug">
          {tab === "her" ? (
            <>
              Hi {her}! I&apos;m <b>Chichi</b> 🍑 Danchi is your little home for everything: what to do, what you have, what you spend, your
              studies, and staying safe. Start with the 7 steps below, then use the 💡 line on top of every page whenever you wonder what something does.
            </>
          ) : (
            <>
              Hi {him}! You can <b>look</b> at {her}&apos;s Danchi (only what she shares), get her safety check ins, and leave her love notes. You can&apos;t change her
              things, and she can see when you visit. Be sweet 💛
            </>
          )}
        </p>
      </section>

      <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-4">
        <h2 className="font-display text-xl font-bold">{tab === "her" ? "Your first 10 minutes" : "What to do first"}</h2>
        <ol className="flex flex-col gap-2">
          {firstSteps.map((s, i) => (
            <li key={s.t}>
              <Link href={s.href} className="press flex items-start gap-3 rounded-2xl border-2 border-ink bg-cream px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-sun text-sm font-extrabold">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-[15px] font-extrabold">{s.t}</span>
                  <span className="text-xs font-bold text-ink-soft">{s.d}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {tab === "her" && (
        <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-4">
          <h2 className="font-display text-xl font-bold">A normal day with Danchi</h2>
          {[
            ["☀️ Morning", "Chichi's morning message tells you what's on today. Tick tasks and habits on Home."],
            ["🚶‍♀️ Going out", "Tap On my way. Going home late? Start a safe arrival timer."],
            ["💸 Paying for something", "Money, type the amount, pick a category, Add. Or tell Chichi \"lunch RM 12\"."],
            ["📚 Got a new assignment", "Study, add it with the due date. Reminders come by themselves."],
            ["🛒 Something running out", "Tap minus on it in Stuff. It jumps to your shopping list."],
            ["🌙 Night", "Daily check: 2 minutes and your day is wrapped."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col rounded-2xl border-2 border-ink bg-white px-3 py-2">
              <span className="text-sm font-extrabold">{t}</span>
              <span className="text-[13px] font-bold text-ink-soft">{d}</span>
            </div>
          ))}
        </section>
      )}

      {GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-bold">{g.title}</h2>
          {g.keys
            .map((k) => HELP.find((h) => h.key === k)!)
            .filter((h) => tab === "her" || h.key !== "cycle")
            .map((h) => (
              <div key={h.key} className="flex flex-col gap-1.5">
                <Link href={h.href} className="flex items-center gap-2 text-[15px] font-extrabold">
                  <span className="text-xl">{h.emoji}</span>
                  {h.name}
                  <span className="text-xs text-ink-soft underline">open</span>
                </Link>
                <HelpStrip h={h} />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
