import { PrivatePage } from "@/components/private-page";
import { canSee } from "@/lib/privacy";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActButton, ActionForm } from "@/components/action-form";
import { Review } from "@/components/review";
import { Icon } from "@/components/icon";
import { Badge, PageTitle, Panel, SubmitButton } from "@/components/ui";
import { addCard, deleteCard, deleteDeck } from "@/app/(app)/more-actions";
import { getDeck } from "@/lib/data2";
import { prettyDay } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Flashcards" };

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!(await canSee(me, "study"))) return <PrivatePage ownerName={me.ownerName} what="Study" />;
  const ro = me.role === "viewer";
  const data = await getDeck(me.spaceId, (await params).id);
  if (!data) notFound();
  const { deck, cards, due } = data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle help={false} title={deck.name} icon="cards" subtitle={`${cards.length} cards, ${due.length} to review today`}>
        {!ro && (
          <ActButton action={deleteDeck.bind(null, deck.id)} confirmText={`Delete the whole deck "${deck.name}"?`} label="Delete deck" className="flex size-11 items-center justify-center rounded-2xl border-2 border-ink bg-white">
            <Icon name="trash" size={18} />
          </ActButton>
        )}
      </PageTitle>

      {!ro && <Review cards={due.map((c) => ({ id: c.id, front: c.front, back: c.back }))} />}

      {!ro && (
        <Panel tone="bg-lilac" title="Add a card" icon="cards">
          <ActionForm action={addCard} className="flex flex-col gap-2.5">
            <input type="hidden" name="deckId" value={deck.id} />
            <textarea name="front" required maxLength={500} rows={2} placeholder="Front: the question" className="field py-3" />
            <textarea name="back" required maxLength={1000} rows={2} placeholder="Back: the answer" className="field py-3" />
            <SubmitButton className="self-start">Add card</SubmitButton>
          </ActionForm>
        </Panel>
      )}

      <div className="flex flex-col gap-2">
        {cards.map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-2xl border-2 border-ink bg-white p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-extrabold">{c.front}</span>
              <span className="text-sm font-bold text-ink-soft">{c.back}</span>
            </div>
            <Badge className="bg-cream">{c.reps === 0 ? "New" : prettyDay(c.dueOn)}</Badge>
            {!ro && (
              <ActButton action={deleteCard.bind(null, c.id)} label="Delete card" className="flex size-8 items-center justify-center rounded-lg text-ink-soft">
                <Icon name="close" size={15} />
              </ActButton>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
