import Link from "next/link";
import { Mascot } from "@/components/mascot";

/** What the viewer sees when she has kept a section to herself. */
export function PrivatePage({ ownerName, what }: { ownerName: string; what: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[30px] border-[2.5px] border-ink bg-lilac-soft px-6 pb-8 pt-5 text-center shadow-[0_4px_0_#2E2240]">
      <Mascot mood="love" size={130} />
      <h1 className="font-display text-2xl font-bold">{what} is just for {ownerName}</h1>
      <p className="text-[15px] font-bold text-ink-soft">
        {ownerName} keeps this part private. That&apos;s her choice, and Danchi respects it 🔒
      </p>
      <Link href="/" className="sticker-sm press mt-2 rounded-2xl bg-white px-5 py-2.5 font-extrabold">
        Back home
      </Link>
    </div>
  );
}
