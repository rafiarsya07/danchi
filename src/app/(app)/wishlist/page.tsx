import { CuteIcon } from "@/components/cute-icon";
import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { ActButton, ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icon";
import { Mascot } from "@/components/mascot";
import { Badge, Empty, Label, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addWish, deleteWish, gotWish } from "@/app/(app)/more-actions";
import { getSettings } from "@/lib/data";
import { getWishes } from "@/lib/data2";
import { money } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Wishlist" };

const PRI: Record<string, { t: string; c: string; icon: "target" | "heart" | "star" }> = {
  need: { t: "Need", c: "bg-coral text-white", icon: "target" },
  want: { t: "Want", c: "bg-sun", icon: "heart" },
  dream: { t: "Dream", c: "bg-lilac", icon: "star" },
};

export default async function WishlistPage() {
  const me = await getMe();
  if (!(await canSee(me, "wishlist"))) return <PrivatePage ownerName={me.ownerName} what="Her wishlist" />;
  const ro = me.role === "viewer";
  const [{ open, got }, s] = await Promise.all([getWishes(me.spaceId), getSettings(me.spaceId)]);
  const total = open.reduce((n, w) => n + (w.priceCents ?? 0), 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Wishlist" icon="wish" subtitle={ro ? `Little hints for you, ${me.name} 😉` : "Things your heart wants"} />
      {open.length > 0 && (
        <section className="sticker flex items-center gap-2 rounded-[26px] bg-white py-1 pl-1 pr-4">
          <Mascot mood="love" size={84} animate={false} />
          <div className="flex flex-col">
            <span className="font-display text-xl font-bold">{open.length} wishes</span>
            {total > 0 && <span className="text-sm font-extrabold">About {money(total, s.currency)} of happiness</span>}
          </div>
        </section>
      )}
      {open.length === 0 ? (
        <Empty mood="love" title="No wishes yet" text="Add anything you dream of. You can also just tell Chichi &ldquo;I really want...&rdquo;" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {open.map((w) => {
            const p = PRI[w.priority] ?? PRI.want;
            return (
              <div key={w.id} className="flex items-center gap-3 rounded-[22px] border-[2.5px] border-ink bg-white p-3 shadow-[0_3px_0_#2E2240]">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-linear-to-br from-pink-soft to-peach-soft">
                  <CuteIcon name={p.icon} size={34} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-extrabold">{w.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-ink-soft">
                    <Badge className={p.c}>{p.t}</Badge>
                    {w.priceCents ? <span>{money(w.priceCents, s.currency)}</span> : null}
                    {w.link && (
                      <a href={w.link} target="_blank" rel="noreferrer" className="underline">
                        Link
                      </a>
                    )}
                  </span>
                  {w.note && <span className="text-xs font-bold text-ink-soft">{w.note}</span>}
                </div>
                {!ro && (
                  <div className="flex shrink-0 items-center gap-1">
                    <ActButton action={gotWish.bind(null, w.id)} className="h-9 rounded-xl border-2 border-ink bg-mint px-2.5 text-xs font-extrabold">
                      Got it! 🎉
                    </ActButton>
                    <ActButton action={deleteWish.bind(null, w.id)} confirmText={`Remove ${w.name}?`} label="Delete" className="flex size-8 items-center justify-center text-ink-soft">
                      <Icon name="trash" size={15} />
                    </ActButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!ro && (
        <Panel tone="bg-pink-soft" title="Make a wish" icon="wish">
          <ActionForm action={addWish} className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[1fr_7rem] gap-2.5">
              <input name="name" required maxLength={100} placeholder="Film camera, that cute bag" className="field" />
              <input name="price" type="number" step="0.01" min="0" placeholder={s.currency} aria-label="Price" className="field" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Label text="How much">
                <select name="priority" defaultValue="want" className="field px-2">
                  <option value="need">🎯 Need</option>
                  <option value="want">💛 Want</option>
                  <option value="dream">✨ Dream</option>
                </select>
              </Label>
              <Label text="Link (optional)">
                <input name="link" type="url" maxLength={500} placeholder="https://" className="field" />
              </Label>
            </div>
            <SubmitButton className="self-start">Add wish</SubmitButton>
          </ActionForm>
        </Panel>
      )}
      {got.length > 0 && (
        <details className="rounded-[22px] border-[2.5px] border-ink bg-mint-soft px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-extrabold">Wishes that came true ({got.length}) 🎉</summary>
          {got.map((w) => (
            <div key={w.id} className="flex items-center gap-2 py-1 text-sm font-bold">
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {!ro && (
                <ActButton action={gotWish.bind(null, w.id)} className="text-xs font-extrabold underline">
                  Undo
                </ActButton>
              )}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
