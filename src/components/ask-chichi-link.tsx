import Link from "next/link";
import { MascotBadge } from "@/components/mascot";

/** A friendly button that opens Ask Chichi and sends the question right away. */
export function AskChichiLink({ q, label, hint, className = "" }: { q: string; label: string; hint?: string; className?: string }) {
  return (
    <Link
      href={`/ask?go=1&q=${encodeURIComponent(q)}`}
      className={`sticker-flat press flex items-center gap-2.5 rounded-[20px] bg-linear-to-br from-lilac-soft to-pink-soft px-3 py-2 ${className}`}
    >
      <MascotBadge size={34} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[14px] font-extrabold leading-tight">{label}</span>
        {hint && <span className="text-[12px] font-bold text-ink-soft">{hint}</span>}
      </span>
    </Link>
  );
}
