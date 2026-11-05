import { CuteIcon } from "@/components/cute-icon";
import type { Metadata } from "next";
import Link from "next/link";
import { ActButton, ActionForm } from "@/components/action-form";
import { MoodPicker } from "@/components/care";
import { SpendLine, WrapUpButton } from "@/components/check-bits";
import { Mascot } from "@/components/mascot";
import { PrivatePage } from "@/components/private-page";
import { TaskCheck } from "@/components/task-row";
import { PageTitle, SubmitButton } from "@/components/ui";
import { moveAllToTomorrow, moveToTomorrow } from "@/app/(app)/care-actions";
import { addNote, toggleHabitDay } from "@/app/(app)/more-actions";
import { db } from "@/db";
import { getSettings } from "@/lib/data";
import { getDailyCheck } from "@/lib/data3";
import { money, prettyDay } from "@/lib/format";
import { getMe } from "@/lib/session";
import { getNames } from "@/server/names";

export const metadata: Metadata = { title: "Daily check" };

function Step({ n, title, done, children, hint }: { n: number; title: string; done: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`sticker flex flex-col gap-3 rounded-[26px] p-4 ${done ? "bg-white" : "bg-white"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink text-base font-extrabold ${done ? "bg-mint" : "bg-sun"}`}>{done ? "✓" : n}</span>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          {hint && <span className="text-xs font-bold text-ink-soft">{hint}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function CheckPage() {
  const me = await getMe();
  if (me.role !== "owner") return <PrivatePage ownerName={me.ownerName} what="Her daily check" />;
  const [c, s, names] = await Promise.all([getDailyCheck(me.spaceId), getSettings(me.spaceId), getNames(db)]);
  const spent = c.txToday.filter((t) => t.kind === "expense").reduce((n, t) => n + t.amountCents, 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Daily check" icon="mood" help="check" subtitle={`${prettyDay(c.today)}, ${c.stepsDone} of 5 done`} />

      <section className="sticker flex items-center gap-3 rounded-[26px] bg-white py-2 pl-1 pr-4">
        <Mascot mood={c.stepsDone === 5 ? "cheer" : "love"} size={84} animate={false} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-display text-xl font-bold leading-tight">
            {c.stepsDone === 5 ? `All done, ${me.name} ✨` : "Let's close today together"}
          </span>
          <div className="flex h-4 overflow-hidden rounded-full border-2 border-ink bg-white" aria-label={`${c.stepsDone} of 5 steps done`}>
            <div className="bg-mint transition-all" style={{ width: `${(c.stepsDone / 5) * 100}%` }} />
          </div>
          {c.streak > 0 && <span className="text-xs font-extrabold">🔥 {c.streak} day{c.streak === 1 ? "" : "s"} in a row</span>}
        </div>
      </section>

      <Step n={1} title="How was today?" done={c.steps.mood} hint="Tap a face">
        <MoodPicker current={c.mood?.mood ?? null} partner={names.viewer} shared={s.shareMood} />
      </Step>

      <Step
        n={2}
        title="Today's tasks"
        done={c.steps.tasks}
        hint={c.openTasks.length ? "Tick what you did. The rest can move to tomorrow, no guilt." : `${c.doneTodayCount} done today. Nice!`}
      >
        {c.openTasks.length > 0 && (
          <div className="flex flex-col gap-1">
            {c.openTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TaskCheck id={t.id} title={t.title} done={false} meta={t.dueOn && t.dueOn < c.today ? `was due ${prettyDay(t.dueOn)}` : undefined} />
                </div>
                <ActButton action={moveToTomorrow.bind(null, t.id)} className="h-9 shrink-0 rounded-xl border-2 border-ink bg-sky-soft px-2.5 text-xs font-extrabold">
                  Tomorrow →
                </ActButton>
              </div>
            ))}
            {c.openTasks.length > 1 && (
              <ActButton action={moveAllToTomorrow} className="mt-1 self-start text-sm font-extrabold underline">
                Move all {c.openTasks.length} to tomorrow
              </ActButton>
            )}
          </div>
        )}
      </Step>

      <Step n={3} title="Little habits" done={c.steps.habits} hint={c.habits.length ? "Tap the ones you did today" : "No habits yet"}>
        {c.habits.length === 0 ? (
          <Link href="/habits" className="self-start rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-extrabold">
            + Add a habit
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.habits.map((h) => (
              <ActButton
                key={h.id}
                action={toggleHabitDay.bind(null, h.id, c.today)}
                className={`sticker-sm press flex items-center gap-2 rounded-2xl py-2 pl-2 pr-3.5 text-sm font-extrabold ${h.doneToday ? "bg-mint" : "bg-white"}`}
              >
                <span className="text-xl">{h.doneToday ? "✅" : h.emoji}</span>
                {h.name}
              </ActButton>
            ))}
          </div>
        )}
      </Step>

      <Step n={4} title="Money today" done={c.steps.money} hint={spent ? `Spent ${money(spent, s.currency)} today` : "Anything you paid for today?"}>
        {c.txToday.length > 0 && (
          <ul className="flex flex-col gap-1">
            {c.txToday.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold">
                <span className="min-w-0 flex-1 truncate">{t.note || t.category}</span>
                <span className="font-extrabold">
                  {t.kind === "income" ? "+" : ""}
                  {money(t.amountCents, s.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <SpendLine currency={s.currency} noSpend={c.noSpend} />
      </Step>

      <Step n={5} title="One line for your journal" done={c.steps.journal} hint="Private, just for you 🔒">
        {c.steps.journal ? (
          <p className="text-sm font-bold">Written ✓ You can add more in Journal any time.</p>
        ) : (
          <ActionForm action={addNote} okText="Saved 💗" className="flex flex-col gap-2">
            <input type="hidden" name="kind" value="journal" />
            <input type="hidden" name="private" value="on" />
            <input type="hidden" name="mood" value={c.mood?.mood ?? 3} />
            <textarea name="body" required rows={2} maxLength={2000} placeholder="Best part of today was" className="field py-2.5" />
            <SubmitButton className="h-11 self-start bg-pink text-base">Save</SubmitButton>
          </ActionForm>
        )}
      </Step>

      <section className="sticker flex flex-col gap-2 rounded-[26px] bg-white p-4">
        <h2 className="font-display text-lg font-bold">🌅 Tomorrow</h2>
        {c.tomorrowList.length === 0 ? (
          <p className="text-sm font-bold">Nothing planned yet. A calm day ☁️</p>
        ) : (
          c.tomorrowList.map((x) => (
            <Link key={x.id} href={x.href} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
              <CuteIcon name={x.icon} size={26} />
              <span className="min-w-0 flex-1 truncate">{x.t}</span>
            </Link>
          ))
        )}
      </section>

      <WrapUpButton done={!!c.doneAt} />
    </div>
  );
}
