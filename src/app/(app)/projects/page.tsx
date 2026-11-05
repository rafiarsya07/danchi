import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, ColorPick, Empty, Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addProject } from "@/app/(app)/more-actions";
import { colorOf } from "@/lib/constants";
import { getSettings } from "@/lib/data";
import { getProjects } from "@/lib/data2";
import { money, dayPhrase } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };

const STATUS: Record<string, string> = { active: "bg-mint", paused: "bg-sun-soft", done: "bg-lilac-soft" };

export default async function ProjectsPage() {
  const me = await getMe();
  if (!(await canSee(me, "projects"))) return <PrivatePage ownerName={me.ownerName} what="Projects" />;
  const ro = me.role === "viewer";
  const [projects, s] = await Promise.all([getProjects(me.spaceId), getSettings(me.spaceId)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageTitle title="Projects" icon="projects" subtitle="Tasks, notes and money for each project, together" />
      {projects.length === 0 ? (
        <Empty mood="wave" title="No projects yet" text="Group work, a trip, a side hustle, keep everything about it in one place." />
      ) : (
        <>
        {[
          { title: "", list: projects.filter((p) => p.status !== "done") },
          { title: "Portfolio: finished projects 🏆", list: projects.filter((p) => p.status === "done") },
        ]
          .filter((g) => g.list.length)
          .map((g) => (
        <section key={g.title || "now"} className="flex flex-col gap-2.5">
        {g.title && <h2 className="font-display text-xl font-bold">{g.title}</h2>}
        <div className="grid gap-3 sm:grid-cols-2">
          {g.list.map((p) => {
            const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className={`sticker press flex flex-col gap-2 rounded-[24px] p-3.5 ${colorOf(p.color).soft}`}>
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{p.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-[16px] font-extrabold">{p.name}</span>
                  <Badge className={STATUS[p.status]}>{p.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
                    <span className={`block h-full ${colorOf(p.color).strong}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-xs font-extrabold">
                    {p.done}/{p.total} tasks
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-extrabold">
                  {p.dueOn && <Badge className="bg-white">Due {dayPhrase(p.dueOn)}</Badge>}
                  {p.spent > 0 && <Badge className="bg-white">{money(p.spent, s.currency)} spent</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
        </section>
          ))}
        </>
      )}
      {!ro && (
        <Panel tone="bg-sun" title="New project" icon="projects">
          <ActionForm action={addProject} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[4.5rem_1fr] gap-2.5">
              <input name="emoji" defaultValue="📁" maxLength={8} aria-label="Emoji" className="field px-0 text-center text-2xl" />
              <input name="name" required maxLength={80} placeholder="Group project, trip to Penang" className="field" />
            </div>
            <textarea name="description" rows={2} maxLength={500} placeholder="What's it about?" className="field py-3" />
            <Label text="Due (optional)">
              <input name="dueOn" type="date" className="field px-2" />
            </Label>
            <ColorPick value="sun" />
            <SubmitButton className="self-start">Create project</SubmitButton>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
