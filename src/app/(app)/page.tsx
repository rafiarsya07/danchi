import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getNames } from "@/server/names";
import Link from "next/link";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { BellButton } from "@/components/live";
import { Mascot, type Mood } from "@/components/mascot";
import { TaskCheck } from "@/components/task-row";
import { Ring } from "@/components/ui";
import {
  getAttention,
  getMonthMoney,
  getSettings,
  getShopping,
  getSoonReminders,
  getTodayTasks,
  getUnreadCount,
  getUpcoming,
} from "@/lib/data";
import { greeting, headerDate, money, prettyDay, dayPhrase } from "@/lib/format";
import { getHomeExtras } from "@/lib/data2";
import { getMe } from "@/lib/session";
import { ActButton } from "@/components/action-form";
import { toggleHabitDay } from "@/app/(app)/more-actions";
import { todayISO } from "@/lib/format";
import { daysUntilAt, localParts, prettyWhen } from "@/lib/time";
import { ActiveTimer, MoodPicker, SafetyButtons } from "@/components/care";
import { MOODS } from "@/lib/mood";
import { LoveComposer, LoveQuick } from "@/components/love-thread";
import { MascotBadge } from "@/components/mascot";
import { getCareHome, getDailyCheck } from "@/lib/data3";
import { getCountdowns, getFocus } from "@/lib/cozy";
import { getLearning } from "@/lib/data4";
import { getProjects } from "@/lib/data2";
import { TipCard } from "@/components/tips";
import { WelcomeCard } from "@/components/welcome";
import { InstallApp } from "@/components/install-app";
import { hiddenFor } from "@/lib/privacy";
import { PHASE_INFO } from "@/lib/cycle";

type Tile = { label: string; icon: CuteIconName; tile: string; href?: string };

const MODULES: (Tile & { key?: string })[] = [
  { label: "Daily check", icon: "mood", tile: "bg-lilac-soft", href: "/check", key: "cycle" },
  { label: "Safety", icon: "shield", tile: "bg-mint-soft", href: "/safe" },
  { label: "Love notes", icon: "letter", tile: "bg-pink-soft", href: "/love" },
  { label: "Cycle", icon: "cycle", tile: "bg-pink-soft", href: "/cycle", key: "cycle" },
  { label: "Papers", icon: "papers", tile: "bg-sun-soft", href: "/papers", key: "papers" },
  { label: "Tasks", icon: "tasks", tile: "bg-sun-soft", href: "/tasks", key: "tasks" },
  { label: "Reminders", icon: "bell", tile: "bg-sun-soft", href: "/reminders", key: "tasks" },
  { label: "Calendar", icon: "calendar", tile: "bg-pink-soft", href: "/calendar", key: "calendar" },
  { label: "Habits", icon: "habits", tile: "bg-mint-soft", href: "/habits", key: "habits" },
  { label: "Stuff", icon: "stuff", tile: "bg-peach-soft", href: "/stuff", key: "stuff" },
  { label: "Shopping", icon: "shop", tile: "bg-peach-soft", href: "/shop", key: "stuff" },
  { label: "Kitchen", icon: "kitchen", tile: "bg-sky-soft", href: "/kitchen", key: "kitchen" },
  { label: "Money", icon: "money", tile: "bg-pink-soft", href: "/money", key: "money" },
  { label: "Bills", icon: "bills", tile: "bg-lilac-soft", href: "/bills", key: "money" },
  { label: "Wishlist", icon: "wish", tile: "bg-pink-soft", href: "/wishlist", key: "wishlist" },
  { label: "Study", icon: "study", tile: "bg-sky-soft", href: "/study", key: "study" },
  { label: "Learning", icon: "learn", tile: "bg-mint-soft", href: "/learn", key: "learn" },
  { label: "Projects", icon: "projects", tile: "bg-sun-soft", href: "/projects", key: "projects" },
  { label: "Notes", icon: "notes", tile: "bg-lilac-soft", href: "/notes", key: "notes" },
  { label: "Journal", icon: "journal", tile: "bg-pink-soft", href: "/notes?tab=journal", key: "journal" },
  { label: "Chichi", icon: "ask", tile: "bg-lilac-soft", href: "/ask" },
  { label: "Search", icon: "search", tile: "bg-sky-soft", href: "/search" },
  { label: "Guide", icon: "guide", tile: "bg-sun-soft", href: "/guide" },
];

function moodFor(hour: number, done: number, total: number): Mood {
  if (hour >= 23 || hour < 5) return "sleep";
  if (total > 0 && done === total) return "cheer";
  if (hour < 11) return "wave";
  return "happy";
}

export default async function HomePage() {
  const me = await getMe();
  const readOnly = me.role === "viewer";
  const [tasks, attention, month, settings, shopping, upcoming, reminders, unread, extras] = await Promise.all([
    getTodayTasks(me.spaceId),
    getAttention(me.spaceId),
    getMonthMoney(me.spaceId),
    getSettings(me.spaceId),
    getShopping(me.spaceId),
    getUpcoming(me.spaceId),
    getSoonReminders(me.spaceId),
    getUnreadCount(me.spaceId),
    getHomeExtras(me.spaceId),
  ]);
  const [care, hidden, check, learnAll] = await Promise.all([getCareHome(me.spaceId), hiddenFor(me), readOnly ? null : getDailyCheck(me.spaceId), getLearning(me.spaceId)]);
  const projects = (await getProjects(me.spaceId)).filter((p) => p.status === "active").slice(0, 3);
  const [countdowns, focus, jarCount] = await Promise.all([
    getCountdowns(me.spaceId),
    readOnly ? null : getFocus(me.spaceId),
    db.$count(schema.jarNote, eq(schema.jarNote.ownerId, me.spaceId)),
  ]);
  const learning = learnAll.items.filter((l) => l.status === "doing" && ["goal", "course", "book", "article", "video"].includes(l.kind)).slice(0, 3);
  const show = (k: string) => !hidden.has(k);
  // Cards she switched off in Settings, Home screen
  const off = new Set(readOnly ? [] : settings.homeHidden ?? []);
  const card = (k: string) => !off.has(k);
  const partner = (await getNames(db)).viewer;
  const moodFace = care.moods.today ? MOODS.find((m) => m.v === care.moods.today!.mood) : null;
  const cyc = care.cycle;
  const cycleHeadsUp = readOnly && settings.cycleTellRafi && cyc && (cyc.onPeriod || (cyc.daysToNext != null && cyc.daysToNext >= 0 && cyc.daysToNext <= 3));
  const today = todayISO();
  const examDays = extras.nextExam ? daysUntilAt(extras.nextExam.at) : null;
  const doneCount = tasks.filter((t) => t.done).length;
  const openCount = tasks.length - doneCount;
  const left = settings.monthlyBudgetCents - month.spent;
  const pct = settings.monthlyBudgetCents > 0 ? Math.round((month.spent / settings.monthlyBudgetCents) * 100) : 0;
  const mood = moodFor(localParts(new Date()).hour, doneCount, tasks.length);

  const subline = readOnly
    ? `Here's how ${me.ownerName}'s day looks 🌼`
    : tasks.length === 0
      ? "Nothing due today. Cosy day! ☁️"
      : openCount === 0
        ? "Everything's done today. So proud of you! 🎉"
        : `${openCount} little thing${openCount > 1 ? "s" : ""} to do today 🌼`;

  return (
    <div className="flex flex-col gap-5">
      {/* Hello */}
      <header className="relative flex items-center gap-2 overflow-hidden rounded-[30px] border-[2.5px] border-ink bg-peach-soft py-2 pl-1 pr-3 shadow-[0_4px_0_#2E2240] md:py-3 md:pl-3 md:pr-5">
        <div aria-hidden className="absolute -bottom-10 -right-8 size-32 rounded-full bg-sun/50" />
        <div aria-hidden className="absolute -top-6 right-24 size-12 rounded-full bg-pink/40" />
        <Mascot mood={mood} size={104} className="relative shrink-0 md:size-[128px]" />
        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-extrabold text-ink-soft">{headerDate()}</span>
          <h1 className="font-display text-[26px] font-bold leading-[1.1] md:text-4xl">
            {greeting()}, {readOnly ? me.name : me.ownerName}!
          </h1>
          <p className="text-sm font-extrabold md:text-base">{subline}</p>
        </div>
        <div className="relative flex flex-col gap-2 self-start pt-2 md:flex-row md:self-center md:pt-0">
          <BellButton initial={unread} size="sm" />
          <Link href="/settings" aria-label="Settings" className="sticker-sm press flex size-11 items-center justify-center rounded-2xl bg-white md:hidden">
            <CuteIcon name="settings" size={28} />
          </Link>
          <Link href="/guide" aria-label="How Danchi works" className="sticker-sm press hidden size-11 items-center justify-center rounded-2xl bg-white md:flex">
            <CuteIcon name="guide" size={28} />
          </Link>
        </div>
      </header>

      {/* One search for everything */}
      <form action="/search" role="search" className="relative">
        <label htmlFor="home-q" className="sr-only-safe">
          Search everything
        </label>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <CuteIcon name="search" size={30} />
        </span>
        <input id="home-q" name="q" placeholder="Search tasks, stuff, money" className="field sticker-sm h-14 rounded-[20px] pl-14 text-base" />
      </form>

      <WelcomeCard name={readOnly ? me.name : me.ownerName} />
      {!readOnly && card("tips") && <TipCard />}
      <InstallApp />

      {/* Safety timer always comes first */}
      {care.timer && <ActiveTimer dueAt={care.timer.dueAt!.toISOString()} message={care.timer.message} alerted={care.timer.status === "alerted"} readOnly={readOnly} partner={partner} />}

      {/* Love: the latest from the other one, one tap to chat */}
      {(() => {
        const last = care.love.find((n) => n.fromUserId !== me.id && n.kind !== "papask");
        const from = readOnly ? me.ownerName : partner;
        const unread = care.love.filter((n) => n.fromUserId !== me.id && !n.seenAt).length;
        const preview = !last
          ? `Say hi to ${from}`
          : last.kind === "sticker"
            ? "Sent you a sticker"
            : last.kind === "miss"
              ? "Misses you"
              : last.kind === "pap"
                ? `${last.text !== "📸" ? last.text : "Sent you a pap"}`
                : `${last.emoji !== "💌" ? last.emoji + " " : ""}${last.text}`;
        return (
          <section aria-label={`Love chat with ${from}`} className="sticker flex flex-col gap-2.5 rounded-3xl bg-white p-3.5">
            <Link href="/love" className="flex items-center gap-3">
              <span className="relative shrink-0">
                <MascotBadge size={46} mood="love" bg="bg-pink-soft" />
                {unread > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">{unread}</span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-[17px] font-semibold">{from}</span>
                  {last && <span className="text-[12px] font-semibold text-ink-soft">{prettyWhen(last.createdAt)}</span>}
                </span>
                <span className={`truncate text-[14px] ${unread ? "font-bold" : "font-medium text-ink-soft"}`}>{preview}</span>
              </span>
              <Icon name="chevron" size={18} />
            </Link>
            <LoveQuick partner={from} compact />
          </section>
        );
      })()}

      {/* Rafi's view: how she is, and a way to say something sweet */}
      {readOnly && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="sticker flex flex-col gap-2.5 rounded-[26px] bg-white p-4">
            <h2 className="font-display flex items-center gap-2 text-xl font-bold">
              <CuteIcon name="shield" size={30} /> {me.ownerName} right now
            </h2>
            {settings.shareMood && (
              <p className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold">
                <CuteIcon name={moodFace?.icon ?? "heart"} size={32} />
                {moodFace ? `Feeling ${moodFace.t.toLowerCase()} today` : "No mood logged today"}
                {moodFace && moodFace.v <= 2 && <span className="ml-auto text-xs text-ink-soft">maybe send a note?</span>}
              </p>
            )}
            <Link href="/safe" className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold">
              <CuteIcon name={care.last ? ({ safe: "home", omw: "walk", help: "sos", timer: "compass" } as const)[care.last.kind as "safe"] ?? "shield" : "shield"} size={32} />
              <span className="flex-1">
                {care.last
                  ? `${({ safe: "Home safe", omw: "On her way", help: "Needed you", timer: "Arrived safe" } as Record<string, string>)[care.last.kind]}, ${prettyWhen(care.last.createdAt)}`
                  : "No check ins yet"}
              </span>
              <Icon name="chevron" size={18} />
            </Link>
            {cycleHeadsUp && (
              <p className="rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-sm font-extrabold">🍫 Be extra sweet this week. Snacks and warm drinks are a good idea.</p>
            )}
          </section>
          <div className="flex flex-col gap-2">
            <h2 className="font-display flex items-center gap-2 text-xl font-bold">
              <CuteIcon name="letter" size={30} /> Write to {me.ownerName}
            </h2>
            <LoveComposer partner={me.ownerName} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Check in + mood, hers */}
          {!readOnly && card("safety") && (
            <section aria-label="Check in" className="sticker flex flex-col gap-3 rounded-[28px] bg-white p-4">
              <div className="flex items-center gap-2">
                <CuteIcon name="shield" size={32} />
                <h2 className="font-display flex-1 text-xl font-bold">Safe and sound</h2>
                {!care.timer && (
                  <Link href="/safe" className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[13px] font-extrabold">
                    🧭 Timer
                  </Link>
                )}
              </div>
              <SafetyButtons partner={partner} compact />
            </section>
          )}

          {/* Today */}
          {show("tasks") && card("today") && (
          <section aria-label="Today" className="sticker flex flex-col gap-2 rounded-[28px] bg-white p-4">
            <div className="flex items-center gap-2">
              <CuteIcon name="tasks" size={32} />
              <h2 className="font-display flex-1 text-xl font-bold">Today</h2>
              <Link href="/tasks" className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[13px] font-extrabold">
                All tasks
              </Link>
            </div>
            <div className="flex items-start gap-4">
              <Ring value={doneCount} max={tasks.length} size={96}>
                <span className="font-display text-[26px] font-bold">
                  {doneCount}/{tasks.length}
                </span>
                <span className="text-[11px] font-extrabold">done</span>
              </Ring>
              <div className="flex min-w-0 flex-1 flex-col">
                {tasks.length === 0 ? (
                  <div className="flex min-h-[96px] flex-col justify-center gap-2">
                    <p className="font-display text-lg font-semibold">Nothing due. Cosy day!</p>
                    {!readOnly && (
                      <Link href="/tasks?new=1" className="self-start rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
                        + Add a task
                      </Link>
                    )}
                  </div>
                ) : (
                  tasks.slice(0, 5).map((t) => <TaskCheck key={t.id} id={t.id} title={t.title} done={t.done} readOnly={readOnly} />)
                )}
                {tasks.length > 5 && (
                  <Link href="/tasks" className="mt-1 text-sm font-extrabold underline">
                    +{tasks.length - 5} more
                  </Link>
                )}
              </div>
            </div>
          </section>
          )}

          {/* Habits today */}
          {show("habits") && card("habits") && extras.habits.length > 0 && (
            <section aria-label="Habits" className="flex flex-col gap-2.5">
              <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                <CuteIcon name="habits" size={30} /> Little habits
                <Link href="/habits" className="ml-auto rounded-full border-2 border-ink bg-white px-3 py-0.5 text-[13px] font-extrabold">
                  All
                </Link>
              </h2>
              <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                {extras.habits.map((h) =>
                  readOnly ? (
                    <span key={h.id} className={`sticker-sm flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-2 pr-3.5 text-sm font-extrabold ${h.doneToday ? "bg-mint" : "bg-white"}`}>
                      <span className="text-xl">{h.doneToday ? "✅" : h.emoji}</span>
                      {h.name}
                    </span>
                  ) : (
                    <ActButton
                      key={h.id}
                      action={toggleHabitDay.bind(null, h.id, today)}
                      className={`sticker-sm press flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-2 pr-3.5 text-sm font-extrabold ${h.doneToday ? "bg-mint" : "bg-white"}`}
                    >
                      <span className="text-xl">{h.doneToday ? "✅" : h.emoji}</span>
                      <span className="flex flex-col items-start leading-tight">
                        <span>{h.name}</span>
                        {h.streak > 0 && <span className="text-[11px] text-ink-soft">🔥 {h.streak}</span>}
                      </span>
                    </ActButton>
                  ),
                )}
              </div>
            </section>
          )}

          {/* School */}
          {show("study") && card("school") && (extras.nextExam || extras.assignments.length > 0) && (
            <Link href="/study" className="sticker press flex flex-col gap-2 rounded-[26px] bg-white p-4">
              <div className="flex items-center gap-2">
                <CuteIcon name="study" size={32} />
                <h2 className="font-display flex-1 text-xl font-bold">School</h2>
                {extras.nextExam && (
                  <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[13px] font-extrabold">
                    <CuteIcon name="exam" size={18} className="-my-1 mr-0.5 inline" /> {extras.nextExam.title} {examDays === 0 ? "today!" : `in ${examDays}d`}
                  </span>
                )}
              </div>
              {extras.assignments.map((a) => (
                <span key={a.id} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
                  <CuteIcon name="study" size={24} /> <span className="min-w-0 flex-1 truncate">{a.title}</span>
                  <span className="text-xs text-ink-soft">{prettyWhen(a.dueAt!)}</span>
                </span>
              ))}
            </Link>
          )}

          {/* Coming up: reminders + dated tasks */}
          {show("tasks") && card("coming") && (reminders.length > 0 || upcoming.length > 0) && (
            <section aria-label="Coming up" className="flex flex-col gap-2.5">
              <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                <CuteIcon name="calendar" size={30} /> Coming up
              </h2>
              <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                {reminders.map((r) => (
                  <Link
                    key={r.id}
                    href="/reminders"
                    className="sticker-sm flex shrink-0 items-center gap-2 rounded-2xl bg-sun-soft py-2 pl-2 pr-3.5 text-sm font-extrabold"
                  >
                    <CuteIcon name="bell" size={28} />
                    <span className="flex flex-col leading-tight">
                      <span className="max-w-44 truncate">{r.title}</span>
                      <span className="text-xs text-ink-soft">{prettyWhen(r.remindAt)}</span>
                    </span>
                  </Link>
                ))}
                {upcoming.map((t) => (
                  <Link
                    key={t.id}
                    href="/tasks"
                    className="sticker-sm flex shrink-0 items-center gap-2 rounded-2xl bg-sky-soft py-2 pl-2 pr-3.5 text-sm font-extrabold"
                  >
                    <CuteIcon name="calendar" size={28} />
                    <span className="flex flex-col leading-tight">
                      <span className="max-w-44 truncate">{t.title}</span>
                      <span className="text-xs text-ink-soft">{prettyDay(t.dueOn!)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {!readOnly && check && card("check") && (
            <Link href="/check" className="sticker press flex items-center gap-3 rounded-[26px] bg-white p-3.5">
              <CuteIcon name="mood" size={44} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-lg font-bold leading-tight">{check.doneAt ? "Day wrapped 🌙" : "Daily check"}</span>
                <span className="flex h-3 overflow-hidden rounded-full border-2 border-ink bg-white">
                  <span className="bg-mint" style={{ width: `${(check.stepsDone / 5) * 100}%` }} />
                </span>
                <span className="text-xs font-extrabold">
                  {check.stepsDone}/5 done{check.streak > 0 ? `, 🔥 ${check.streak} day streak` : ""}. 2 minutes to wrap up today.
                </span>
              </span>
              <Icon name="chevron" size={20} stroke={3} />
            </Link>
          )}

          {!readOnly && card("mood") && (
            <section aria-label="Mood" className="sticker flex flex-col gap-2.5 rounded-[26px] bg-white p-4">
              <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                <CuteIcon name="mood" size={30} /> How are you, really?
              </h2>
              <MoodPicker current={care.moods.today?.mood ?? null} partner={partner} shared={settings.shareMood} />
              {cyc && (
                <Link href="/cycle" className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold">
                  <span className="text-xl">{PHASE_INFO[cyc.phase].emoji}</span>
                  <span className="flex-1">
                    {PHASE_INFO[cyc.phase].label}
                    {cyc.daysToNext != null && cyc.daysToNext > 0 && cyc.daysToNext <= 5 ? `, period in ~${cyc.daysToNext}d` : ""}
                  </span>
                  <Icon name="chevron" size={16} />
                </Link>
              )}
            </section>
          )}

          {/* Needs a little love */}
          {show("stuff") && card("stuff") && (
          <section aria-label="Needs a little love" className="flex flex-col gap-2.5">
            <h2 className="font-display flex items-center gap-2 text-xl font-bold">
              <CuteIcon name="clock" size={30} /> Needs a little love
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Sticker href="/stuff?filter=expiring" bg="bg-mint" icon="clock" n={attention.expiring.length} label="Expiring" />
              <Sticker href="/stuff?filter=low" bg="bg-pink" icon="low" n={attention.low.length} label="Running low" />
              <Sticker href="/shop" bg="bg-peach" icon="shop" n={shopping.open.length} label="To buy" />
            </div>
            <Link href="/stuff" className="text-xs font-extrabold text-ink-soft underline">
              {attention.total} things at home in total
            </Link>
            {attention.expiring.length > 0 && (
              <p className="rounded-2xl border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold">
                <CuteIcon name="clock" size={22} className="-my-1 mr-1 inline" /> {attention.expiring[0].name} expires {dayPhrase(attention.expiring[0].expiresOn!)}
                {attention.expiring.length > 1 && ` (+${attention.expiring.length - 1} more)`}
              </p>
            )}
          </section>
          )}

          {/* Papers that need attention */}
          {show("papers") && card("papers") && care.papers.length > 0 && (
            <Link href="/papers" className="sticker press flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
              <span className="font-display flex items-center gap-2 text-lg font-bold">
                <CuteIcon name="papers" size={30} /> Papers
              </span>
              {care.papers.map((p) => (
                <span key={p.id} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
                  <CuteIcon name={p.kind === "document" ? "passport" : "pencil"} size={24} /> <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-ink-soft">
                    {p.kind === "document" ? `expires ${dayPhrase(p.expiresOn!)}` : `closes ${dayPhrase(p.deadlineOn!)}`}
                  </span>
                </span>
              ))}
            </Link>
          )}

          {/* Bills due soon */}
          {show("money") && card("bills") && extras.bills.length > 0 && (
            <Link href="/bills" className="sticker press flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
              <span className="font-display flex items-center gap-2 text-lg font-bold">
                <CuteIcon name="bills" size={30} /> Bills coming
              </span>
              {extras.bills.map((b) => (
                <span key={b.id} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
                  <CuteIcon name="bills" size={24} /> <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className="text-xs">{money(b.amountCents, settings.currency)}</span>
                  <span className="text-xs text-ink-soft">{prettyDay(b.nextDue)}</span>
                </span>
              ))}
            </Link>
          )}

          {/* Today's meals */}
          {show("kitchen") && card("meals") && extras.meals.length > 0 && (
            <Link href="/kitchen?tab=plan" className="sticker press flex flex-wrap items-center gap-2 rounded-[26px] bg-white p-3.5">
              <CuteIcon name="kitchen" size={30} />
              <span className="font-display text-lg font-bold">Eating today</span>
              {extras.meals.map((m) => (
                <span key={m.id} className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[13px] font-extrabold">
                  {m.slot === "breakfast" ? "🥞" : m.slot === "lunch" ? "🍱" : m.slot === "dinner" ? "🍲" : "🍪"} {m.text}
                </span>
              ))}
            </Link>
          )}

          {/* Learning in progress */}
          {show("learn") && card("learning") && learning.length > 0 && (
            <Link href="/learn" className="sticker press flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
              <span className="font-display flex items-center gap-2 text-lg font-bold">
                <CuteIcon name="learn" size={30} /> Learning
              </span>
              {learning.map((l) => (
                <span key={l.id} className="flex items-center gap-2 text-sm font-extrabold">
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <span className="flex h-3 w-24 overflow-hidden rounded-full border-2 border-ink bg-white">
                    <span className="bg-mint" style={{ width: `${l.progress}%` }} />
                  </span>
                  <span className="w-9 text-right text-xs">{l.progress}%</span>
                </span>
              ))}
            </Link>
          )}

          {/* Cozy corner */}
          {show("cozy") && card("cozy") && (
            <section className="sticker-flat flex flex-col gap-2.5 rounded-[26px] bg-linear-to-br from-peach-soft to-lilac-soft p-3.5">
              <Link href="/cozy" className="font-display flex items-center gap-2 text-lg font-bold">
                <CuteIcon name="cozy" size={30} /> Cozy corner
              </Link>
              {countdowns[0] ? (
                <Link href="/cozy?tab=days" className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
                  <span className="text-2xl">{countdowns[0].emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{countdowns[0].title}</span>
                  <span className="font-display rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 text-sm font-bold">
                    {countdowns[0].days === 0 ? "Today!" : countdowns[0].days === 1 ? "Tomorrow" : `${countdowns[0].days} days`}
                  </span>
                </Link>
              ) : (
                !readOnly && (
                  <Link href="/cozy?tab=days" className="rounded-2xl border-2 border-solid border-ink/50 px-3 py-2 text-sm font-extrabold">
                    🎉 Add a countdown to something you&apos;re excited about
                  </Link>
                )
              )}
              <div className="grid grid-cols-3 gap-2 text-center text-[12px] font-extrabold">
                {!readOnly && (
                  <Link href="/cozy?tab=focus" className="press flex flex-col items-center rounded-2xl border-2 border-ink bg-white px-1 py-1.5">
                    <CuteIcon name="focus" size={28} />
                    {focus?.today ? `${focus.today} min today` : "Focus timer"}
                  </Link>
                )}
                <Link href="/cozy?tab=calm" className="press flex flex-col items-center rounded-2xl border-2 border-ink bg-white px-1 py-1.5">
                  <CuteIcon name="calm" size={28} />
                  Breathe 1 min
                </Link>
                <Link href="/cozy?tab=jar" className="press flex flex-col items-center rounded-2xl border-2 border-ink bg-white px-1 py-1.5">
                  <CuteIcon name="jar" size={28} />
                  {jarCount ? `${jarCount} happy moments` : "Happy jar"}
                </Link>
              </div>
            </section>
          )}

          {/* Projects in progress */}
          {show("projects") && card("projects") && projects.length > 0 && (
            <Link href="/projects" className="sticker press flex flex-col gap-2 rounded-[26px] bg-white p-3.5">
              <span className="font-display flex items-center gap-2 text-lg font-bold">
                <CuteIcon name="projects" size={30} /> Projects
              </span>
              {projects.map((pr) => {
                const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
                return (
                  <span key={pr.id} className="flex items-center gap-2 text-sm font-extrabold">
                    <span className="min-w-0 flex-1 truncate">
                      {pr.emoji} {pr.name}
                    </span>
                    <span className="flex h-3 w-24 overflow-hidden rounded-full border-2 border-ink bg-white">
                      <span className="bg-sun" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-10 text-right text-xs">
                      {pr.done}/{pr.total}
                    </span>
                  </span>
                );
              })}
            </Link>
          )}

          {/* Money */}
          {show("money") && card("money") && (
          <Link href="/money" className="sticker press flex items-center gap-4 rounded-[26px] bg-white p-3.5">
            <Ring value={month.spent} max={settings.monthlyBudgetCents} size={70} track="#FFE0EC" fill={pct > 100 ? "#FF7A6B" : "#7C5CFF"}>
              <span className="font-display text-sm font-bold">{pct}%</span>
            </Ring>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-extrabold">Spent in {month.label}</span>
              <span className="font-display text-[26px] font-bold leading-tight">{money(month.spent, settings.currency)}</span>
              <span className="text-[13px] font-extrabold">
                {left >= 0 ? `${money(left, settings.currency)} left` : `${money(-left, settings.currency)} over`}
              </span>
            </div>
            <CuteIcon name="money" size={52} />
          </Link>
          )}

          {/* Ask Chichi */}
          {card("ask") && (
          <Link href="/ask" className="sticker press relative flex items-center gap-1 overflow-hidden rounded-[26px] bg-white py-1 pl-1 pr-4">
            <Mascot mood="think" size={92} animate={false} className="shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-display text-xl font-bold">Ask Chichi</span>
              <span className="text-[13px] font-extrabold">&quot;What can I cook with what I have?&quot;</span>
            </div>
            <Icon name="chevron" size={22} stroke={3} />
          </Link>
          )}
        </div>
      </div>

      {/* Everything */}
      <section aria-label="All sections" className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold">Everything</h2>
        <nav className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8">
          {MODULES.filter((m) => !m.key || show(m.key)).map((m) => {
            const inner = (
              <>
                <span
                  className={`relative flex size-[68px] items-center justify-center rounded-[24px] border-[2.5px] border-ink ${m.tile} ${
                    m.href ? "shadow-[0_4px_0_#2E2240]" : "opacity-55 grayscale-[35%]"
                  }`}
                >
                  <CuteIcon name={m.icon} size={46} />
                  {!m.href && (
                    <span className="absolute -right-2 -top-2 rounded-full border-2 border-ink bg-white px-1.5 text-[10px] font-extrabold">soon</span>
                  )}
                </span>
                {m.label}
              </>
            );
            return m.href ? (
              <Link key={m.label} href={m.href} className="press wiggle flex flex-col items-center gap-1.5 text-[13px] font-extrabold">
                {inner}
              </Link>
            ) : (
              <div key={m.label} aria-disabled className="flex flex-col items-center gap-1.5 text-[13px] font-extrabold text-ink-soft">
                {inner}
              </div>
            );
          })}
        </nav>
      </section>
    </div>
  );
}

function Sticker({ href, bg, icon, n, label }: { href: string; bg: string; icon: CuteIconName; n: number; label: string }) {
  return (
    <Link href={href} className={`sticker press flex flex-col items-start gap-0.5 rounded-[22px] ${bg} px-3 pb-2.5 pt-2`}>
      <CuteIcon name={icon} size={38} />
      <span className="font-display text-[30px] font-bold leading-none">{n}</span>
      <span className="text-xs font-extrabold leading-tight">{label}</span>
    </Link>
  );
}
