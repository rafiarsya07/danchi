import { Checklist } from "@/components/list-panel";
import { addListItem, removeListItem } from "@/app/(app)/life-actions";
import { Attachments } from "@/components/attachments";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { TaskCheck } from "@/components/task-row";
import { Badge, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addNote, addProjectExpense, addProjectTask, deleteProject, setProjectStatus } from "@/app/(app)/more-actions";
import { colorOf } from "@/lib/constants";
import { getSettings } from "@/lib/data";
import { getProject } from "@/lib/data2";
import { money, prettyDay, dayPhrase } from "@/lib/format";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "projects"))) return <PrivatePage ownerName={me.ownerName} what="Projects" />;
  const ro = me.role === "viewer";
  const id = (await params).id;
  const [data, s] = await Promise.all([getProject(me.spaceId, id), getSettings(me.spaceId)]);
  if (!data) notFound();
  const { project: p, tasks, notes, tx, spent } = data;
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title={`${p.emoji} ${p.name}`} subtitle={[p.dueOn ? `Due ${dayPhrase(p.dueOn)}` : null, `${done}/${tasks.length} tasks done`].filter(Boolean).join(", ")}>
        {!ro && (
          <ActButton action={deleteProject.bind(null, p.id)} confirmText={`Delete ${p.name}? Its tasks and notes stay, just unlinked.`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <Icon name="trash" size={18} />
          </ActButton>
        )}
      </PageTitle>
      {p.description && <p className={`rounded-[22px] border-2 border-ink p-3 text-[15px] font-bold ${colorOf(p.color).soft}`}>{p.description}</p>}
      {!ro && (
        <div className="flex gap-2">
          {(["active", "paused", "done"] as const).map((st) => (
            <ActButton key={st} action={setProjectStatus.bind(null, p.id, st)} className={`h-9 rounded-full border-2 border-ink px-3 text-sm font-extrabold capitalize ${p.status === st ? "bg-sun shadow-[0_3px_0_#2E2240]" : "bg-white"}`}>
              {st}
            </ActButton>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Tasks" icon="tasks" tone="bg-white">
          {!ro && (
            <ActionForm action={addProjectTask} className="flex gap-2">
              <input type="hidden" name="projectId" value={p.id} />
              <input name="title" required maxLength={140} placeholder="Add a task" className="field h-11 min-w-0 flex-1" />
              <input name="dueOn" type="date" aria-label="Due" className="field h-11 w-36 px-2" />
              <button type="submit" aria-label="Add task" className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-sun">
                <Icon name="plus" size={20} stroke={3} />
              </button>
            </ActionForm>
          )}
          {tasks.length === 0 ? (
            <p className="text-sm font-bold text-ink-soft">No tasks yet.</p>
          ) : (
            <div>
              {tasks.map((t) => (
                <TaskCheck key={t.id} id={t.id} title={t.title} done={t.done} meta={t.dueOn ? prettyDay(t.dueOn) : undefined} readOnly={ro} showDelete />
              ))}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Money" icon="money" tone="bg-pink-soft" right={<Badge className="bg-white">{money(spent, s.currency)}</Badge>}>
            {!ro && (
              <ActionForm action={addProjectExpense} className="flex gap-2">
                <input type="hidden" name="projectId" value={p.id} />
                <input name="amount" type="number" step="0.01" min="0" required placeholder={s.currency} aria-label="Amount" className="field h-11 w-24" />
                <input name="note" maxLength={120} placeholder="What for?" className="field h-11 min-w-0 flex-1" />
                <button type="submit" aria-label="Add expense" className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-sun">
                  <Icon name="plus" size={20} stroke={3} />
                </button>
              </ActionForm>
            )}
            {tx.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm font-bold">
                <span className="min-w-0 flex-1 truncate">{t.note || t.category}</span>
                <span className="text-xs text-ink-soft">{prettyDay(t.occurredOn)}</span>
                <span className="font-extrabold">{money(t.amountCents, s.currency)}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Notes" icon="notes" tone="bg-lilac-soft">
            {!ro && (
              <ActionForm action={addNote} className="flex flex-col gap-2">
                <input type="hidden" name="kind" value="note" />
                <input type="hidden" name="projectId" value={p.id} />
                <input name="title" maxLength={140} placeholder="Meeting notes, ideas" className="field h-11" />
                <textarea name="body" rows={3} maxLength={20000} placeholder="Write" className="field py-2" />
                <SubmitButton className="h-10 self-start text-base">Save note</SubmitButton>
              </ActionForm>
            )}
            {notes.filter((n) => !ro || !n.private).map((n) => (
              <Link key={n.id} href={`/notes/${n.id}`} className="rounded-xl border-2 border-ink bg-white px-3 py-2">
                <span className="block truncate text-sm font-extrabold">{n.title || "Untitled"}</span>
                <span className="block text-xs font-bold text-ink-soft">{prettyWhen(n.updatedAt)}</span>
              </Link>
            ))}
          </Panel>

          <Panel title="Submission checklist" icon="tasks" tone="bg-mint-soft">
            <Checklist table="project" id={p.id} items={p.checklist} ro={ro} placeholder="Report PDF, slides, demo video" />
          </Panel>

          <Panel title="Team" icon="projects" tone="bg-sky-soft">
            {p.team.length === 0 && <p className="text-sm font-bold text-ink-soft">Who&apos;s in it? Names, roles, contacts.</p>}
            {p.team.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold">
                <span className="min-w-0 flex-1 truncate">
                  👤 <b>{m.name}</b>
                  {m.role ? `, ${m.role}` : ""}
                </span>
                {m.contact && <span className="truncate text-xs text-ink-soft">{m.contact}</span>}
                {!ro && (
                  <ActButton action={removeListItem.bind(null, "project", p.id, "team", i)} label="Remove" className="text-ink-soft">
                    <Icon name="close" size={14} />
                  </ActButton>
                )}
              </div>
            ))}
            {!ro && (
              <ActionForm action={addListItem} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="table" value="project" />
                <input type="hidden" name="field" value="team" />
                <input type="hidden" name="id" value={p.id} />
                <input name="name" required maxLength={60} placeholder="Name" className="field h-11" />
                <input name="role" maxLength={60} placeholder="Role (slides, coding...)" className="field h-11" />
                <input name="contact" maxLength={80} placeholder="Phone or email" className="field h-11" />
                <SubmitButton className="h-11 text-base">Add</SubmitButton>
              </ActionForm>
            )}
          </Panel>

          <Panel title="Links, research and datasets" icon="search" tone="bg-white">
            {p.links.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-bold">
                <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline">
                  🔗 {l.title}
                </a>
                {!ro && (
                  <ActButton action={removeListItem.bind(null, "project", p.id, "links", i)} label="Remove" className="text-ink-soft">
                    <Icon name="close" size={14} />
                  </ActButton>
                )}
              </div>
            ))}
            {!ro && (
              <ActionForm action={addListItem} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <input type="hidden" name="table" value="project" />
                <input type="hidden" name="field" value="links" />
                <input type="hidden" name="id" value={p.id} />
                <input name="title" maxLength={80} placeholder="Name" className="field h-11" />
                <input name="url" type="url" required maxLength={500} placeholder="https://" className="field h-11" />
                <SubmitButton className="h-11 px-3 text-base">Add</SubmitButton>
              </ActionForm>
            )}
          </Panel>

          <Panel title="Files" icon="clip" tone="bg-white">
            <Attachments spaceId={me.spaceId} refType="project" refId={p.id} canEdit={!ro} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
