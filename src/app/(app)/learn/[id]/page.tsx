import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Attachments } from "@/components/attachments";
import { Icon } from "@/components/icon";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { deleteLearning, saveLearning } from "@/app/(app)/life-actions";
import { getLearningItem } from "@/lib/data4";
import { LEARN_KINDS } from "@/lib/learn";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Learning" };

export default async function LearnItemPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "learn"))) return <PrivatePage ownerName={me.ownerName} what="Learning" />;
  const it = await getLearningItem(me.spaceId, (await params).id);
  if (!it) notFound();
  const ro = me.role === "viewer";
  const k = LEARN_KINDS[it.kind] ?? LEARN_KINDS.goal;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title={it.title} icon="learn" help={false} subtitle={`${k.label}, ${it.progress}% done`}>
          {!ro && (
            <ActButton action={deleteLearning.bind(null, it.id)} confirmText={`Delete ${it.title}?`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
              <Icon name="trash" size={18} />
            </ActButton>
          )}
        </PageTitle>
        {ro ? (
          <Panel title="Notes" icon="notes">
            <p className="whitespace-pre-wrap text-[15px] font-bold">{it.notes || "No notes yet."}</p>
          </Panel>
        ) : (
          <Panel title="Details and notes" icon="notes">
            <ActionForm action={saveLearning} resetOnOk={false} okText="Saved ✓" className="flex flex-col gap-2.5">
              <input type="hidden" name="id" value={it.id} />
              <Label text="Name">
                <input name="title" defaultValue={it.title} required maxLength={120} className="field" />
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <Label text="Status">
                  <select name="status" defaultValue={it.status} className="field px-2">
                    <option value="want">Want to</option>
                    <option value="doing">Doing</option>
                    <option value="done">Done</option>
                  </select>
                </Label>
                <Label text="Progress %">
                  <input name="progress" type="number" min={0} max={100} defaultValue={it.progress} className="field" />
                </Label>
                {it.kind === "skill" && (
                  <Label text="Level (1 to 5)">
                    <input name="level" type="number" min={1} max={5} defaultValue={it.level ?? 1} className="field" />
                  </Label>
                )}
                <Label text="Target date">
                  <input name="dueOn" type="date" defaultValue={it.dueOn ?? ""} className="field px-2" />
                </Label>
              </div>
              <Label text="Link">
                <input name="link" type="url" defaultValue={it.link ?? ""} maxLength={500} className="field" />
              </Label>
              <Label text={it.kind === "goal" ? "Roadmap: the steps to get there" : "Notes (from the tutorial, book, course...)"}>
                <textarea name="notes" defaultValue={it.notes ?? ""} rows={10} maxLength={20000} placeholder={it.kind === "goal" ? "1. Learn the basics\n2. Build a small project\n3. Get a certificate" : "What you learned"} className="field py-3 leading-relaxed" />
              </Label>
              <SubmitButton className="self-start bg-sun">Save</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:pt-[68px]">
        <Panel title={it.kind === "certificate" ? "Certificate file" : "Files"} icon="clip">
          <Attachments spaceId={me.spaceId} refType="learning" refId={it.id} canEdit={!ro} />
        </Panel>
      </div>
    </div>
  );
}
