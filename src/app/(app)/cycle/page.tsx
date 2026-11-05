import { db } from "@/db";
import { getNames } from "@/server/names";
import type { Metadata } from "next";
import Link from "next/link";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { PrivatePage } from "@/components/private-page";
import { Label, PageTitle, Panel, Ring, SubmitButton } from "@/components/ui";
import { deleteCycle, endPeriod, logPeriod, saveCycle } from "@/app/(app)/care-actions";
import { PHASE_INFO, SYMPTOMS } from "@/lib/cycle";
import { getSettings } from "@/lib/data";
import { getCycle } from "@/lib/data3";
import { prettyDay, todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Cycle" };

const FLOW: Record<string, string> = { light: "💧 Light", medium: "💧💧 Medium", heavy: "💧💧💧 Heavy" };
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

export default async function CyclePage() {
  const me = await getMe();
  if (me.role !== "owner") return <PrivatePage ownerName={me.ownerName} what="Her cycle" />;
  const [{ logs, stats }, s] = await Promise.all([getCycle(me.spaceId), getSettings(me.spaceId)]);
  const info = PHASE_INFO[stats.phase];
  const today = todayISO();
  const open = logs.find((l) => !l.endOn && stats.onPeriod && l.startOn <= today);
  const partner = (await getNames(db)).viewer;

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title="Cycle" icon="cycle" subtitle="Just for you 🔒" />

        <section className={`sticker flex items-center gap-4 rounded-[28px] p-4 ${info.bg}`}>
          <Ring value={stats.day ?? 0} max={stats.avgCycle} size={112} track="#FFFFFF" fill="#FF7A9C">
            <span className="text-2xl leading-none">{info.emoji}</span>
            {stats.day ? (
              <>
                <span className="font-display text-xl font-bold">Day {stats.day}</span>
                <span className="text-[10px] font-extrabold">of ~{stats.avgCycle}</span>
              </>
            ) : null}
          </Ring>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-2xl font-bold leading-tight">{info.label}</span>
            {stats.nextStart && stats.daysToNext != null && (
              <span className="self-start rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[13px] font-extrabold">
                {stats.daysToNext > 0
                  ? `Next one in ~${stats.daysToNext} day${stats.daysToNext === 1 ? "" : "s"}, ${prettyDay(stats.nextStart)}`
                  : stats.daysToNext === 0
                    ? "Might start today"
                    : stats.onPeriod
                      ? "Happening now"
                      : `${-stats.daysToNext} day${stats.daysToNext === -1 ? "" : "s"} later than usual`}
              </span>
            )}
            <p className="text-sm font-bold">{info.tip}</p>
          </div>
        </section>

        {open && (
          <ActButton action={endPeriod.bind(null, open.id)} className="sticker-sm press h-12 rounded-2xl bg-white px-4 text-[15px] font-extrabold">
            ✨ My period ended today
          </ActButton>
        )}

        <Panel tone="bg-pink-soft" title="My period started" icon="cycle">
          <ActionForm action={logPeriod} okText="Logged 🌸 Be gentle with yourself" className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <Label text="Day">
                <input type="date" name="startOn" defaultValue={today} max={today} className="field px-2" />
              </Label>
              <Label text="Flow">
                <select name="flow" defaultValue="medium" className="field px-2">
                  <option value="light">💧 Light</option>
                  <option value="medium">💧💧 Medium</option>
                  <option value="heavy">💧💧💧 Heavy</option>
                </select>
              </Label>
            </div>
            <SubmitButton className="self-start bg-white">Log it</SubmitButton>
          </ActionForm>
        </Panel>

        <section className="rounded-[22px] border-[2.5px] border-ink bg-white p-3.5 text-[13px] font-bold">
          <p>🔒 Only you can see this page. {partner} can&apos;t open it, search it or ask Chichi about it.</p>
          <p className="mt-1">
            {s.cycleTellRafi
              ? `💛 ${partner} gets a gentle "be extra sweet this week" heads up 2 days before, with no details.`
              : `Want ${partner} to get a little "be extra sweet" heads up (no details)? Turn it on in`}{" "}
            {!s.cycleTellRafi && (
              <Link href="/settings#privacy" className="underline">
                Settings, Privacy
              </Link>
            )}
          </p>
          <p className="mt-1 text-ink-soft">Estimates come from your own logs. They&apos;re a guide, not medical advice or birth control.</p>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:pt-[68px]">
        <h2 className="font-display flex items-center gap-2 text-xl font-bold">
          History
          <span className="ml-auto text-sm font-extrabold text-ink-soft">
            avg {stats.avgCycle} day cycle, {stats.avgPeriod} day period
          </span>
        </h2>
        {logs.length === 0 && <p className="text-sm font-bold text-ink-soft">Log your next period and Chichi starts learning your rhythm 🌼</p>}
        {logs.map((l) => (
          <details key={l.id} className="sticker rounded-[22px] bg-white px-3.5 py-2.5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5">
              <span className="text-2xl">🌸</span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-[15px] font-extrabold">
                  {prettyDay(l.startOn)}
                  {l.endOn ? `, ${days(l.startOn, l.endOn)} days` : ""}
                </span>
                <span className="truncate text-xs font-bold text-ink-soft">{[l.flow && FLOW[l.flow], l.symptoms].filter(Boolean).join(", ") || "Tap to add how it felt"}</span>
              </span>
              <Icon name="chevron" size={18} />
            </summary>
            <ActionForm action={saveCycle} resetOnOk={false} okText="Saved" className="flex flex-col gap-2.5 pb-2 pt-2">
              <input type="hidden" name="id" value={l.id} />
              <div className="grid grid-cols-2 gap-2.5">
                <Label text="Ended">
                  <input type="date" name="endOn" defaultValue={l.endOn ?? ""} min={l.startOn} className="field px-2" />
                </Label>
                <Label text="Flow">
                  <select name="flow" defaultValue={l.flow ?? "medium"} className="field px-2">
                    <option value="light">💧 Light</option>
                    <option value="medium">💧💧 Medium</option>
                    <option value="heavy">💧💧💧 Heavy</option>
                  </select>
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS.map((sy) => (
                  <label key={sy} className="cursor-pointer">
                    <input type="checkbox" name="symptoms" value={sy} defaultChecked={l.symptoms?.includes(sy)} className="peer sr-only-safe" />
                    <span className="block rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-extrabold peer-checked:bg-pink">{sy}</span>
                  </label>
                ))}
              </div>
              <input name="note" defaultValue={l.note ?? ""} maxLength={300} placeholder="Notes" className="field" />
              <div className="flex items-center gap-2">
                <SubmitButton className="bg-pink">Save</SubmitButton>
                <ActButton action={deleteCycle.bind(null, l.id)} confirmText="Delete this entry?" className="ml-auto text-sm font-extrabold text-ink-soft underline">
                  Delete
                </ActButton>
              </div>
            </ActionForm>
          </details>
        ))}
      </div>
    </div>
  );
}
