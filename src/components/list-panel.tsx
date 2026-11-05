import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { SubmitButton } from "@/components/ui";
import { addListItem, removeListItem, toggleListItem } from "@/app/(app)/life-actions";

/** A tickable checklist stored on a course or project (revision checklist, submission checklist). */
export function Checklist({ table, id, items, ro, placeholder }: { table: "course" | "project"; id: string; items: { t: string; done: boolean }[]; ro: boolean; placeholder: string }) {
  const done = items.filter((x) => x.done).length;
  return (
    <div className="flex flex-col gap-1.5">
      {items.length > 0 && (
        <div className="flex h-3 overflow-hidden rounded-full border-2 border-ink bg-cream" aria-label={`${done} of ${items.length} done`}>
          <div className="bg-mint" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          {ro ? (
            <span className="text-lg">{c.done ? "✅" : "⬜"}</span>
          ) : (
            <ActButton action={toggleListItem.bind(null, table, id, i)} label={c.done ? "Mark not done" : "Mark done"} className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink ${c.done ? "bg-mint" : "bg-white"}`}>
              {c.done ? <Icon name="check" size={16} stroke={3} /> : null}
            </ActButton>
          )}
          <span className={`flex-1 text-[15px] font-bold ${c.done ? "text-ink-soft line-through" : ""}`}>{c.t}</span>
          {!ro && (
            <ActButton action={removeListItem.bind(null, table, id, "checklist", i)} label="Remove" className="flex size-8 items-center justify-center text-ink-soft">
              <Icon name="close" size={14} />
            </ActButton>
          )}
        </div>
      ))}
      {!ro && (
        <ActionForm action={addListItem} className="flex gap-2">
          <input type="hidden" name="table" value={table} />
          <input type="hidden" name="field" value="checklist" />
          <input type="hidden" name="id" value={id} />
          <input name="t" required maxLength={140} placeholder={placeholder} className="field h-11" />
          <SubmitButton className="h-11 shrink-0 px-4 text-base">Add</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
