import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { AddReminderForm } from "@/components/add-forms";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { DeleteReminderButton } from "@/components/small-actions";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { getReminders, type Reminder } from "@/lib/data";
import { addDaysISO, todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";
import { localDateISO, prettyTime, prettyWhen, REPEAT_LABEL, type Repeat } from "@/lib/time";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "tasks"))) return <PrivatePage ownerName={me.ownerName} what="Reminders" />;
  const readOnly = me.role === "viewer";
  const { new: isNew } = await searchParams;
  const { upcoming, past } = await getReminders(me.spaceId);
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  const groups: { title: string; tone: string; rows: Reminder[] }[] = [
    { title: "Today", tone: "bg-sun-soft", rows: upcoming.filter((r) => localDateISO(r.remindAt) <= today) },
    { title: "Tomorrow", tone: "bg-white", rows: upcoming.filter((r) => localDateISO(r.remindAt) === tomorrow) },
    { title: "Later", tone: "bg-sky-soft", rows: upcoming.filter((r) => localDateISO(r.remindAt) > tomorrow) },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageTitle title="Reminders" icon="bell" subtitle="Chichi pings your phone + email">
        <Badge className="bg-sun">{upcoming.length} set</Badge>
      </PageTitle>

      {!readOnly && <AddReminderForm autoFocus={isNew === "1"} today={today} />}

      <Link href="/settings" className="flex items-center gap-2 rounded-2xl border-2 border-ink/40 bg-white/70 px-3 py-2 text-sm font-extrabold">
        <CuteIcon name="settings" size={26} />
        <span className="flex-1">Not getting pings? Turn on notifications for this phone</span>
        <Icon name="chevron" size={18} stroke={2.6} />
      </Link>

      {upcoming.length === 0 && <Empty mood="remind" title="No reminders yet" text="Tell me what to remember and when. I'll ring your phone and send an email 💌" />}

      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <section key={g.title} className={`sticker rounded-[26px] ${g.tone} px-3 py-3`}>
              <h2 className="font-display mb-1.5 px-1 text-lg font-bold">{g.title}</h2>
              <div className="flex flex-col gap-2">
                {g.rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-white py-1.5 pl-2 pr-1">
                    <span className="flex w-[68px] shrink-0 flex-col items-center rounded-xl bg-sun px-1 py-1 text-center leading-tight">
                      <span className="font-display text-[15px] font-bold">{prettyTime(r.remindAt)}</span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-extrabold">{r.title}</span>
                      <span className="flex items-center gap-1 truncate text-xs font-bold text-ink-soft">
                        {g.title === "Later" && <span>{prettyWhen(r.remindAt).split(",")[0]}</span>}
                        {r.repeat !== "none" && (
                          <>
                            <Icon name="repeat" size={13} stroke={2.6} /> {REPEAT_LABEL[r.repeat as Repeat]}
                          </>
                        )}
                        {r.taskId && <span>{r.repeat !== "none" ? ", " : ""}from a task</span>}
                        {r.note && <span className="truncate">{r.repeat !== "none" || r.taskId ? ", " : ""}{r.note}</span>}
                      </span>
                    </div>
                    {!readOnly && <DeleteReminderButton id={r.id} label={r.title} />}
                  </div>
                ))}
              </div>
            </section>
          ),
      )}

      {past.length > 0 && (
        <details className="rounded-[24px] border-[2.5px] border-ink bg-mint-soft px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold">Already sent ({past.length})</summary>
          <div className="flex flex-col gap-1.5 pb-2">
            {past.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm font-bold">
                <span className="min-w-0 flex-1 truncate line-through opacity-60">{r.title}</span>
                <span className="shrink-0 text-xs text-ink-soft">{prettyWhen(r.remindAt)}</span>
                {!readOnly && <DeleteReminderButton id={r.id} label={r.title} />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
