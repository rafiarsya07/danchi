import { daysUntil } from "@/lib/format";

const longDate = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Expired", "Expires in 12 days", "Valid till 3 Mar 2028" */
export function ExpiryBadge({ on }: { on: string | null }) {
  if (!on) return <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-extrabold">No expiry</span>;
  const d = daysUntil(on);
  const [cls, text] =
    d < 0
      ? ["bg-coral text-white", `Expired ${longDate(on)}`]
      : d <= 60
        ? ["bg-sun", d === 0 ? "Expires today" : `Expires in ${d} day${d === 1 ? "" : "s"}`]
        : ["bg-mint", `Valid till ${longDate(on)}`];
  return <span className={`whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${cls}`}>{text}</span>;
}

export function DeadlineBadge({ on, closed }: { on: string | null; closed: boolean }) {
  if (!on) return null;
  const d = daysUntil(on);
  const [cls, text] = closed
    ? ["bg-white", `Deadline was ${longDate(on)}`]
    : d < 0
      ? ["bg-white text-ink-soft", "Closed"]
      : d <= 7
        ? ["bg-coral text-white", d === 0 ? "Closes today!" : `Closes in ${d} day${d === 1 ? "" : "s"}`]
        : ["bg-sun-soft", `Closes ${longDate(on)}`];
  return <span className={`whitespace-nowrap rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${cls}`}>{text}</span>;
}
