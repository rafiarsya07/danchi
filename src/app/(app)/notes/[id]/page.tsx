import { CuteIcon } from "@/components/cute-icon";
import { AskChichiLink } from "@/components/ask-chichi-link";
import { tasksFromNote } from "@/app/(app)/life-actions";
import { Attachments } from "@/components/attachments";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { PageTitle, SubmitButton } from "@/components/ui";
import { deleteNote, saveNote } from "@/app/(app)/more-actions";
import { getNote } from "@/lib/data2";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Note" };

const MOOD = ["", "😢", "😕", "🙂", "😊", "🥰"];

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  const ro = me.role === "viewer";
  const n = await getNote(me.spaceId, (await params).id);
  if (!n) notFound();
  const journal = n.kind === "journal";
  if (ro && (n.private || !(await canSee(me, journal ? "journal" : "notes")))) return <PrivatePage ownerName={me.ownerName} what={journal ? "This page" : "This note"} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle help={false} title={journal ? `${MOOD[n.mood ?? 0] ?? ""} Journal` : n.title || "Note"} icon={journal ? "journal" : "notes"} subtitle={`Written ${prettyWhen(n.createdAt)}`}>
        {!ro && (
          <ActButton action={deleteNote.bind(null, n.id)} confirmText="Delete this page?" label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <Icon name="trash" size={18} />
          </ActButton>
        )}
      </PageTitle>
      {ro ? (
        <article className="sticker whitespace-pre-wrap rounded-[24px] bg-white p-5 text-[16px] font-bold leading-relaxed">{n.body}</article>
      ) : (
        <ActionForm action={saveNote} resetOnOk={false} okText="Saved ✓" className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
          <input type="hidden" name="id" value={n.id} />
          {!journal && <input name="title" defaultValue={n.title} maxLength={140} placeholder="Title" className="field font-display text-xl" />}
          {journal && <input type="hidden" name="title" value={n.title} />}
          <textarea name="body" defaultValue={n.body} rows={14} maxLength={20000} className="field py-3 text-[16px] leading-relaxed" />
          {!journal && <input name="tags" defaultValue={n.tags ?? ""} maxLength={120} placeholder="Tags" className="field" />}
          {!journal && (
            <label className="flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" name="pinned" defaultChecked={n.pinned} className="size-5 accent-[#FF8A5C]" /> Pin to the top 📌
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-extrabold">
            <input type="checkbox" name="private" defaultChecked={n.private} className="size-5 accent-[#7C5CFF]" /> 🔒 Private, Rafi can&apos;t see this
          </label>
          <SubmitButton className="self-start bg-sun">Save</SubmitButton>
        </ActionForm>
      )}
      {!ro && !journal && (
        <AskChichiLink
          q={`Help me with my note "${n.title || "untitled"}" (search my Danchi for it): explain it simply, point out the key points, and tell me what to do next.`}
          label="Ask Chichi about this note"
          hint="She explains it, finds the key points and next steps"
          className="self-start"
        />
      )}
      {!ro && !journal && (
        <ActButton action={tasksFromNote.bind(null, n.id)} done="Made {n} tasks from this note ✓" className="sticker-sm press flex h-11 items-center gap-1.5 self-start rounded-2xl bg-sun px-3.5 text-sm font-extrabold">
          <CuteIcon name="tasks" size={24} /> Turn the list in this note into tasks
        </ActButton>
      )}
      <section className="sticker flex flex-col gap-2 rounded-[24px] bg-white p-4">
        <h2 className="font-display text-lg font-bold">Files</h2>
        <Attachments spaceId={me.spaceId} refType="note" refId={n.id} canEdit={!ro} />
      </section>
    </div>
  );
}
