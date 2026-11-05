import { CuteIcon } from "@/components/cute-icon";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { DeadlineBadge, ExpiryBadge } from "@/components/paper-bits";
import { PrivatePage } from "@/components/private-page";
import { Empty, Label, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addPaper } from "@/app/(app)/papers-actions";
import { getPapers } from "@/lib/data3";
import { APP_CATEGORIES, APP_STATUSES, DOC_CATEGORIES } from "@/lib/papers";
import { canSee } from "@/lib/privacy";
import { getMe } from "@/lib/session";
import { daysUntil } from "@/lib/format";

export const metadata: Metadata = { title: "Papers" };

export default async function PapersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "papers"))) return <PrivatePage ownerName={me.ownerName} what="Papers" />;
  const ro = me.role === "viewer";
  const tab = (await searchParams).tab === "apps" ? "apps" : "docs";
  const { docs, apps, counts } = await getPapers(me.spaceId);
  const soon = docs.filter((d) => d.expiresOn && daysUntil(d.expiresOn) <= 60).length;
  const live = apps.filter((a) => !["offer", "rejected"].includes(a.status)).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Papers" icon="papers" subtitle="Documents and applications, never lost again" />
      <Tabs
        base="/papers"
        current={tab}
        tabs={[
          { key: "docs", label: "Documents", icon: "papers", count: soon || undefined },
          { key: "apps", label: "Applications", icon: "exam", count: live || undefined },
        ]}
      />

      {tab === "docs" ? (
        <>
          {docs.length === 0 ? (
            <Empty mood="think" title="No documents yet" text="Passport, IC, visa, insurance. Chichi will remind you 2 months before anything expires." />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {docs.map((d) => {
                const c = DOC_CATEGORIES[d.category] ?? DOC_CATEGORIES.other;
                return (
                  <Link key={d.id} href={`/papers/${d.id}`} className="sticker press flex items-center gap-3 rounded-[22px] bg-white p-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-linear-to-br from-sun-soft to-peach-soft">
                      <CuteIcon name={c.icon} size={36} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[15px] font-extrabold">{d.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft">
                        <ExpiryBadge on={d.expiresOn} />
                        {d.refHint && <span>ends in {d.refHint}</span>}
                        {counts[d.id] ? <span>📎 {counts[d.id]}</span> : null}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {!ro && (
            <Panel tone="bg-sun-soft" title="Add a document" icon="papers">
              <ActionForm action={addPaper} className="flex flex-col gap-2.5">
                <input type="hidden" name="kind" value="document" />
                <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2.5">
                  <input name="title" required maxLength={120} placeholder="My passport" className="field" />
                  <select name="category" defaultValue="passport" aria-label="Type" className="field px-2">
                    {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.emoji} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Label text="Expires on">
                    <input type="date" name="expiresOn" className="field px-2" />
                  </Label>
                  <Label text="Last 4 of the number (optional)">
                    <input name="refHint" maxLength={20} autoComplete="off" placeholder="4821" className="field" />
                  </Label>
                </div>
                <p className="text-[11px] font-bold text-ink-soft">🔒 Never type full IC or passport numbers. The last 4 are enough to recognise it. Attach a photo or scan after saving.</p>
                <SubmitButton className="self-start">Add</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </>
      ) : (
        <>
          {apps.length === 0 ? (
            <Empty mood="cheer" title="No applications yet" text="Scholarships, internships, jobs. Track deadlines and checklists here, Chichi reminds you a week before." />
          ) : (
            <div className="flex flex-col gap-2.5">
              {apps.map((a) => {
                const c = APP_CATEGORIES[a.category] ?? APP_CATEGORIES.other;
                const st = APP_STATUSES.find((s) => s.key === a.status) ?? APP_STATUSES[0];
                const done = a.checklist.filter((x) => x.done).length;
                return (
                  <Link key={a.id} href={`/papers/${a.id}`} className="sticker press flex items-center gap-3 rounded-[22px] bg-white p-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-linear-to-br from-sky-soft to-lilac-soft">
                      <CuteIcon name={c.icon} size={36} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[15px] font-extrabold">
                        {a.title}
                        {a.org && <span className="font-bold text-ink-soft">, {a.org}</span>}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft">
                        <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold text-ink ${st.cls}`}>
                          {st.emoji} {st.label}
                        </span>
                        <DeadlineBadge on={a.deadlineOn} closed={["submitted", "interview", "offer", "rejected"].includes(a.status)} />
                        {a.checklist.length > 0 && (
                          <span>
                            ✅ {done}/{a.checklist.length}
                          </span>
                        )}
                        {counts[a.id] ? <span>📎 {counts[a.id]}</span> : null}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          {!ro && (
            <Panel tone="bg-sky-soft" title="Track an application" icon="exam">
              <ActionForm action={addPaper} className="flex flex-col gap-2.5">
                <input type="hidden" name="kind" value="application" />
                <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2.5">
                  <input name="title" required maxLength={120} placeholder="Yayasan scholarship 2027" className="field" />
                  <select name="category" defaultValue="scholarship" aria-label="Type" className="field px-2">
                    {Object.entries(APP_CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.emoji} {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Label text="Where">
                    <input name="org" maxLength={100} placeholder="Company / university" className="field" />
                  </Label>
                  <Label text="Deadline">
                    <input type="date" name="deadlineOn" className="field px-2" />
                  </Label>
                </div>
                <input name="link" type="url" maxLength={500} placeholder="Link to the page (optional)" className="field" />
                <SubmitButton className="self-start">Add</SubmitButton>
              </ActionForm>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
