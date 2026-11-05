import { ActButton, ActionForm } from "@/components/action-form";
import { Label, SubmitButton } from "@/components/ui";
import { saveHomeCards } from "@/app/(app)/life-actions";
import { removePin, savePrivacy, saveQuietHours, setLockMinutes, setPin, signOutDevice, signOutOthers } from "@/app/(app)/care-actions";
import { describeDevice, maskIp } from "@/lib/device";
import { SHAREABLE, sectionOfPath } from "@/lib/privacy";
import { prettyWhen } from "@/lib/time";

type Settings = { hiddenSections: string[]; shareReminders: boolean; shareMood: boolean; cycleTellRafi: boolean; quietFrom: number; quietTo: number };

function Toggle({ name, value, label, hint, on, disabled }: { name: string; value?: string; label: string; hint?: string; on: boolean; disabled?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-ink bg-white px-3 py-2">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={on} disabled={disabled} className="size-5 shrink-0 accent-[#2EB67D]" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-extrabold">{label}</span>
        {hint && <span className="text-xs font-bold text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

export function PrivacyForm({ s, partner, readOnly }: { s: Settings; partner: string; readOnly: boolean }) {
  const hidden = new Set(s.hiddenSections);
  if (readOnly) {
    return (
      <div className="flex flex-col gap-2 text-sm font-bold">
        <p>She decides what you can see. Right now you can open:</p>
        <div className="flex flex-wrap gap-1.5">
          {SHAREABLE.filter((x) => !hidden.has(x.key)).map((x) => (
            <span key={x.key} className="rounded-full border-2 border-ink bg-mint-soft px-2.5 py-0.5 text-xs font-extrabold">
              {x.emoji} {x.label.split(" (")[0]}
            </span>
          ))}
        </div>
        <p className="text-ink-soft">Her cycle and private journal pages are always just hers. She can see when you visit.</p>
      </div>
    );
  }
  return (
    <ActionForm action={savePrivacy} resetOnOk={false} okText="Saved. Your Danchi, your rules 💛" className="flex flex-col gap-2.5">
      <p className="text-sm font-bold">Choose what {partner} can open. Untick anything you want to keep to yourself, any time, no explaining needed.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {SHAREABLE.map((x) => (
          <Toggle key={x.key} name="show" value={x.key} label={`${x.emoji} ${x.label}`} on={!hidden.has(x.key)} />
        ))}
      </div>
      <span className="mt-1 text-xs font-extrabold">Little extras</span>
      <Toggle name="shareReminders" label={`🔔 ${partner}'s phone also rings for my reminders`} hint="So he can nudge you too" on={s.shareReminders} />
      <Toggle name="shareMood" label={`🙂 ${partner} can see today's mood face`} hint="Only the face, never your notes or journal" on={s.shareMood} />
      <Toggle name="cycleTellRafi" label={`🍫 Give ${partner} a "be extra sweet" heads up before my period`} hint="No dates or details, just a kind nudge" on={s.cycleTellRafi} />
      <SubmitButton className="self-start bg-mint">Save privacy</SubmitButton>
    </ActionForm>
  );
}

export function QuietForm({ s }: { s: Settings }) {
  const on = s.quietFrom >= 0 && s.quietTo >= 0;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? " am" : " pm"}`;
  return (
    <ActionForm action={saveQuietHours} resetOnOk={false} okText="Saved 🌙" className="flex flex-col gap-2.5">
      <Toggle name="quiet" label="🌙 Quiet hours" hint="Notifications still arrive, just without sound. Safety alerts always ring." on={on} />
      <div className="grid grid-cols-2 gap-2.5">
        <Label text="From">
          <select name="quietFrom" defaultValue={on ? s.quietFrom : 23} className="field px-2">
            {hours.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Until">
          <select name="quietTo" defaultValue={on ? s.quietTo : 7} className="field px-2">
            {hours.map((h) => (
              <option key={h} value={h}>
                {label(h)}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <SubmitButton className="self-start bg-lilac">Save</SubmitButton>
    </ActionForm>
  );
}

export function PinForms({ hasPin, minutes, fresh }: { hasPin: boolean; minutes: number; fresh: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold">
        {hasPin
          ? `🔒 PIN is on. Danchi locks after ${minutes === 60 ? "1 hour" : `${minutes} min`} away.`
          : "Add a PIN so nobody can peek if your phone is unlocked in someone else's hands. Forgot it? Just sign in with Google again."}
      </p>
      {hasPin && (
        <div className="flex flex-wrap gap-2">
          {[1, 5, 15, 60].map((m) => (
            <ActButton
              key={m}
              action={setLockMinutes.bind(null, m)}
              className={`h-10 rounded-full border-2 border-ink px-3.5 text-sm font-extrabold ${m === minutes ? "bg-sun shadow-[0_3px_0_#2E2240]" : "bg-white"}`}
            >
              {m === 60 ? "1 hour" : `${m} min`}
            </ActButton>
          ))}
        </div>
      )}
      <details className="rounded-2xl border-2 border-ink bg-cream px-3 py-2">
        <summary className="flex min-h-10 cursor-pointer items-center text-sm font-extrabold">{hasPin ? "Change PIN" : "Set a PIN"}</summary>
        <ActionForm action={setPin} okText="PIN saved 🔒" className="flex flex-col gap-2.5 pb-2 pt-2">
          {hasPin && !fresh && <input name="current" type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Current PIN" className="field" />}
          <div className="grid grid-cols-2 gap-2.5">
            <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" maxLength={6} required placeholder="New PIN" className="field" />
            <input name="pin2" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" maxLength={6} required placeholder="Again" className="field" />
          </div>
          <input type="hidden" name="minutes" value={minutes || 15} />
          <SubmitButton className="self-start bg-sun">Save PIN</SubmitButton>
        </ActionForm>
      </details>
      {hasPin && (
        <details className="rounded-2xl border-2 border-ink bg-cream px-3 py-2">
          <summary className="flex min-h-10 cursor-pointer items-center text-sm font-extrabold">Turn PIN off</summary>
          <ActionForm action={removePin} className="flex gap-2 pb-2 pt-2">
            {!fresh && <input name="current" type="password" inputMode="numeric" autoComplete="off" maxLength={6} required placeholder="Current PIN" className="field" />}
            <SubmitButton className="shrink-0 bg-white">Turn off</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

export function Devices({ sessions, currentId }: { sessions: { id: string; userAgent: string | null; ipAddress: string | null; createdAt: Date; updatedAt: Date }[]; currentId: string }) {
  return (
    <div className="flex flex-col gap-2">
      {sessions.map((x) => {
        const d = describeDevice(x.userAgent);
        const me = x.id === currentId;
        return (
          <div key={x.id} className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
            <span className="text-2xl">{d.emoji}</span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-sm font-extrabold">
                {d.label} {me && <span className="rounded-full bg-mint px-1.5 text-[11px]">this one</span>}
              </span>
              <span className="truncate text-xs font-bold text-ink-soft">
                Signed in {prettyWhen(x.createdAt)}
                {x.ipAddress ? `, from ${maskIp(x.ipAddress)}` : ""}
              </span>
            </span>
            {!me && (
              <ActButton action={signOutDevice.bind(null, x.id)} confirmText={`Sign out ${d.label}?`} className="h-9 shrink-0 rounded-xl border-2 border-ink bg-pink-soft px-2.5 text-xs font-extrabold">
                Sign out
              </ActButton>
            )}
          </div>
        );
      })}
      {sessions.length > 1 && (
        <ActButton action={signOutOthers} confirmText="Sign out every other device?" className="self-start text-sm font-extrabold underline">
          Sign out everywhere else
        </ActButton>
      )}
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  home: "Home",
  other: "Danchi",
  tasks: "Tasks",
  calendar: "Calendar",
  habits: "Habits",
  stuff: "Stuff",
  kitchen: "Kitchen",
  money: "Money",
  wishlist: "Wishlist",
  study: "Study",
  projects: "Projects",
  notes: "Notes",
  papers: "Papers",
  cycle: "Cycle",
};

export function Visits({ visits, partner, viewer }: { visits: { id: string; path: string; at: Date; name: string }[]; partner: string; viewer: boolean }) {
  if (visits.length === 0) return <p className="text-sm font-bold text-ink-soft">{viewer ? "Your visits show up here, and she can see them too." : `${partner} hasn't opened Danchi yet.`}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {visits.map((v) => (
        <li key={v.id} className="flex items-center gap-2 text-sm font-bold">
          <span>👀</span>
          <span className="flex-1">
            {v.name} opened <b>{v.path.startsWith("/love") ? "Love notes" : v.path.startsWith("/safe") ? "Safety" : SECTION_LABEL[sectionOfPath(v.path)] ?? "Danchi"}</b>
          </span>
          <span className="text-xs text-ink-soft">{prettyWhen(v.at)}</span>
        </li>
      ))}
    </ul>
  );
}

export const HOME_CARDS: [string, string][] = [
  ["safety", "🛡️ Safe and sound buttons"],
  ["check", "🌙 Daily check"],
  ["mood", "🙂 Mood"],
  ["today", "✅ Today's tasks"],
  ["habits", "🌱 Little habits"],
  ["school", "📚 School"],
  ["coming", "📅 Coming up"],
  ["stuff", "🧺 Needs a little love (stuff)"],
  ["papers", "🗂️ Papers"],
  ["bills", "🧾 Bills coming"],
  ["meals", "🍳 Eating today"],
  ["learning", "🎓 Learning"],
  ["projects", "📁 Projects"],
  ["cozy", "☕ Cozy corner (countdowns, focus, happy jar)"],
  ["tips", "💡 Chichi's tip of the day"],
  ["money", "💸 Money"],
  ["ask", "✨ Ask Chichi"],
];

export function HomeCardsForm({ hidden }: { hidden: string[] }) {
  const off = new Set(hidden);
  return (
    <ActionForm action={saveHomeCards} resetOnOk={false} okText="Home updated ✓" className="flex flex-col gap-2.5">
      <p className="text-sm font-bold">Pick what shows on your Home. Fewer cards, calmer screen.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {HOME_CARDS.map(([k, label]) => (
          <span key={k}>
            <input type="hidden" name="all" value={k} />
            <Toggle name="show" value={k} label={label} on={!off.has(k)} />
          </span>
        ))}
      </div>
      <SubmitButton className="self-start bg-sun">Save</SubmitButton>
    </ActionForm>
  );
}
