import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { AddTaskForm } from "@/components/add-forms";
import { CuteIcon } from "@/components/cute-icon";
import { TaskCheck } from "@/components/task-row";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { db, schema } from "@/db";
import { getTasks } from "@/lib/data";
import { daysUntil, prettyDay } from "@/lib/format";
import { getMe } from "@/lib/session";
import { prettyTime } from "@/lib/time";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "tasks"))) return <PrivatePage ownerName={me.ownerName} what="Tasks" />;
  const readOnly = me.role === "viewer";
  const { new: isNew } = await searchParams;
  const { open, done } = await getTasks(me.spaceId);

  // Which open tasks have a "ping me" time
  const rems = open.length
    ? await db
        .select({ taskId: schema.reminder.taskId, at: schema.reminder.remindAt, done: schema.reminder.done })
        .from(schema.reminder)
        .where(inArray(schema.reminder.taskId, open.map((t) => t.id)))
    : [];
  const pingAt = new Map(rems.filter((r) => r.taskId && !r.done).map((r) => [r.taskId!, r.at]));

  const overdue = open.filter((t) => t.dueOn && daysUntil(t.dueOn) < 0);
  const today = open.filter((t) => !t.dueOn || daysUntil(t.dueOn) === 0);
  const later = open.filter((t) => t.dueOn && daysUntil(t.dueOn) > 0);

  const meta = (t: (typeof open)[number]) =>
    [
      t.dueOn ? prettyDay(t.dueOn) : null,
      pingAt.get(t.id) ? `⏰ ${prettyTime(pingAt.get(t.id)!)}` : null,
      t.priority === "high" ? "⭐ Important" : null,
      t.repeat !== "none" ? `🔁 ${t.repeat === "daily" ? "Every day" : t.repeat === "weekly" ? "Every week" : "Every month"}` : null,
    ]
      .filter(Boolean)
      .join(", ") || undefined;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageTitle title="Tasks" icon="tasks" subtitle={open.length ? `${open.length} to do` : "All clear"}>
        <Badge className="bg-sun">{open.length} open</Badge>
      </PageTitle>

      {!readOnly && <AddTaskForm autoFocus={isNew === "1"} />}

      {open.length === 0 && <Empty mood="cheer" title="All clear!" text="Nothing left to do. Go treat yourself 🍑" />}

      <Group title="Oops, late" icon="clock" tone="bg-pink-soft" tasks={overdue} readOnly={readOnly} meta={meta} />
      <Group title="Today" icon="tasks" tone="bg-white" tasks={today} readOnly={readOnly} meta={meta} />
      <Group title="Later" icon="calendar" tone="bg-sky-soft" tasks={later} readOnly={readOnly} meta={meta} />

      {done.length > 0 && (
        <details className="rounded-[24px] border-[2.5px] border-ink bg-mint-soft px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-extrabold">
            <CuteIcon name="fun" size={26} /> Done ({done.length})
          </summary>
          {done.map((t) => (
            <TaskCheck key={t.id} id={t.id} title={t.title} done readOnly={readOnly} showDelete />
          ))}
        </details>
      )}
    </div>
  );
}

function Group({
  title,
  icon,
  tone,
  tasks,
  readOnly,
  meta,
}: {
  title: string;
  icon: "clock" | "tasks" | "calendar";
  tone: string;
  tasks: Awaited<ReturnType<typeof getTasks>>["open"];
  readOnly: boolean;
  meta: (t: Awaited<ReturnType<typeof getTasks>>["open"][number]) => string | undefined;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className={`sticker rounded-[26px] ${tone} px-4 py-3`}>
      <h2 className="font-display mb-1 flex items-center gap-2 text-lg font-bold">
        <CuteIcon name={icon} size={28} /> {title}
        <span className="text-sm text-ink-soft">{tasks.length}</span>
      </h2>
      {tasks.map((t) => (
        <TaskCheck key={t.id} id={t.id} title={t.title} done={false} meta={meta(t)} readOnly={readOnly} showDelete />
      ))}
    </section>
  );
}
