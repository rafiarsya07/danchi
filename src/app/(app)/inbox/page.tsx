import type { Metadata } from "next";
import Link from "next/link";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { MarkInboxRead } from "@/components/small-actions";
import { Empty, PageTitle } from "@/components/ui";
import { getInbox } from "@/lib/data";
import { getMe } from "@/lib/session";
import { prettyWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Inbox" };

const KIND: Record<string, { icon: CuteIconName; tile: string }> = {
  reminder: { icon: "bell", tile: "bg-sun-soft" },
  digest: { icon: "calendar", tile: "bg-peach-soft" },
  nudge: { icon: "tasks", tile: "bg-lilac-soft" },
  low: { icon: "low", tile: "bg-pink-soft" },
  test: { icon: "ask", tile: "bg-lilac-soft" },
  info: { icon: "inbox", tile: "bg-sky-soft" },
};

export default async function InboxPage() {
  const me = await getMe();
  const rows = await getInbox(me.spaceId);
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageTitle title="Inbox" icon="inbox" subtitle={unread ? `${unread} new from Chichi` : "Everything Chichi told you"} />
      <MarkInboxRead unread={unread} />
      {rows.length === 0 ? (
        <Empty mood="sleep" title="Nothing yet" text="Reminders, your morning summary and low stock alerts will show up here." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((n) => {
            const k = KIND[n.kind] ?? KIND.info;
            const fresh = !n.readAt;
            return (
              <Link
                key={n.id}
                href={n.url || "/"}
                className={`flex items-start gap-3 rounded-[22px] border-[2.5px] border-ink p-2.5 ${fresh ? "bg-white shadow-[0_4px_0_#2E2240]" : "bg-white/60"}`}
              >
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink ${k.tile}`}>
                  <CuteIcon name={k.icon} size={36} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-[15px] font-extrabold">
                    <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    {fresh && <span className="shrink-0 rounded-full border-2 border-ink bg-coral px-1.5 text-[10px] font-extrabold text-white">New</span>}
                  </span>
                  {n.body && <span className="text-[13px] font-bold text-ink-soft">{n.body}</span>}
                  <span className="mt-0.5 text-xs font-bold text-ink-soft">{prettyWhen(n.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
