import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Mascot } from "@/components/mascot";
import { ColorPick, Empty, Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addHabit, archiveHabit, deleteHabit, toggleHabitDay } from "@/app/(app)/more-actions";
import { colorOf } from "@/lib/constants";
import { getHabits } from "@/lib/data2";
import { todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Habits" };

const EMOJIS = ["🌱", "💧", "📖", "🏃‍♀️", "🧘‍♀️", "💊", "🛏️", "🥗", "✍️", "🪥", "🧴", "🙏"];
const DAY = ["M", "T", "W", "T", "F", "S", "S"];

export default async function HabitsPage() {
  const me = await getMe();
  if (!(await canSee(me, "habits"))) return <PrivatePage ownerName={me.ownerName} what="Habits" />;
  const ro = me.role === "viewer";
  const today = todayISO();
  const habits = await getHabits(me.spaceId);
  const live = habits.filter((h) => !h.archived);
  const doneToday = live.filter((h) => h.doneToday).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Habits" icon="habits" subtitle={live.length ? `${doneToday} of ${live.length} done today` : "Tiny things, every day"} />

      {live.length > 0 && doneToday === live.length && (
        <div className="sticker flex items-center gap-2 rounded-[24px] bg-white py-1 pl-1 pr-4">
          <Mascot mood="cheer" size={76} />
          <p className="font-display text-lg font-bold">Every habit done today. So proud of you!</p>
        </div>
      )}

      {live.length === 0 ? (
        <Empty mood="wave" title="No habits yet" text="Start with one tiny thing, like drinking water. I'll remind you and keep your streak 🔥" />
      ) : (
        <div className="flex flex-col gap-3">
          {live.map((h) => (
            <div key={h.id} className={`sticker flex flex-col gap-2.5 rounded-[24px] p-3.5 ${colorOf(h.color).soft}`}>
              <div className="flex items-center gap-3">
                {ro ? (
                  <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-ink text-3xl ${h.doneToday ? colorOf(h.color).strong : "bg-white"}`}>
                    {h.emoji}
                  </span>
                ) : (
                  <ActButton
                    action={toggleHabitDay.bind(null, h.id, today)}
                    label={h.doneToday ? `Undo ${h.name} today` : `Did ${h.name} today`}
                    className={`press flex size-14 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-ink text-3xl shadow-[0_3px_0_#2E2240] ${h.doneToday ? colorOf(h.color).strong : "bg-white"}`}
                  >
                    {h.doneToday ? "✅" : h.emoji}
                  </ActButton>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-extrabold">{h.name}</span>
                  <span className="text-xs font-bold text-ink-soft">
                    {h.streak > 0 ? `🔥 ${h.streak} day streak` : "Start a streak today"}, {h.thisWeek}/{h.perWeek} this week
                    {h.remindTime ? `, ⏰ ${h.remindTime}` : ""}
                  </span>
                </div>
                {!ro && (
                  <ActButton action={archiveHabit.bind(null, h.id)} label={`Pause ${h.name}`} className="rounded-xl px-2 py-1 text-xs font-extrabold underline">
                    Pause
                  </ActButton>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {h.week.map((d, i) =>
                  ro || d.future ? (
                    <span key={d.d} className={`flex h-10 flex-col items-center justify-center rounded-xl border-2 border-ink text-[11px] font-extrabold ${d.on ? colorOf(h.color).strong : d.future ? "bg-white/40 opacity-50" : "bg-white"}`}>
                      {DAY[i]}
                      {d.on && <span className="text-[10px]">✓</span>}
                    </span>
                  ) : (
                    <ActButton
                      key={d.d}
                      action={toggleHabitDay.bind(null, h.id, d.d)}
                      label={`${h.name} on ${d.d}`}
                      className={`flex h-10 flex-col items-center justify-center rounded-xl border-2 border-ink text-[11px] font-extrabold ${d.on ? colorOf(h.color).strong : "bg-white"} ${d.d === today ? "ring-4 ring-ink/15" : ""}`}
                    >
                      {DAY[i]}
                      {d.on && <span className="text-[10px]">✓</span>}
                    </ActButton>
                  ),
                )}
              </div>
              <div className="flex h-3 overflow-hidden rounded-full border-2 border-ink bg-white" aria-label="Last 4 weeks">
                {h.last28.map((d) => (
                  <span key={d.d} title={d.d} className={`h-full flex-1 ${d.on ? colorOf(h.color).strong : ""}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!ro && (
        <Panel tone="bg-mint" title="New habit" icon="habits">
          <ActionForm action={addHabit} className="flex flex-col gap-2.5">
            <input name="name" required maxLength={60} placeholder="Drink 8 glasses of water" className="field" />
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emoji">
              {EMOJIS.map((e, i) => (
                <label key={e} className="cursor-pointer">
                  <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only-safe" />
                  <span className="flex size-11 items-center justify-center rounded-xl border-2 border-ink bg-white text-2xl peer-checked:bg-sun peer-checked:shadow-[0_3px_0_#2E2240]">{e}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Label text="Times a week">
                <select name="perWeek" defaultValue="7" className="field px-2">
                  {[7, 6, 5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n === 7 ? "Every day" : `${n} times`}
                    </option>
                  ))}
                </select>
              </Label>
              <Label text="Remind me at (optional)">
                <input name="remindTime" type="time" className="field px-2" />
              </Label>
            </div>
            <ColorPick value="mint" />
            <SubmitButton className="self-start">Add habit</SubmitButton>
          </ActionForm>
        </Panel>
      )}

      {habits.some((h) => h.archived) && (
        <details className="rounded-[22px] border-[2.5px] border-ink bg-white px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold">Paused habits</summary>
          {habits
            .filter((h) => h.archived)
            .map((h) => (
              <div key={h.id} className="flex items-center gap-2 py-1 text-sm font-bold">
                <span>{h.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                {!ro && (
                  <>
                    <ActButton action={archiveHabit.bind(null, h.id)} className="text-xs font-extrabold underline">
                      Resume
                    </ActButton>
                    <ActButton action={deleteHabit.bind(null, h.id)} confirmText={`Delete ${h.name} and its history?`} label="Delete" className="flex size-8 items-center justify-center text-ink-soft">
                      <Icon name="trash" size={15} />
                    </ActButton>
                  </>
                )}
              </div>
            ))}
        </details>
      )}
    </div>
  );
}
