import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { LoveChat, type ChatMsg } from "@/components/love-chat";
import { db, schema } from "@/db";
import { getLoveThread } from "@/lib/data3";
import { TIMEZONE, todayISO } from "@/lib/format";
import { getMe } from "@/lib/session";

export const metadata: Metadata = { title: "Love chat" };

export default async function LovePage({ searchParams }: { searchParams: Promise<{ pap?: string }> }) {
  const me = await getMe();
  const [notes, users, stickers, pref, set] = await Promise.all([
    getLoveThread(me.spaceId, 150),
    db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user),
    db.select().from(schema.loveSticker).where(eq(schema.loveSticker.ownerId, me.spaceId)).orderBy(desc(schema.loveSticker.createdAt)),
    db.select().from(schema.chatPref).where(eq(schema.chatPref.userId, me.id)).limit(1),
    db.select({ since: schema.settings.togetherSince }).from(schema.settings).where(eq(schema.settings.ownerId, me.spaceId)).limit(1),
  ]);
  const since = set[0]?.since ?? null;
  const together = since ? { since, days: Math.max(1, Math.round((Date.parse(todayISO() + "T00:00:00Z") - Date.parse(since + "T00:00:00Z")) / 86_400_000) + 1) } : null;
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "";
  const partner = users.find((u) => u.id !== me.id)?.name ?? (me.role === "owner" ? "Rafi" : me.ownerName);
  const msgs: ChatMsg[] = notes.map((n) => ({
    id: n.id,
    mine: n.fromUserId === me.id,
    kind: n.kind,
    text: n.text,
    emoji: n.emoji,
    reaction: n.reaction,
    photos: n.photos,
    reply: n.reply ? { text: n.reply.text.startsWith("b:") || n.reply.text.startsWith("c:") ? "✨ Sticker" : n.reply.text, from: n.reply.fromUserId === me.id ? "You" : nameOf(n.reply.fromUserId) } : null,
    at: n.createdAt.toISOString(),
    seen: !!n.seenAt,
  }));
  const papAsked = (await searchParams).pap === "1";
  return (
    <div className="mx-auto flex max-w-2xl flex-col md:overflow-hidden md:rounded-3xl md:border md:border-[var(--color-line)]">
      <LoveChat
        messages={msgs}
        partner={partner}
        stickers={stickers.map((s) => ({ id: s.id, label: s.label, mine: s.createdBy === me.id || me.role === "owner" }))}
        tz={TIMEZONE}
        papAsked={papAsked}
        bg={pref[0]?.bg}
        together={together}
      />
    </div>
  );
}
