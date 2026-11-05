import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Attachments } from "@/components/attachments";
import { Icon } from "@/components/icon";
import { DeadlineBadge, ExpiryBadge } from "@/components/paper-bits";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addCheck, deletePaper, removeCheck, savePaper, setPaperStatus, toggleCheck } from "@/app/(app)/papers-actions";
import { getPaper } from "@/lib/data3";
import { APP_CATEGORIES, APP_STATUSES, DOC_CATEGORIES } from "@/lib/papers";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Paper" };

export default async function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "papers"))) return <PrivatePage ownerName={me.ownerName} what="Papers" />;
  const p = await getPaper(me.spaceId, (await params).id);
  if (!p) notFound();
  const ro = me.role === "viewer";
  const isDoc = p.kind === "document";
  const cat = (isDoc ? DOC_CATEGORIES : APP_CATEGORIES)[p.category] ?? DOC_CATEGORIES.other;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle help={false} title={p.title} icon="papers" subtitle={`${cat.label}${p.org ? `, ${p.org}` : ""}`}>
          {!ro && (
            <ActButton action={deletePaper.bind(null, p.id)} confirmText={`Delete ${p.title} and its files?`} label="Delete" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
              <Icon name="trash" size={18} />
            </ActButton>
          )}
        </PageTitle>
        <div className="flex flex-wrap gap-2">
          {isDoc ? <ExpiryBadge on={p.expiresOn} /> : <DeadlineBadge on={p.deadlineOn} closed={["submitted", "interview", "offer", "rejected"].includes(p.status)} />}
          {p.refHint && <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold">ends in {p.refHint}</span>}
          {p.link && (
            <a href={p.link} target="_blank" rel="noreferrer" className="rounded-full border-2 border-ink bg-sky-soft px-2 py-0.5 text-[11px] font-extrabold">
              🔗 Open link
            </a>
          )}
        </div>

        {!isDoc && (
          <Panel title="Where it's at" icon="tasks">
            <div className="flex flex-wrap gap-2">
              {APP_STATUSES.map((s) =>
                ro ? (
                  <span key={s.key} className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm font-extrabold ${p.status === s.key ? `${s.cls} shadow-[0_3px_0_#2E2240]` : "bg-white opacity-50"}`}>
                    {s.emoji} {s.label}
                  </span>
                ) : (
                  <ActButton
                    key={s.key}
                    action={setPaperStatus.bind(null, p.id, s.key)}
                    className={`rounded-full border-2 border-ink px-3 py-1.5 text-sm font-extrabold ${p.status === s.key ? `${s.cls} shadow-[0_3px_0_#2E2240]` : "bg-white"}`}
                  >
                    {s.emoji} {s.label}
                  </ActButton>
                ),
              )}
            </div>
            {p.status === "offer" && <p className="pop-in text-sm font-extrabold">🎉 Congratulations!! Chichi is so proud of you!</p>}
            {p.status === "rejected" && <p className="text-sm font-bold">Their loss. Every no gets you closer to the right yes 🌷</p>}
          </Panel>
        )}

        {!isDoc && (
          <Panel title="Checklist" icon="tasks">
            {p.checklist.length === 0 && <p className="text-sm font-bold text-ink-soft">Transcript, CV, essay, recommendation letter</p>}
            <ul className="flex flex-col gap-1.5">
              {p.checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {ro ? (
                    <span className="text-lg">{c.done ? "✅" : "⬜"}</span>
                  ) : (
                    <ActButton action={toggleCheck.bind(null, p.id, i)} label={c.done ? "Mark not done" : "Mark done"} className={`flex size-8 items-center justify-center rounded-lg border-2 border-ink ${c.done ? "bg-mint" : "bg-white"}`}>
                      {c.done ? <Icon name="check" size={16} stroke={3} /> : null}
                    </ActButton>
                  )}
                  <span className={`flex-1 text-[15px] font-bold ${c.done ? "text-ink-soft line-through" : ""}`}>{c.t}</span>
                  {!ro && (
                    <ActButton action={removeCheck.bind(null, p.id, i)} label="Remove" className="flex size-8 items-center justify-center text-ink-soft">
                      <Icon name="close" size={14} />
                    </ActButton>
                  )}
                </li>
              ))}
            </ul>
            {!ro && (
              <ActionForm action={addCheck} className="flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input name="t" required maxLength={120} placeholder="Add a step" className="field" />
                <SubmitButton className="h-12 shrink-0 px-4">Add</SubmitButton>
              </ActionForm>
            )}
          </Panel>
        )}

        <Panel title="Files" icon="clip">
          <Attachments spaceId={me.spaceId} refType="paper" refId={p.id} canEdit={!ro} />
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:pt-[68px]">
        {ro ? (
          p.notes && (
            <Panel title="Notes" icon="notes">
              <p className="whitespace-pre-wrap text-[15px] font-bold">{p.notes}</p>
            </Panel>
          )
        ) : (
          <Panel title="Details" icon="settings">
            <ActionForm action={savePaper} resetOnOk={false} okText="Saved ✓" className="flex flex-col gap-2.5">
              <input type="hidden" name="id" value={p.id} />
              <Label text="Name">
                <input name="title" defaultValue={p.title} required maxLength={120} className="field" />
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                {isDoc ? (
                  <>
                    <Label text="Expires on">
                      <input type="date" name="expiresOn" defaultValue={p.expiresOn ?? ""} className="field px-2" />
                    </Label>
                    <Label text="Last 4">
                      <input name="refHint" defaultValue={p.refHint ?? ""} maxLength={20} autoComplete="off" className="field" />
                    </Label>
                  </>
                ) : (
                  <>
                    <Label text="Where">
                      <input name="org" defaultValue={p.org ?? ""} maxLength={100} className="field" />
                    </Label>
                    <Label text="Deadline">
                      <input type="date" name="deadlineOn" defaultValue={p.deadlineOn ?? ""} className="field px-2" />
                    </Label>
                  </>
                )}
              </div>
              {isDoc && <input type="hidden" name="org" value={p.org ?? ""} />}
              <Label text="Link">
                <input name="link" type="url" defaultValue={p.link ?? ""} maxLength={500} placeholder="https://" className="field" />
              </Label>
              <Label text="Notes">
                <textarea name="notes" defaultValue={p.notes ?? ""} rows={5} maxLength={2000} placeholder="Where the original is kept, renewal steps, contact person" className="field py-3" />
              </Label>
              <SubmitButton className="self-start bg-sun">Save</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </div>
  );
}
