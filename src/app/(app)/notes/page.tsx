import { MOODS } from "@/lib/mood";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CuteIcon } from "@/components/cute-icon";
import { Empty, PageTitle, Panel, SubmitButton, Tabs } from "@/components/ui";
import { addNote } from "@/app/(app)/more-actions";
import { getNotes } from "@/lib/data2";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Notes" };


export default async function NotesPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const me = await getMe();
  const ro = me.role === "viewer";
  const sp = await searchParams;
  const tab = sp.tab === "journal" ? "journal" : "notes";
  if (!(await canSee(me, tab))) return <PrivatePage ownerName={me.ownerName} what={tab === "journal" ? "Her journal" : "Notes"} />;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const rows = await getNotes(me.spaceId, tab === "journal" ? "journal" : "note", q || undefined, ro);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title={tab === "journal" ? "Journal" : "Notes"} icon={tab === "journal" ? "journal" : "notes"} subtitle={tab === "journal" ? "How was today?" : "Ideas, lecture notes, anything"} />
      <Tabs
        base="/notes"
        current={tab}
        tabs={[
          { key: "notes", label: "Notes", icon: "notes" },
          { key: "journal", label: "Journal", icon: "journal" },
        ]}
      />

      {!ro && tab === "journal" && (
        <Panel tone="bg-pink" title="Today's page" icon="journal">
          <ActionForm action={addNote} className="flex flex-col gap-2.5" okText="Saved to your journal 💗">
            <input type="hidden" name="kind" value="journal" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mood">
              {MOODS.map((m) => (
                <label key={m.v} className="cursor-pointer">
                  <input type="radio" name="mood" value={m.v} defaultChecked={m.v === 4} className="peer sr-only-safe" />
                  <span className="flex h-16 w-14 flex-col items-center justify-center rounded-2xl border-2 border-ink bg-white leading-none peer-checked:bg-sun peer-checked:shadow-[0_3px_0_#2E2240]">
                    <CuteIcon name={m.icon} size={34} />
                    <span className="mt-0.5 text-[10px] font-extrabold">{m.t}</span>
                  </span>
                </label>
              ))}
            </div>
            <textarea name="body" required rows={5} maxLength={20000} placeholder="Dear diary" className="field py-3 leading-relaxed" />
            <label className="flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" name="private" defaultChecked className="size-5 accent-[#7C5CFF]" /> 🔒 Private, just for me
            </label>
            <SubmitButton className="self-start">Save</SubmitButton>
          </ActionForm>
        </Panel>
      )}

      {!ro && tab === "notes" && (
        <Panel tone="bg-lilac" title="New note" icon="notes">
          <ActionForm action={addNote} className="flex flex-col gap-2.5">
            <input type="hidden" name="kind" value="note" />
            <input name="title" maxLength={140} placeholder="Title" className="field" />
            <textarea name="body" rows={4} maxLength={20000} placeholder="Write anything" className="field py-3 leading-relaxed" />
            <input name="tags" maxLength={120} placeholder="Tags, like: uni, ideas" className="field" />
            <label className="flex items-center gap-2 text-sm font-extrabold">
              <input type="checkbox" name="private" className="size-5 accent-[#7C5CFF]" /> 🔒 Private (Rafi can&apos;t see it)
            </label>
            <SubmitButton className="self-start">Save note</SubmitButton>
          </ActionForm>
        </Panel>
      )}

      <form action="/notes" className="relative">
        {tab === "journal" && <input type="hidden" name="tab" value="journal" />}
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <CuteIcon name="search" size={28} />
        </span>
        <input name="q" defaultValue={q} placeholder={`Search ${tab}`} className="field h-12 pl-12" />
      </form>

      {rows.length === 0 ? (
        <Empty
          mood={tab === "journal" ? "love" : "think"}
          title={q ? `Nothing for "${q}"` : ro ? "Nothing shared here" : tab === "journal" ? "Your journal is empty" : "No notes yet"}
          text={ro ? `${me.ownerName}'s private pages stay private 🔒` : tab === "journal" ? "A few lines a day is enough 💗" : undefined}
        />
      ) : tab === "journal" ? (
        <div className="flex flex-col gap-3">
          {rows.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className="sticker press flex gap-3 rounded-[24px] bg-white p-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-pink-soft">
                <CuteIcon name={MOODS.find((m) => m.v === n.mood)?.icon ?? "journal"} size={36} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-extrabold text-ink-soft">
                  {prettyWhen(n.createdAt)}
                  {n.private && " 🔒"}
                </span>
                <span className="line-clamp-3 whitespace-pre-wrap text-[15px] font-bold">{n.body}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((n) => (
            <Link key={n.id} href={`/notes/${n.id}`} className={`sticker press flex flex-col gap-1 rounded-[24px] p-3.5 ${n.pinned ? "bg-white" : "bg-white"}`}>
              <span className="flex items-center gap-1.5 text-[15px] font-extrabold">
                {n.pinned && <span aria-label="Pinned">📌</span>}
                {n.private && <span aria-label="Private">🔒</span>}
                <span className="truncate">{n.title || "Untitled"}</span>
              </span>
              <span className="line-clamp-3 whitespace-pre-wrap text-sm font-bold text-ink-soft">{n.body}</span>
              <span className="mt-auto flex flex-wrap gap-1 pt-1">
                {n.tags
                  ?.split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t} className="rounded-full border-2 border-ink bg-lilac-soft px-2 text-[11px] font-extrabold">
                      {t}
                    </span>
                  ))}
                <span className="ml-auto text-[11px] font-bold text-ink-soft">{prettyWhen(n.updatedAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
