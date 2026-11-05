import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { deleteTask } from "@/app/(app)/actions";
import { saveTask } from "@/app/(app)/life-actions";
import { db, schema } from "@/db";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Edit task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "tasks"))) return <PrivatePage ownerName={me.ownerName} what="Tasks" />;
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t] = await db
    .select()
    .from(schema.task)
    .where(and(eq(schema.task.id, id), eq(schema.task.ownerId, me.spaceId)))
    .limit(1);
  if (!t) notFound();
  const ro = me.role === "viewer";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <PageTitle title={t.title} icon="tasks" help={false} subtitle={t.done ? "Done ✓" : "To do"}>
        {!ro && (
          <ActButton action={deleteTask.bind(null, t.id)} confirmText={`Delete ${t.title}?`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <Icon name="trash" size={18} />
          </ActButton>
        )}
      </PageTitle>
      {!ro && (
        <Panel title="Edit" icon="pencil" tone="bg-sun-soft">
          <ActionForm action={saveTask} resetOnOk={false} okText="Saved ✓" className="flex flex-col gap-2.5">
            <input type="hidden" name="id" value={t.id} />
            <Label text="What">
              <input name="title" defaultValue={t.title} required maxLength={140} className="field" />
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <Label text="Day">
                <input name="dueOn" type="date" defaultValue={t.dueOn ?? ""} className="field px-2" />
              </Label>
              <Label text="Repeat">
                <select name="repeat" defaultValue={t.repeat} className="field px-2">
                  <option value="none">Once</option>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </Label>
            </div>
            <Label text="Priority">
              <select name="priority" defaultValue={t.priority} className="field px-2">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">⭐ Important</option>
              </select>
            </Label>
            <SubmitButton className="self-start bg-white">Save</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
