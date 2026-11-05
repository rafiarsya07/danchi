import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { AskChichiLink } from "@/components/ask-chichi-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { planRevision } from "@/app/(app)/life-actions";
import { Attachments } from "@/components/attachments";
import { Checklist } from "@/components/list-panel";
import { PrivatePage } from "@/components/private-page";
import { Badge, PageTitle, Panel, Ring, SubmitButton } from "@/components/ui";
import { addDeck, addNote } from "@/app/(app)/more-actions";
import { colorOf } from "@/lib/constants";
import { getCourse } from "@/lib/data4";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Course" };

const DECK: Record<string, { e: string; t: string; icon: CuteIconName }> = {
  flashcards: { e: "🧠", t: "Flashcards", icon: "cards" },
  quiz: { e: "📝", t: "Quiz questions", icon: "question" },
  midterm: { e: "📄", t: "Midterm questions", icon: "exam" },
  pastyear: { e: "📚", t: "Past year questions", icon: "book" },
  practice: { e: "✍️", t: "Practice", icon: "pencil" },
};

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "study"))) return <PrivatePage ownerName={me.ownerName} what="Study" />;
  const data = await getCourse(me.spaceId, (await params).id);
  if (!data) notFound();
  const ro = me.role === "viewer";
  const { course: c, asg, exams, decks, notes, progress } = data;
  const nextExam = exams.find((e) => e.at > new Date());

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title={c.name} icon="study" help={false} subtitle={[c.code, c.semester, c.lecturer].filter(Boolean).join(", ") || "Course"} />

        <section className={`sticker flex items-center gap-4 rounded-[26px] p-4 ${colorOf(c.color).soft}`}>
          <Ring value={progress} max={100} size={86}>
            <span className="font-display text-xl font-bold">{progress}%</span>
          </Ring>
          <div className="flex min-w-0 flex-col gap-1 text-sm font-bold">
            <span className="font-display text-lg font-bold">Study progress</span>
            <span>
              {asg.filter((a) => a.status === "done").length}/{asg.length} assignments, {c.checklist.filter((x) => x.done).length}/{c.checklist.length} revision steps
            </span>
            {nextExam && <span>📖 Next exam: {nextExam.title}, {prettyWhen(nextExam.at)}</span>}
            {c.schedule && <span>🕘 {c.schedule}{c.room ? `, ${c.room}` : ""}</span>}
          </div>
        </section>

        {!ro && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <AskChichiLink q={`Quiz me on ${c.name}${c.code ? ` (${c.code})` : ""}: ask me 5 questions one at a time, wait for my answer, then tell me if I'm right and explain.`} label="Quiz me" hint="5 questions, one at a time" />
            <AskChichiLink q={`I'm studying ${c.name}${c.code ? ` (${c.code})` : ""}. Explain the hardest topic in it simply with an example, then ask me what I want to go through next.`} label="Explain it simply" hint="Like a smart friend would" />
          </div>
        )}

        <Panel title="Revision checklist" icon="tasks">
          <Checklist table="course" id={c.id} items={c.checklist} ro={ro} placeholder="Chapter 3 summary, past year 2024" />
          {!ro && c.checklist.some((x) => !x.done) && (
            <div className="flex flex-wrap items-center gap-2">
              <ActButton action={planRevision.bind(null, c.id)} done="Added {n} study tasks to your days ✨" className="sticker-sm press flex h-11 items-center gap-1.5 rounded-2xl bg-sun px-3.5 text-sm font-extrabold">
                <CuteIcon name="calendar" size={24} /> Plan my revision
              </ActButton>
              <span className="text-xs font-bold text-ink-soft">Spreads the unticked steps over the days before {nextExam ? "the exam" : "next week"}.</span>
            </div>
          )}
        </Panel>

        <Panel title="Assignments and exams" icon="exam">
          {asg.length === 0 && exams.length === 0 && <p className="text-sm font-bold text-ink-soft">Nothing yet. Add them in Study.</p>}
          {asg.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm font-bold">
              <span>{a.status === "done" ? "✅" : "📚"}</span>
              <span className={`min-w-0 flex-1 truncate ${a.status === "done" ? "text-ink-soft line-through" : ""}`}>{a.title}</span>
              {a.dueAt && <span className="text-xs text-ink-soft">{prettyWhen(a.dueAt)}</span>}
            </div>
          ))}
          {exams.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm font-bold">
              <span>📖</span>
              <span className="min-w-0 flex-1 truncate">{e.title}</span>
              <span className="text-xs text-ink-soft">{prettyWhen(e.at)}</span>
            </div>
          ))}
          <Link href="/study" className="self-start text-sm font-extrabold underline">
            Add in Study
          </Link>
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:pt-[68px]">
        <Panel title="Lecture slides and files" icon="clip">
          <p className="text-xs font-bold text-ink-soft">Upload PDFs or photos of notes. Chichi can summarize them or turn them into flashcards and practice questions ✨</p>
          <Attachments spaceId={me.spaceId} refType="course" refId={c.id} canEdit={!ro} />
        </Panel>

        <Panel title="Question banks and flashcards" icon="cards">
          {decks.length === 0 && <p className="text-sm font-bold text-ink-soft">Quiz, midterm, past year and practice questions live here, ready to review like flashcards.</p>}
          {decks.map((d) => (
            <Link key={d.id} href={`/study/deck/${d.id}`} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold">
              <CuteIcon name={DECK[d.kind]?.icon ?? "cards"} size={28} />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <Badge className="bg-lilac-soft">{DECK[d.kind]?.t ?? "Cards"}</Badge>
              <span className="text-xs text-ink-soft">{d.cards}</span>
            </Link>
          ))}
          {!ro && (
            <ActionForm action={addDeck} className="flex flex-col gap-2">
              <input type="hidden" name="courseId" value={c.id} />
              <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
                <input name="name" required maxLength={80} placeholder="Midterm 2024" className="field h-11" />
                <select name="kind" defaultValue="pastyear" aria-label="Type" className="field h-11 px-2">
                  {Object.entries(DECK).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.e} {v.t}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="h-11 self-start px-4 text-base">Create</SubmitButton>
            </ActionForm>
          )}
        </Panel>

        <Panel title="Lecture notes" icon="notes">
          {notes.filter((n) => !ro || !n.private).map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="rounded-xl border-2 border-ink bg-white px-3 py-2">
              <span className="block truncate text-sm font-extrabold">{n.title || "Untitled"}</span>
              <span className="block text-xs font-bold text-ink-soft">{prettyWhen(n.updatedAt)}</span>
            </Link>
          ))}
          {!ro && (
            <ActionForm action={addNote} className="flex flex-col gap-2">
              <input type="hidden" name="kind" value="note" />
              <input type="hidden" name="courseId" value={c.id} />
              <input name="title" maxLength={140} placeholder="Week 3: Linked lists" className="field h-11" />
              <textarea name="body" rows={3} maxLength={20000} placeholder="Notes from the lecture" className="field py-2" />
              <SubmitButton className="h-10 self-start text-base">Save note</SubmitButton>
            </ActionForm>
          )}
        </Panel>
      </div>
    </div>
  );
}
