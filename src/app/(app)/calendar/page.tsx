import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { PrivatePage } from "@/components/private-page";
import { canSee, hiddenFor } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle } from "@/components/ui";
import { getCalendar, type CalItem } from "@/lib/data2";
import { addDaysISO, prettyDay, todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Calendar" };

const KIND: Record<CalItem["kind"], { icon: CuteIconName; tone: string; label: string }> = {
  exam: { icon: "exam", tone: "bg-pink", label: "Exam" },
  assignment: { icon: "study", tone: "bg-sky", label: "Assignment" },
  bill: { icon: "bills", tone: "bg-lilac", label: "Bill" },
  project: { icon: "projects", tone: "bg-sun", label: "Project" },
  task: { icon: "tasks", tone: "bg-sun-soft", label: "Task" },
  reminder: { icon: "bell", tone: "bg-peach-soft", label: "Reminder" },
  meal: { icon: "kitchen", tone: "bg-mint-soft", label: "Meal" },
  paper: { icon: "papers", tone: "bg-sun", label: "Papers" },
  debt: { icon: "debt", tone: "bg-pink-soft", label: "Owe and owed" },
};
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthInfo(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = new Date(first + "T00:00:00Z").toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return { first, days, lead, prev, next, label, last: addDaysISO(first, days - 1) };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "calendar"))) return <PrivatePage ownerName={me.ownerName} what="Her calendar" />;
  const sp = await searchParams;
  const today = todayISO();
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const M = monthInfo(ym);
  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today.startsWith(ym) ? today : M.first;
  const items = await getCalendar(me.spaceId, M.first, M.last, await hiddenFor(me));
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  const dayItems = byDay.get(selected) ?? [];
  const cells = [...Array(M.lead).fill(null), ...Array.from({ length: M.days }, (_, i) => addDaysISO(M.first, i))];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Calendar" icon="calendar" subtitle="Everything with a date, in one place" />

      <div className="flex items-center justify-between gap-2">
        <Link href={`/calendar?m=${M.prev}`} aria-label="Previous month" className="sticker-sm press flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-extrabold">
          ‹
        </Link>
        <h2 className="font-display text-2xl font-bold">{M.label}</h2>
        <Link href={`/calendar?m=${M.next}`} aria-label="Next month" className="sticker-sm press flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-extrabold">
          ›
        </Link>
      </div>

      <div className="sticker rounded-[26px] bg-white p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-extrabold text-ink-soft">
          {WD.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const its = byDay.get(d) ?? [];
            const on = d === selected;
            const isToday = d === today;
            const icons = [...new Set(its.map((x) => KIND[x.kind].icon))];
            return (
              <Link
                key={d}
                href={`/calendar?m=${ym}&d=${d}`}
                aria-label={`${prettyDay(d)}, ${its.length} things`}
                aria-current={on ? "date" : undefined}
                className={`flex min-h-[64px] flex-col items-center gap-0.5 rounded-xl border-2 p-1 sm:min-h-[84px] ${
                  on ? "border-ink bg-sun shadow-[0_3px_0_#2E2240]" : isToday ? "border-ink bg-peach-soft" : "border-transparent hover:bg-cream"
                }`}
              >
                <span className={`font-display text-sm font-bold ${isToday && !on ? "underline decoration-2 underline-offset-2" : ""}`}>{Number(d.slice(8))}</span>
                <span className="flex flex-wrap justify-center gap-px">
                  {icons.slice(0, 3).map((ic) => (
                    <CuteIcon key={ic} name={ic} size={16} className="sm:size-5" />
                  ))}
                </span>
                {its.length > 3 && <span className="text-[10px] font-extrabold text-ink-soft">+{its.length - 3}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.values(KIND).map((k) => (
          <span key={k.label} className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${k.tone}`}>
            <CuteIcon name={k.icon} size={16} className="-my-0.5 mr-0.5 inline" /> {k.label}
          </span>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-xl font-bold">{prettyDay(selected)}</h2>
        {dayItems.length === 0 ? (
          <Empty mood="sleep" title="Nothing planned" text="A free day! 🌸" />
        ) : (
          dayItems.map((it) => (
            <Link key={`${it.kind}${it.id}`} href={it.href} className={`flex items-center gap-3 rounded-[20px] border-[2.5px] border-ink p-2.5 shadow-[0_3px_0_#2E2240] ${KIND[it.kind].tone}`}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-white">
                <CuteIcon name={KIND[it.kind].icon} size={32} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={`truncate text-[15px] font-extrabold ${it.done ? "line-through opacity-60" : ""}`}>{it.title}</span>
                <span className="text-xs font-bold capitalize">
                  {KIND[it.kind].label}
                  {it.time ? `, ${it.time}` : ""}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
