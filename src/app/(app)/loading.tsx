import { Mascot } from "@/components/mascot";

/** Shown the instant you tap a link, while the page is being prepared. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="skeleton size-11 rounded-2xl md:hidden" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="skeleton h-7 w-44 rounded-xl" />
          <div className="skeleton h-4 w-64 max-w-full rounded-lg" />
        </div>
        <Mascot mood="happy" size={56} />
      </div>
      <div className="skeleton h-12 rounded-[18px]" />
      <div className="skeleton h-40 rounded-[26px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-28 rounded-[24px]" />
        <div className="skeleton h-28 rounded-[24px]" />
      </div>
      <div className="skeleton h-24 rounded-[26px]" />
    </div>
  );
}
