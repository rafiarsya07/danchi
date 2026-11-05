import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { ActButton, ActionForm } from "@/components/action-form";
import { CuteIcon } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { Badge, ColorPick, Empty, Label, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addAssignment, addCourse, addDeck, addExam, archiveCourse, deleteAssignment, deleteExam, setAssignmentStatus } from "@/app/(app)/more-actions";
import { colorOf } from "@/lib/constants";
import { getAssignments, getCourses, getDecks, getExams, type Course } from "@/lib/data2";
import { todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";
import { daysUntilAt, msUntil, prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Study" };

function until(d: Date) {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "passed";
  const h = Math.round(ms / 3600_000);
  if (h < 24) return h <= 1 ? "within the hour" : `in ${h} hours`;
  const days = Math.round(h / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

function CourseSelect({ courses }: { courses: Course[] }) {
  return (
    <select name="courseId" defaultValue="" className="field px-2">
      <option value="">No course</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code ? `${c.code} ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );
}

export default async function StudyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "study"))) return <PrivatePage ownerName={me.ownerName} what="Study" />;
  const ro = me.role === "viewer";
  const tab = (await searchParams).tab ?? "assignments";
  const [courses, asg, exams, decks] = await Promise.all([getCourses(me.spaceId, true), getAssignments(me.spaceId), getExams(me.spaceId), getDecks(me.spaceId)]);
  const active = courses.filter((c) => !c.archived);
  const courseOf = (id: string | null) => courses.find((c) => c.id === id);
  const dueCards = decks.reduce((s, d) => s + d.due, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Study" icon="study" subtitle={exams.upcoming[0] ? `Next exam ${until(exams.upcoming[0].at)}` : "Your little academic hub"} />
      <Tabs
        base="/study"
        current={tab}
        tabs={[
          { key: "assignments", label: "Assignments", icon: "tasks", count: asg.open.length },
          { key: "exams", label: "Exams", icon: "exam", count: exams.upcoming.length },
          { key: "cards", label: "Flashcards", icon: "cards", count: dueCards },
          { key: "courses", label: "Courses", icon: "study", count: active.length },
        ]}
      />

      {tab === "assignments" && (
        <>
          {!ro && (
            <Panel tone="bg-sky" title="New assignment" icon="tasks">
              <ActionForm action={addAssignment} className="flex flex-col gap-2.5">
                <input name="title" required maxLength={140} placeholder="Essay, lab report, quiz" className="field" />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Label text="Course">
                    <CourseSelect courses={active} />
                  </Label>
                  <Label text="Due day">
                    <input name="date" type="date" className="field px-2" />
                  </Label>
                  <Label text="Time">
                    <input name="time" type="time" defaultValue="23:59" className="field px-2" />
                  </Label>
                  <Label text="Worth">
                    <input name="weight" placeholder="20%" maxLength={30} className="field" />
                  </Label>
                </div>
                <SubmitButton className="self-start">Add it</SubmitButton>
              </ActionForm>
              <p className="text-xs font-bold">Chichi reminds you the evening before and the morning it&apos;s due 🌙☀️</p>
            </Panel>
          )}
          {asg.open.length === 0 ? (
            <Empty mood="cheer" title="No assignments!" text="Enjoy the free time 🌸" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {asg.open.map((a) => {
                const c = courseOf(a.courseId);
                const late = !!a.dueAt && msUntil(a.dueAt) < 0;
                return (
                  <div key={a.id} className={`flex items-center gap-3 rounded-[22px] border-[2.5px] border-ink p-3 ${late ? "bg-pink-soft" : "bg-white"} shadow-[0_3px_0_#2E2240]`}>
                    <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink ${colorOf(c?.color).soft}`}>
                      <CuteIcon name="study" size={34} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-extrabold">{a.title}</span>
                      <span className="flex flex-wrap gap-1.5 text-xs font-bold text-ink-soft">
                        {c && <span>{c.code ?? c.name}</span>}
                        {a.dueAt && <span className={late ? "text-coral" : ""}>{late ? "Late!" : prettyWhen(a.dueAt)}</span>}
                        {a.weight && <span>{a.weight}</span>}
                      </span>
                    </div>
                    {!ro && (
                      <div className="flex shrink-0 items-center gap-1">
                        <ActButton
                          action={setAssignmentStatus.bind(null, a.id, a.status === "todo" ? "doing" : "done")}
                          className={`h-9 rounded-xl border-2 border-ink px-2.5 text-xs font-extrabold ${a.status === "doing" ? "bg-mint" : "bg-sun"}`}
                        >
                          {a.status === "todo" ? "Start" : "Done ✓"}
                        </ActButton>
                        <ActButton action={deleteAssignment.bind(null, a.id)} confirmText={`Delete ${a.title}?`} label={`Delete ${a.title}`} className="flex size-9 items-center justify-center rounded-xl text-ink-soft">
                          <Icon name="trash" size={17} />
                        </ActButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {asg.done.length > 0 && (
            <details className="rounded-[22px] border-[2.5px] border-ink bg-mint-soft px-4 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold">Finished ({asg.done.length})</summary>
              {asg.done.map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-1 text-sm font-bold">
                  <span className="min-w-0 flex-1 truncate line-through opacity-60">{a.title}</span>
                  {!ro && (
                    <ActButton action={setAssignmentStatus.bind(null, a.id, "todo")} className="text-xs font-extrabold underline">
                      Undo
                    </ActButton>
                  )}
                </div>
              ))}
            </details>
          )}
        </>
      )}

      {tab === "exams" && (
        <>
          {!ro && (
            <Panel tone="bg-pink" title="New exam" icon="exam">
              <ActionForm action={addExam} className="flex flex-col gap-2.5">
                <input name="title" required maxLength={140} placeholder="Final, midterm, quiz" className="field" />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Label text="Course">
                    <CourseSelect courses={active} />
                  </Label>
                  <Label text="Day">
                    <input name="date" type="date" required defaultValue={todayISO()} className="field px-2" />
                  </Label>
                  <Label text="Time">
                    <input name="time" type="time" defaultValue="09:00" className="field px-2" />
                  </Label>
                  <Label text="Room">
                    <input name="room" placeholder="DK1" maxLength={60} className="field" />
                  </Label>
                </div>
                <SubmitButton className="self-start">Add exam</SubmitButton>
              </ActionForm>
              <p className="text-xs font-bold">Chichi reminds you 3 days before, the night before, and 2 hours before 📖</p>
            </Panel>
          )}
          {exams.upcoming.length === 0 ? (
            <Empty mood="happy" title="No exams coming" text="Add them here and I'll count down with you." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {exams.upcoming.map((e) => {
                const c = courseOf(e.courseId);
                const days = daysUntilAt(e.at);
                return (
                  <div key={e.id} className={`sticker flex items-center gap-3 rounded-[24px] p-3 ${colorOf(c?.color).soft}`}>
                    <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border-[2.5px] border-ink bg-white leading-none">
                      <span className="font-display text-2xl font-bold">{days}</span>
                      <span className="text-[10px] font-extrabold">{days === 1 ? "day" : "days"}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-extrabold">{e.title}</span>
                      <span className="text-xs font-bold text-ink-soft">{prettyWhen(e.at)}</span>
                      <span className="text-xs font-bold text-ink-soft">{[c?.code ?? c?.name, e.room].filter(Boolean).join(", ")}</span>
                    </div>
                    {!ro && (
                      <ActButton action={deleteExam.bind(null, e.id)} confirmText={`Delete ${e.title}?`} label={`Delete ${e.title}`} className="flex size-9 items-center justify-center rounded-xl text-ink-soft">
                        <Icon name="trash" size={17} />
                      </ActButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "cards" && (
        <>
          {!ro && (
            <Panel tone="bg-lilac" title="New deck" icon="cards">
              <ActionForm action={addDeck} className="flex flex-wrap gap-2.5">
                <input name="name" required maxLength={80} placeholder="Biology chapter 3" className="field min-w-48 flex-1" />
                <select name="kind" defaultValue="flashcards" aria-label="Type" className="field w-40 px-2">
                  <option value="flashcards">🧠 Flashcards</option>
                  <option value="quiz">📝 Quiz questions</option>
                  <option value="midterm">📄 Midterm questions</option>
                  <option value="pastyear">📚 Past year</option>
                  <option value="practice">✍️ Practice</option>
                </select>
                <div className="w-44">
                  <CourseSelect courses={active} />
                </div>
                <SubmitButton>Create</SubmitButton>
              </ActionForm>
            </Panel>
          )}
          {decks.length === 0 ? (
            <Empty mood="think" title="No flashcards yet" text="Make a deck, add cards, and I'll show each one right when you're about to forget it 🧠" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {decks.map((d) => (
                <Link key={d.id} href={`/study/deck/${d.id}`} className="sticker press flex items-center gap-3 rounded-[24px] bg-white p-3">
                  <CuteIcon name="cards" size={48} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-extrabold">{d.name}</span>
                    <span className="text-xs font-bold text-ink-soft">{d.total} cards</span>
                  </div>
                  {d.due > 0 ? <Badge className="bg-sun">{d.due} to review</Badge> : <Badge className="bg-mint">All caught up</Badge>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "courses" && (
        <>
          {!ro && (
            <Panel tone="bg-sun" title="New course" icon="study">
              <ActionForm action={addCourse} className="flex flex-col gap-2.5">
                <div className="grid grid-cols-[1fr_7rem] gap-2.5">
                  <input name="name" required maxLength={80} placeholder="Course name" className="field" />
                  <input name="code" maxLength={20} placeholder="Code" className="field" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input name="lecturer" maxLength={80} placeholder="Lecturer" className="field" />
                  <input name="room" maxLength={40} placeholder="Room" className="field" />
                  <input name="schedule" maxLength={120} placeholder="Mon 10:00, Wed 14:00" className="field" />
                  <input name="semester" maxLength={40} placeholder="Semester 1, 2026/27" className="field" />
                </div>
                <ColorPick value="sky" />
                <SubmitButton className="self-start">Add course</SubmitButton>
              </ActionForm>
            </Panel>
          )}
          {courses.length === 0 ? (
            <Empty mood="wave" title="No courses yet" text="Add your courses so assignments, exams and notes can live together." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => {
                const n = asg.open.filter((a) => a.courseId === c.id).length;
                const ex = exams.upcoming.find((e) => e.courseId === c.id);
                return (
                  <div key={c.id} className={`sticker flex flex-col gap-1.5 rounded-[24px] p-3.5 ${colorOf(c.color).soft} ${c.archived ? "opacity-55" : ""}`}>
                    <div className="flex items-center gap-2">
                      {c.code && <Badge className={colorOf(c.color).strong}>{c.code}</Badge>}
                      <Link href={`/study/course/${c.id}`} className="min-w-0 flex-1 truncate text-[15px] font-extrabold underline-offset-2 hover:underline">
                        {c.name}
                      </Link>
                      {!ro && (
                        <ActButton action={archiveCourse.bind(null, c.id)} className="text-xs font-extrabold underline">
                          {c.archived ? "Restore" : "Archive"}
                        </ActButton>
                      )}
                    </div>
                    {(c.lecturer || c.room || c.schedule) && (
                      <span className="text-xs font-bold text-ink-soft">{[c.lecturer, c.room, c.schedule].filter(Boolean).join(", ")}</span>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge className="bg-white">{n} to do</Badge>
                      {ex && <Badge className="bg-white">Exam {until(ex.at)}</Badge>}
                      <Link href={`/study/course/${c.id}`} className="ml-auto rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold">
                        Open: notes, files, questions →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
