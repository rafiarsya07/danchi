import { CuteIcon } from "@/components/cute-icon";
import type { Metadata } from "next";
import Link from "next/link";
import { ActButton, ActionForm } from "@/components/action-form";
import { PrivatePage } from "@/components/private-page";
import { Empty, Label, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addLearning, bumpProgress, logLearning } from "@/app/(app)/life-actions";
import { getLearning } from "@/lib/data4";
import { LEARN_KINDS, LEARN_STATUS } from "@/lib/learn";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Learning" };

const TABS = [
  { key: "learn", label: "Learning", icon: "study" as const },
  { key: "skills", label: "Skills", icon: "habits" as const },
  { key: "certs", label: "Certificates", icon: "wish" as const },
  { key: "links", label: "Resources", icon: "notes" as const },
];

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "learn"))) return <PrivatePage ownerName={me.ownerName} what="Learning" />;
  const ro = me.role === "viewer";
  const want = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === want)?.key ?? "learn";
  const { items, logs, week, weekMinutes } = await getLearning(me.spaceId);
  const shown = items.filter((i) => (LEARN_KINDS[i.kind] ?? LEARN_KINDS.goal).tab === tab);
  const peak = Math.max(30, ...week.map((d) => d.minutes));
  const doing = items.filter((i) => i.status === "doing" && LEARN_KINDS[i.kind]?.tab === "learn");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Learning" icon="learn" help="learn" subtitle="Your growth: goals, courses, books, skills, certificates" />

      <section className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display flex-1 text-lg font-bold">This week</h2>
          <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold">
            {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m learned
          </span>
        </div>
        <div className="flex h-24 items-end gap-2" aria-label="Minutes learned each day this week">
          {week.map((d) => (
            <div key={d.d} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-extrabold text-ink-soft">{d.minutes || ""}</span>
              <div className="w-full max-w-7 rounded-t-lg border-2 border-b-0 border-ink bg-mint" style={{ height: `${Math.max(4, (d.minutes / peak) * 100)}%` }} />
              <span className="text-[10px] font-extrabold">{new Date(d.d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
        {!ro && (
          <ActionForm action={logLearning} okText="Logged 🌱 Keep going!" className="flex flex-col gap-2">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
              <input name="minutes" type="number" min={1} max={1440} required placeholder="min" aria-label="Minutes" className="field" />
              <select name="learningId" defaultValue="" aria-label="What" className="field px-2">
                <option value="">What did you study?</option>
                {doing.map((i) => (
                  <option key={i.id} value={i.id}>
                    {LEARN_KINDS[i.kind]?.emoji} {i.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input name="note" maxLength={300} placeholder="What did you learn? (your weekly learning journal)" className="field" />
              <SubmitButton className="h-12 shrink-0 bg-white px-4 text-base">Log</SubmitButton>
            </div>
          </ActionForm>
        )}
        {logs.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-extrabold underline">Learning journal ({logs.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {logs.slice(0, 20).map((l) => (
                <li key={l.id} className="flex gap-2 text-sm font-bold">
                  <span className="shrink-0 text-xs text-ink-soft">{prettyWhen(l.createdAt)}</span>
                  <span>
                    {l.minutes} min{l.note ? `, ${l.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Tabs base="/learn" current={tab} tabs={TABS.map((t) => ({ ...t, count: items.filter((i) => LEARN_KINDS[i.kind]?.tab === t.key).length || undefined }))} />

      {shown.length === 0 ? (
        <Empty
          mood="think"
          title="Nothing here yet"
          text={
            tab === "learn"
              ? "Add a goal (\"Get good at Python\"), a course, a book or a tutorial. Track progress with one tap."
              : tab === "skills"
                ? "Skills you're building, with a level from 1 to 5."
                : tab === "certs"
                  ? "Collect your certificates here, attach the PDF."
                  : "Save useful links, books and articles."
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((i) => {
            const k = LEARN_KINDS[i.kind] ?? LEARN_KINDS.goal;
            const st = LEARN_STATUS[i.status] ?? LEARN_STATUS.doing;
            return (
              <div key={i.id} className="sticker flex flex-col gap-2 rounded-[22px] bg-white p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-linear-to-br from-mint-soft to-sky-soft">
                    <CuteIcon name={k.icon} size={36} />
                  </span>
                  <Link href={`/learn/${i.id}`} className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[15px] font-extrabold">{i.title}</span>
                    <span className="text-xs font-bold text-ink-soft">
                      {k.label}
                      {i.kind === "skill" && i.level ? `, ${"★".repeat(i.level)}${"☆".repeat(5 - i.level)}` : ""}
                    </span>
                  </Link>
                  {i.kind !== "skill" && i.kind !== "resource" && i.kind !== "certificate" && (
                    <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${st.cls}`}>{st.label}</span>
                  )}
                  {i.link && (
                    <a href={i.link} target="_blank" rel="noreferrer" aria-label="Open link" className="flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-sky-soft text-sm">
                      🔗
                    </a>
                  )}
                </div>
                {tab === "learn" && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-3.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-cream">
                      <div className="bg-mint" style={{ width: `${i.progress}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs font-extrabold">{i.progress}%</span>
                    {!ro && i.progress < 100 && (
                      <ActButton action={bumpProgress.bind(null, i.id, 10)} className="h-8 rounded-xl border-2 border-ink bg-sun px-2 text-xs font-extrabold">
                        +10%
                      </ActButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!ro && (
        <Panel title="Add" icon="habits" tone="bg-sun-soft">
          <ActionForm action={addLearning} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
              <input name="title" required maxLength={120} placeholder={tab === "skills" ? "Python, Canva, public speaking" : tab === "certs" ? "Google Data Analytics" : "What do you want to learn?"} className="field" />
              <select
                name="kind"
                defaultValue={tab === "skills" ? "skill" : tab === "certs" ? "certificate" : tab === "links" ? "resource" : "goal"}
                aria-label="Type"
                className="field px-2"
              >
                {Object.entries(LEARN_KINDS).map(([key, v]) => (
                  <option key={key} value={key}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input name="link" type="url" maxLength={500} placeholder="Link (optional)" className="field" />
              {tab === "skills" ? (
                <Label text="Level now (1 to 5)">
                  <input name="level" type="number" min={1} max={5} defaultValue={1} className="field" />
                </Label>
              ) : (
                <input name="dueOn" type="date" aria-label="Target date" className="field px-2" />
              )}
            </div>
            <SubmitButton className="self-start bg-white">Add</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
