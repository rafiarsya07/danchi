import type { Metadata } from "next";
import { and, eq, inArray } from "drizzle-orm";
import { ActButton, ActionForm } from "@/components/action-form";
import { Breathe, FocusTimer, JarShake } from "@/components/cozy";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addBucket, addCountdown, addToJar, deleteBucket, deleteCountdown, deleteJar, toggleBucket } from "@/app/(app)/cozy-actions";
import { db, schema } from "@/db";
import { getCountdowns, getFocus, getJar } from "@/lib/cozy";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Cozy corner" };

const TABS = ["focus", "calm", "jar", "days", "bucket"] as const;
const BUCKET_EMOJI = ["✨", "✈️", "🏖️", "🍣", "🎢", "🏕️", "🎬", "📸"];
type Tab = (typeof TABS)[number];
const JAR_EMOJI = ["⭐", "💛", "🌼", "🍑", "😂", "🎉", "🥹", "☕"];
const DAY_EMOJI = ["🎉", "🎂", "✈️", "💞", "🎓", "🏖️", "🎄", "🌙"];

function prettyDays(n: number) {
  if (n === 0) return "Today! 🎉";
  if (n === 1) return "Tomorrow";
  return `${n} days`;
}

export default async function CozyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "cozy"))) return <PrivatePage ownerName={me.ownerName} what="Cozy corner" />;
  const ro = me.role === "viewer";
  const t = (await searchParams).tab;
  const tab: Tab = TABS.includes(t as Tab) ? (t as Tab) : ro ? "jar" : "focus";
  const [focus, jar, days, courses] = await Promise.all([
    getFocus(me.spaceId),
    getJar(me.spaceId),
    getCountdowns(me.spaceId),
    db.select({ id: schema.course.id, name: schema.course.name }).from(schema.course).where(and(eq(schema.course.ownerId, me.spaceId), eq(schema.course.archived, false))),
  ]);
  const bucket = await db.select().from(schema.bucket).where(eq(schema.bucket.ownerId, me.spaceId)).orderBy(schema.bucket.createdAt);
  const authorIds = [...new Set(jar.map((j) => j.fromUserId).filter(Boolean) as string[])];
  const authors = authorIds.length ? await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, authorIds)) : [];
  const nameOf = (id: string | null) => authors.find((a) => a.id === id)?.name ?? "";
  const maxDay = Math.max(30, ...focus.week.map((w) => w.minutes));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Cozy corner" icon="cozy" subtitle="Little things that make the day feel softer" />
      <Tabs
        base="/cozy"
        current={tab}
        tabs={[
          ...(ro ? [] : [{ key: "focus", label: "Focus", icon: "focus" as const }]),
          { key: "calm", label: "Calm", icon: "calm" },
          { key: "jar", label: "Happy jar", icon: "jar", count: jar.length },
          { key: "days", label: "Countdowns", icon: "party", count: days.length },
          { key: "bucket", label: "Bucket list", icon: "star", count: bucket.filter((b) => !b.doneAt).length },
        ]}
      />

      {tab === "focus" && !ro && (
        <>
          <section className="sticker-flat flex flex-col gap-3 rounded-[28px] bg-linear-to-b from-peach-soft to-pink-soft p-4">
            <FocusTimer courses={courses} todayMinutes={focus.today} />
          </section>
          <Panel title="This week" icon="focus">
            <div className="flex h-32 items-end gap-2">
              {focus.week.map((w) => (
                <div key={w.d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-extrabold">{w.minutes || ""}</span>
                  <div className="w-full rounded-t-lg border-2 border-ink bg-coral" style={{ height: `${Math.max(4, (w.minutes / maxDay) * 90)}px`, opacity: w.minutes ? 1 : 0.25 }} />
                  <span className="text-[11px] font-extrabold text-ink-soft">
                    {w.d === todayISO() ? "Today" : new Date(w.d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm font-extrabold">
              {focus.weekTotal >= 60 ? `${Math.floor(focus.weekTotal / 60)} h ${focus.weekTotal % 60} min` : `${focus.weekTotal} min`} of deep focus this week 🌼
            </p>
          </Panel>
        </>
      )}

      {tab === "calm" && (
        <section className="sticker-flat flex flex-col gap-3 rounded-[28px] bg-linear-to-b from-sky-soft to-lilac-soft p-4">
          <Breathe />
        </section>
      )}

      {tab === "jar" && (
        <>
          <section className="sticker-flat flex flex-col items-center gap-3 rounded-[28px] bg-linear-to-b from-sun-soft to-peach-soft p-4">
            <JarShake notes={jar.map((j) => ({ id: j.id, text: j.text, emoji: j.emoji, day: j.day, from: j.fromUserId && j.fromUserId !== me.spaceId ? nameOf(j.fromUserId) : "" }))} />
          </section>
          <Panel title="Add a happy moment" icon="jar">
            <ActionForm action={addToJar} className="flex flex-col gap-2.5">
              <textarea name="text" required maxLength={400} rows={2} placeholder={ro ? `Something lovely about ${me.ownerName} or a moment together` : "Something small that made you smile today"} className="field py-2.5" />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pick an emoji">
                {JAR_EMOJI.map((e, i) => (
                  <label key={e} className="cursor-pointer">
                    <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-white text-xl peer-checked:bg-sun">{e}</span>
                  </label>
                ))}
              </div>
              <SubmitButton className="self-start bg-sun">Drop it in the jar</SubmitButton>
            </ActionForm>
          </Panel>
          {jar.length > 0 && (
            <Panel title="All happy moments" icon="star">
              <ul className="flex flex-col gap-1.5">
                {jar.slice(0, 60).map((j) => (
                  <li key={j.id} className="flex items-start gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2">
                    <span className="text-xl">{j.emoji}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-bold">{j.text}</span>
                      <span className="text-xs font-extrabold text-ink-soft">
                        {j.day}
                        {j.fromUserId && j.fromUserId !== me.spaceId ? `, from ${nameOf(j.fromUserId)}` : ""}
                      </span>
                    </span>
                    {(!ro || j.fromUserId === me.id) && (
                      <ActButton action={deleteJar.bind(null, j.id)} confirmText="Take this out of the jar?" label="Delete" className="rounded-full p-1">
                        <Icon name="trash" size={16} />
                      </ActButton>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {tab === "days" && (
        <>
          {days.length === 0 ? (
            <p className="sticker rounded-[24px] bg-white p-4 text-[15px] font-bold">
              Nothing to count down to yet. Add a trip, a birthday, your anniversary, the end of exams. Chichi shows the closest one on Home 🎉
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {days.map((d, i) => (
                <div key={d.id} className={`sticker-flat relative flex flex-col items-center gap-0.5 rounded-[24px] p-3 text-center ${i === 0 ? "bg-linear-to-b from-sun to-peach" : "bg-linear-to-b from-white to-peach-soft"}`}>
                  <span className="text-3xl">{d.emoji}</span>
                  <span className="font-display text-[28px] font-bold leading-none">{d.days === 0 ? "🎉" : d.days}</span>
                  <span className="text-xs font-extrabold">{d.days === 0 ? "Today!" : d.days === 1 ? "day to go" : "days to go"}</span>
                  <span className="mt-1 line-clamp-2 text-sm font-extrabold">{d.title}</span>
                  <span className="text-[11px] font-bold text-ink-soft">
                    {d.on}
                    {d.yearly ? ", every year" : ""}
                  </span>
                  {!ro && (
                    <span className="absolute right-1.5 top-1.5">
                      <ActButton action={deleteCountdown.bind(null, d.id)} confirmText="Delete this countdown?" label="Delete" className="rounded-full p-1">
                        <Icon name="close" size={14} />
                      </ActButton>
                    </span>
                  )}
                  <span className="sr-only">{prettyDays(d.days)}</span>
                </div>
              ))}
            </div>
          )}
          {!ro && (
            <Panel title="New countdown" icon="party">
              <ActionForm action={addCountdown} className="flex flex-col gap-2.5">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_11rem]">
                  <Label text="What">
                    <input name="title" required maxLength={80} placeholder="Trip to Bali, our anniversary" className="field" />
                  </Label>
                  <Label text="When">
                    <input name="day" type="date" required className="field" />
                  </Label>
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pick an emoji">
                  {DAY_EMOJI.map((e, i) => (
                    <label key={e} className="cursor-pointer">
                      <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-white text-xl peer-checked:bg-sun">{e}</span>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm font-extrabold">
                  <input type="checkbox" name="yearly" className="size-5 accent-[#FF8A5C]" /> Every year (birthdays, anniversaries)
                </label>
                <SubmitButton className="self-start bg-sun">Add countdown</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </>
      )}
      {tab === "bucket" && (
        <>
          <section className="sticker-flat flex flex-col gap-2 rounded-[28px] bg-linear-to-b from-sky-soft to-lilac-soft p-4">
            <p className="font-display text-xl font-semibold">Things we&apos;ll do together ✨</p>
            <p className="text-[13px] font-semibold text-ink-soft">
              {bucket.filter((b) => b.doneAt).length} done, {bucket.filter((b) => !b.doneAt).length} to go. Both of you can add and tick things off.
            </p>
            {bucket.length === 0 ? (
              <p className="rounded-2xl bg-white/80 p-3 text-[14px] font-semibold">Start your list: watch the sunrise at Bukit Broga, a picnic at the lake, learn to cook rendang together</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {[...bucket.filter((b) => !b.doneAt), ...bucket.filter((b) => b.doneAt)].map((b) => (
                  <li key={b.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                    <ActButton action={toggleBucket.bind(null, b.id)} label={b.doneAt ? "Mark not done" : "Mark done"} className={`flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-line-strong)] ${b.doneAt ? "bg-mint" : "bg-white"}`}>
                      {b.doneAt ? <Icon name="check" size={14} /> : null}
                    </ActButton>
                    <span className="text-xl">{b.emoji}</span>
                    <span className={`min-w-0 flex-1 text-[15px] font-bold ${b.doneAt ? "text-ink-soft line-through" : ""}`}>
                      {b.title}
                      {b.doneAt && <span className="ml-1 text-[11px] font-semibold no-underline">done {b.doneAt.toISOString().slice(0, 10)}</span>}
                    </span>
                    {(!ro || b.addedBy === me.id) && (
                      <ActButton action={deleteBucket.bind(null, b.id)} confirmText="Remove this from the list?" label="Delete" className="rounded-full p-1 text-ink-soft">
                        <Icon name="trash" size={14} />
                      </ActButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Panel title="Add a dream" icon="star">
            <ActionForm action={addBucket} className="flex flex-col gap-2.5">
              <input name="title" required maxLength={120} placeholder="Go to Japan in spring, a beach sunset date" className="field" />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pick an emoji">
                {BUCKET_EMOJI.map((e, i) => (
                  <label key={e} className="cursor-pointer">
                    <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-white text-xl peer-checked:bg-sun">{e}</span>
                  </label>
                ))}
              </div>
              <SubmitButton className="self-start bg-sun">Add to our list</SubmitButton>
            </ActionForm>
          </Panel>
        </>
      )}

      {tab !== "focus" && !ro && (
        <p className="flex items-center gap-2 px-1 text-xs font-bold text-ink-soft">
          <CuteIcon name="bulb" size={18} /> Tip: tell Chichi &quot;add our anniversary on 14 Feb every year&quot; or &quot;put today&apos;s sushi date in my happy jar&quot;.
        </p>
      )}
    </div>
  );
}
