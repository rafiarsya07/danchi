import { ActionForm } from "@/components/action-form";
import { Mascot } from "@/components/mascot";
import { Panel, SubmitButton } from "@/components/ui";
import { sendLoveNote } from "@/app/(app)/care-actions";

const LOVE_EMOJI = ["💌", "💛", "🌼", "🍑", "🫶", "🧸", "☕", "🌙"];

export function LoveForm({ ownerName }: { ownerName: string }) {
  return (
    <Panel tone="bg-pink" title={`Leave ${ownerName} a note`} icon="letter">
      <ActionForm action={sendLoveNote} okText="Sent 💌 It's on her phone now" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sticker">
          {LOVE_EMOJI.map((e, i) => (
            <label key={e} className="cursor-pointer">
              <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only-safe" />
              <span className="flex size-11 items-center justify-center rounded-xl border-2 border-ink bg-white text-xl peer-checked:bg-sun peer-checked:shadow-[0_2px_0_#2E2240]">{e}</span>
            </label>
          ))}
        </div>
        <textarea name="text" required maxLength={280} rows={3} placeholder="Good luck on your exam today, I'm so proud of you..." className="field py-3 leading-relaxed" />
        <div className="flex items-center gap-2">
          <SubmitButton className="bg-white">Send 💌</SubmitButton>
          <Mascot mood="love" size={56} animate={false} />
        </div>
      </ActionForm>
    </Panel>
  );
}
