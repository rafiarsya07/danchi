import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { db } from "@/db";
import { getNames } from "@/server/names";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { ActiveTimer, SafetyButtons, TimerForm } from "@/components/care";
import { Mascot } from "@/components/mascot";
import { Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { saveEmergency, saveSosNumbers } from "@/app/(app)/care-actions";
import Link from "next/link";
import { SosButton, SosCameraToggle, SosReady, SosTestCall } from "@/components/sos";
import { ActButton } from "@/components/action-form";
import { deleteSos, deleteSosPhotos } from "@/app/(app)/care-actions";
import { getSosInfo } from "@/server/sos";
import { maskPhone } from "@/server/phone";
import { getSettings } from "@/lib/data";
import { getSafety } from "@/lib/data3";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";
import { mapLink } from "@/server/safety";

export const metadata: Metadata = { title: "Safety" };

const KIND: Record<string, { icon: CuteIconName; t: string }> = {
  safe: { icon: "home", t: "Home safe" },
  omw: { icon: "walk", t: "On my way" },
  help: { icon: "sos", t: "Needed you" },
  timer: { icon: "compass", t: "Safe arrival timer" },
};
const STATUS: Record<string, string> = { safe: "arrived safe", alerted: "ran out, Rafi was told", cancelled: "stopped", active: "running" };

export default async function SafePage({ searchParams }: { searchParams: Promise<{ sos?: string }> }) {
  const me = await getMe();
  const ro = me.role === "viewer";
  const partner = (await getNames(db)).viewer;
  const autoSos = (await searchParams).sos === "1";
  const [{ timer, history }, s, sos] = await Promise.all([getSafety(me.spaceId), getSettings(me.spaceId), getSosInfo(db, me.spaceId)]);
  const active = sos.active;
  const card = s.emergency ?? {};
  const contacts = card.contacts ?? [];

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <PageTitle title="Safety" icon="shield" subtitle={ro ? `Keeping ${me.ownerName} safe together` : `One tap and ${partner} knows`} />

        {ro && active && (
          <section role="alert" className="sticker-flat flex flex-col gap-2 rounded-[26px] bg-linear-to-b from-[#FF6B6B] to-[#C9213A] p-4 text-white">
            <p className="font-display flex items-center gap-2 text-2xl font-bold">
              <span className="size-3 animate-ping rounded-full bg-white" /> SOS from {me.ownerName}
            </p>
            <p className="text-[15px] font-bold">
              Started {prettyWhen(active.createdAt)}
              {active.lastAt ? `, last location ${prettyWhen(active.lastAt)}` : ", waiting for her location"}
              {active.battery != null ? `, battery ${active.battery}%` : ""}
            </p>
            <Link href={`/sos/${active.token}`} className="press flex h-14 items-center justify-center rounded-2xl border-[3px] border-ink bg-white text-lg font-extrabold text-ink">
              📍 Open her live location and photos
            </Link>
          </section>
        )}

        {!ro && (
          <section className="sticker-flat flex flex-col gap-3 rounded-[26px] bg-linear-to-br from-pink-soft to-peach-soft p-4">
            <div className="flex items-center gap-2">
              <CuteIcon name="sos" size={34} />
              <h2 className="font-display flex-1 text-xl font-bold">SOS, for real danger</h2>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <SosButton numbers={sos.numbers} phoneReady={sos.phoneReady} active={active ? { id: active.id, token: active.token } : null} autoStart={autoSos && !active} camera={s.sosCamera} />
              </div>
              <ol className="flex min-w-0 flex-1 flex-col gap-1.5 text-[14px] font-bold">
                <li>1️⃣ Press <b>3 times</b>. You get <b>5 seconds</b> to cancel.</li>
                <li>
                  2️⃣ {sos.phoneReady && sos.numbers.length ? (
                    <>
                      Chichi <b>calls {sos.numbers.length} numbers</b> and texts them a live link
                    </>
                  ) : (
                    <>
                      {partner}&apos;s phone rings loudly (Danchi alert + email)
                    </>
                  )}
                </li>
                <li>3️⃣ Your <b>live location</b> keeps updating while the SOS screen is open</li>
                {s.sosCamera && <li>📸 A photo from your <b>front and back camera</b> is sent (you turned this on)</li>}
                <li>4️⃣ Hold &quot;I&apos;m safe now&quot; to end it. Everyone is told you&apos;re okay.</li>
              </ol>
            </div>
            <p className="rounded-2xl border-2 border-ink bg-sun px-3 py-2 text-[13px] font-extrabold">
              ⚠️ Only press SOS when you&apos;re really in danger or scared. It truly calls and can wake {partner} at 3am. Want to try it? Use <b>Practice SOS</b>, it calls nobody.
            </p>
            <div className="rounded-2xl border-2 border-ink bg-white p-3">
              <p className="mb-2 text-sm font-extrabold">Get SOS ready (do this once)</p>
              <SosReady camera={s.sosCamera} />
            </div>
            <div className="rounded-2xl border-2 border-ink bg-white p-3">
              <SosCameraToggle on={s.sosCamera} />
            </div>
            {!sos.phoneReady && (
              <p className="text-xs font-bold text-ink-soft">
                Automatic phone calls aren&apos;t switched on yet ({partner} sets them up on the mini PC). Until then SOS rings {partner}&apos;s Danchi app and sends an email, and you get big call buttons.
              </p>
            )}
            <div className="rounded-2xl border-2 border-ink bg-white p-3">
              <p className="mb-2 text-sm font-extrabold">Check that calls work</p>
              <SosTestCall />
            </div>
            <details className="rounded-2xl border-2 border-ink bg-white p-3">
              <summary className="cursor-pointer text-sm font-extrabold">📞 Numbers SOS calls ({sos.numbers.length})</summary>
              <ActionForm action={saveSosNumbers} resetOnOk={false} okText="Saved 💛" className="mt-2 flex flex-col gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input key={i} name={`n${i}`} type="tel" defaultValue={sos.numbers[i] ?? ""} maxLength={30} placeholder={i < 4 ? `Number ${i + 1}` : "Extra number (optional)"} aria-label={`SOS number ${i + 1}`} className="field" />
                ))}
                <span className="text-xs font-bold text-ink-soft">Start with 01 for Malaysia, 08 for Indonesia, or +country code.</span>
                <SubmitButton className="self-start bg-pink">Save numbers</SubmitButton>
              </ActionForm>
            </details>
          </section>
        )}

        {ro && (
          <Panel title="Her SOS" icon="sos">
            <p className="text-sm font-bold">
              When {me.ownerName} presses SOS 3 times, your phone rings{sos.phoneReady && sos.numbers.length ? ` and these numbers get a call + SMS: ${sos.numbers.map(maskPhone).join(", ")}` : ""}. You get a live link with her location{s.sosCamera ? " and a photo from both cameras (she turned this on)" : ""}.
            </p>
            {!sos.phoneReady && <p className="mt-1 text-xs font-bold text-ink-soft">Phone calls are off: add your Twilio keys with bash deploy/keys.sh on the mini PC.</p>}
            <div className="mt-2">
              <SosTestCall />
            </div>
          </Panel>
        )}

        {sos.recent.filter((r) => r.status === "ended").length > 0 && (
          <Panel title="Past SOS" icon="inbox">
            <ul className="flex flex-col gap-1.5">
              {sos.recent
                .filter((r) => r.status === "ended")
                .map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-extrabold">
                    <span className="flex items-center gap-2">
                      <CuteIcon name="sos" size={26} />
                      <span className="min-w-0 flex-1">
                        {prettyWhen(r.createdAt)}
                        {r.endedAt && <span className="block text-xs font-bold text-ink-soft">Safe {prettyWhen(r.endedAt)}</span>}
                        <span className="block text-xs font-bold text-ink-soft">
                          {r.calls.length
                            ? `Calls: ${r.calls.filter((c) => c.kind === "call" && c.ok).length} rang, ${r.calls.filter((c) => c.kind === "call" && !c.ok).length} failed`
                            : "No phone calls (Twilio isn't set up), Danchi alert + email only"}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <Link href={`/sos/${r.token}`} className="rounded-full border-2 border-ink bg-sky-soft px-3 py-1 text-xs">
                        Details
                      </Link>
                      {!ro && (
                        <>
                          <ActButton action={deleteSosPhotos.bind(null, r.id)} confirmText="Delete the photos of this SOS? This can't be undone." label="Delete photos" className="rounded-full border-2 border-ink bg-white px-3 py-1 text-xs">
                            🗑️ Delete photos
                          </ActButton>
                          <ActButton action={deleteSos.bind(null, r.id)} confirmText="Delete this SOS completely (photos, location, link)? This can't be undone." label="Delete SOS" className="rounded-full border-2 border-ink bg-pink-soft px-3 py-1 text-xs">
                            Delete all
                          </ActButton>
                        </>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </Panel>
        )}

        {!ro && (
          <Panel tone="bg-mint-soft" title="Check in" icon="shield">
            <SafetyButtons partner={partner} />
          </Panel>
        )}

        {timer ? (
          <ActiveTimer dueAt={timer.dueAt!.toISOString()} message={timer.message} alerted={timer.status === "alerted"} readOnly={ro} partner={partner} />
        ) : (
          !ro && (
            <Panel title="Safe arrival timer" icon="clock">
              <TimerForm partner={partner} />
            </Panel>
          )
        )}

        <Panel title={ro ? "Her check ins" : "Recent check ins"} icon="inbox">
          {history.length === 0 ? (
            <p className="text-sm font-bold text-ink-soft">Nothing yet. {ro ? "Her check ins will show up here and on your phone." : `${partner} gets a ping the moment you tap.`}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.map((h) => {
                const map = mapLink(h.lat, h.lng);
                return (
                  <li key={h.id} className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
                    <CuteIcon name={KIND[h.kind]?.icon ?? "shield"} size={34} />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-sm font-extrabold">
                        {KIND[h.kind]?.t ?? h.kind}
                        {h.kind === "timer" && <span className="font-bold text-ink-soft">, {STATUS[h.status] ?? h.status}</span>}
                      </span>
                      <span className="truncate text-xs font-bold text-ink-soft">
                        {prettyWhen(h.createdAt)}
                        {h.message ? `, ${h.message}` : ""}
                      </span>
                    </span>
                    {map && (
                      <a href={map} target="_blank" rel="noreferrer" className="rounded-full border-2 border-ink bg-sky-soft px-2.5 py-0.5 text-xs font-extrabold">
                        📍 Map
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:pt-[68px]">
        <section className="sticker flex flex-col gap-3 rounded-[26px] bg-white p-4">
          <div className="flex items-center gap-2">
            <Mascot mood="worried" size={64} animate={false} />
            <div className="flex flex-col">
              <h2 className="font-display text-xl font-bold">Emergency card</h2>
              <span className="text-xs font-extrabold text-ink-soft">For doctors, friends, or {ro ? "you" : partner}, if something ever happens</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Blood type" value={card.bloodType} />
            <Fact label="Allergies" value={card.allergies} />
            <Fact label="Medicines" value={card.medications} />
            <Fact label="Conditions" value={card.conditions} />
          </div>
          {card.notes && <Fact label="Notes" value={card.notes} />}
          {contacts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-extrabold">Call</span>
              {contacts.map((c) => (
                <a key={c.phone} href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="sticker-sm press flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-extrabold">
                  📞 <span className="flex-1">{c.name}{c.relation ? ` (${c.relation})` : ""}</span>
                  <span className="text-ink-soft">{c.phone}</span>
                </a>
              ))}
            </div>
          )}
          <a href="tel:999" className="sticker-sm press flex items-center justify-center gap-2 rounded-2xl bg-coral px-3 py-2.5 text-[15px] font-extrabold text-white">
            🚑 Emergency 999
          </a>
        </section>

        {!ro && (
          <Panel title="Edit my card" icon="settings">
            <ActionForm action={saveEmergency} resetOnOk={false} okText="Saved 💛" className="flex flex-col gap-2.5">
              <div className="grid grid-cols-[6rem_1fr] gap-2.5">
                <Label text="Blood type">
                  <select name="bloodType" defaultValue={card.bloodType ?? ""} className="field px-2">
                    <option value="">?</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Label>
                <Label text="Allergies">
                  <input name="allergies" defaultValue={card.allergies ?? ""} maxLength={300} placeholder="Penicillin, peanuts" className="field" />
                </Label>
              </div>
              <Label text="Medicines I take">
                <input name="medications" defaultValue={card.medications ?? ""} maxLength={300} className="field" />
              </Label>
              <Label text="Health conditions">
                <input name="conditions" defaultValue={card.conditions ?? ""} maxLength={300} placeholder="Asthma, migraines" className="field" />
              </Label>
              <Label text="Anything else">
                <input name="notes" defaultValue={card.notes ?? ""} maxLength={500} className="field" />
              </Label>
              <span className="text-xs font-extrabold">Emergency contacts</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_9rem]">
                  <input name={`c${i}name`} defaultValue={contacts[i]?.name ?? ""} maxLength={60} placeholder="Name" aria-label={`Contact ${i + 1} name`} className="field" />
                  <input name={`c${i}rel`} defaultValue={contacts[i]?.relation ?? ""} maxLength={30} placeholder={["Mum", "Dad", "Friend"][i]} aria-label={`Contact ${i + 1} relation`} className="field px-2" />
                  <input name={`c${i}phone`} defaultValue={contacts[i]?.phone ?? ""} type="tel" maxLength={30} placeholder="+60" aria-label={`Contact ${i + 1} phone`} className="field col-span-2 sm:col-span-1" />
                </div>
              ))}
              <SubmitButton className="self-start bg-pink">Save card</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border-2 border-ink bg-white px-3 py-2">
      <span className="text-[11px] font-extrabold text-ink-soft">{label}</span>
      <span className="text-[15px] font-extrabold">{value || "Not set"}</span>
    </div>
  );
}
