import type { Metadata } from "next";
import Link from "next/link";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Empty, PageTitle } from "@/components/ui";
import { searchAll } from "@/lib/data";
import { money, prettyDay } from "@/lib/format";
import { getMe } from "@/lib/session";
import { hiddenFor } from "@/lib/privacy";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await getMe();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const raw = q.length >= 2 ? await searchAll(me.spaceId, q) : null;
  // The viewer only finds what she shares. Private pages never show up.
  const hidden = await hiddenFor(me);
  const h = (k: string) => hidden.has(k);
  const r = raw && {
    ...raw,
    tasks: h("tasks") ? [] : raw.tasks,
    reminders: h("tasks") ? [] : raw.reminders,
    items: h("stuff") ? [] : raw.items,
    shop: h("stuff") ? [] : raw.shop,
    notes: raw.notes.filter((n) => me.role === "owner" || (!n.private && !h(n.kind === "journal" ? "journal" : "notes"))),
    assignments: h("study") ? [] : raw.assignments,
    exams: h("study") ? [] : raw.exams,
    recipes: h("kitchen") ? [] : raw.recipes,
    projects: h("projects") ? [] : raw.projects,
    wishes: h("wishlist") ? [] : raw.wishes,
    money: h("money") ? [] : raw.money,
    debts: h("money") ? [] : raw.debts,
    papers: h("papers") ? [] : raw.papers,
    learning: h("learn") ? [] : raw.learning,
  };
  const total = r ? Object.values(r).reduce((n, list) => n + list.length, 0) : 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Search" icon="search" subtitle="One box for everything" />
      <form action="/search" role="search" className="flex gap-2.5">
        <label htmlFor="q" className="sr-only-safe">
          Search everything
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <CuteIcon name="search" size={30} />
          </span>
          <input id="q" name="q" defaultValue={q} autoFocus placeholder="Milk, quiz, lip tint" className="field h-14 pl-14 text-base" />
        </div>
        <button type="submit" className="sticker-sm press h-14 rounded-2xl bg-sky px-5 text-base font-extrabold">
          Go
        </button>
      </form>

      {!r && <Empty mood="think" title="What are we looking for?" text="Type at least 2 letters. I'll look everywhere: tasks, notes, study, recipes, money, wishes" />}
      {r && total === 0 && <Empty mood="worried" title={`Nothing for "${q}"`} text="Maybe try another word?" />}

      {r && (
        <div className="flex flex-col gap-5">
          <Group title="Tasks" icon="tasks" href="/tasks" rows={r.tasks.map((t) => ({ id: t.id, text: t.title, sub: t.done ? "Done" : t.dueOn ? prettyDay(t.dueOn) : "" }))} />
          <Group title="Reminders" icon="bell" href="/reminders" rows={r.reminders.map((x) => ({ id: x.id, text: x.title, sub: x.done ? "Sent" : prettyWhen(x.remindAt) }))} />
          <Group title="Stuff" icon="stuff" href="/stuff" rows={r.items.map((i) => ({ id: i.id, href: `/stuff/${i.id}`, text: i.name, sub: `${i.quantity} left${i.location ? `, ${i.location}` : ""}` }))} />
          <Group title="Shopping" icon="shop" href="/shop" rows={r.shop.map((s) => ({ id: s.id, text: s.name, sub: s.done ? "Bought" : s.priority }))} />
          <Group title="Notes and journal" icon="notes" href="/notes" rows={r.notes.map((n) => ({ id: n.id, href: `/notes/${n.id}`, text: n.title || n.body.slice(0, 60), sub: n.kind === "journal" ? "Journal" : prettyWhen(n.updatedAt) }))} />
          <Group title="Study" icon="study" href="/study" rows={[...r.assignments.map((a) => ({ id: a.id, text: a.title, sub: a.dueAt ? prettyWhen(a.dueAt) : a.status })), ...r.exams.map((e) => ({ id: e.id, href: "/study?tab=exams", text: `📖 ${e.title}`, sub: prettyWhen(e.at) }))]} />
          <Group title="Recipes" icon="kitchen" href="/kitchen" rows={r.recipes.map((x) => ({ id: x.id, href: `/kitchen/${x.id}`, text: `${x.emoji} ${x.title}`, sub: x.minutes ? `${x.minutes} min` : "" }))} />
          <Group title="Projects" icon="projects" href="/projects" rows={r.projects.map((x) => ({ id: x.id, href: `/projects/${x.id}`, text: `${x.emoji} ${x.name}`, sub: x.status }))} />
          <Group title="Wishlist" icon="wish" href="/wishlist" rows={r.wishes.map((x) => ({ id: x.id, text: x.name, sub: x.got ? "Got it" : x.priority }))} />
          <Group title="Learning" icon="learn" href="/learn" rows={r.learning.map((x) => ({ id: x.id, href: `/learn/${x.id}`, text: x.title, sub: `${x.kind}, ${x.progress}%` }))} />
          <Group title="Papers" icon="papers" href="/papers" rows={r.papers.map((x) => ({ id: x.id, href: `/papers/${x.id}`, text: x.title, sub: x.kind === "document" ? (x.expiresOn ? `Expires ${prettyDay(x.expiresOn)}` : "Document") : x.status }))} />
          <Group title="Owe and owed" icon="debt" href="/money" rows={r.debts.map((d) => ({ id: d.id, text: d.person, sub: `${d.direction === "i_owe" ? "You owe" : "Owes you"} ${money(d.amountCents)}${d.settled ? ", settled" : ""}` }))} />
          <Group title="Money" icon="money" href="/money" rows={r.money.map((m) => ({ id: m.id, text: m.note || m.category, sub: `${money(m.amountCents)}, ${prettyDay(m.occurredOn)}` }))} />
        </div>
      )}
    </div>
  );
}

function Group({ title, icon, href, rows }: { title: string; icon: CuteIconName; href: string; rows: { id: string; text: string; sub: string; href?: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display flex items-center gap-2 text-lg font-bold">
        <CuteIcon name={icon} size={30} />
        {title}
      </h2>
      {rows.map((row) => (
        <Link key={row.id} href={row.href ?? href} className="flex min-h-12 items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3.5 py-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{row.text}</span>
          <span className="shrink-0 text-xs font-bold capitalize text-ink-soft">{row.sub}</span>
        </Link>
      ))}
    </section>
  );
}
