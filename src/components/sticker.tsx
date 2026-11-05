import { Mascot } from "@/components/mascot";
import { Emote } from "@/components/emote";
import { parseSticker, STICKER_EMOTE, type BuiltinSticker } from "@/lib/stickers";

export function BuiltinStickerArt({ s, size = 120 }: { s: BuiltinSticker; size?: number }) {
  return (
    <span className="relative inline-flex select-none flex-col items-center" style={{ width: size, height: size }} aria-label={s.label} role="img">
      <span className="absolute inset-[6%] rounded-[30%]" style={{ background: s.bg }} aria-hidden />
      <span className="relative mt-[2%]">
        <Mascot mood={s.mood} size={size * 0.72} animate={false} />
      </span>
      <span className="absolute right-[2%] top-[1%]" aria-hidden>
        {STICKER_EMOTE[s.id] ? <Emote name={STICKER_EMOTE[s.id]} size={size * 0.34} /> : <span style={{ fontSize: size * 0.22 }}>{s.emoji}</span>}
      </span>
      <span
        className="font-display absolute bottom-[2%] max-w-full truncate rounded-full bg-white px-2 font-semibold leading-tight text-ink shadow-sm"
        style={{ fontSize: Math.max(10, size * 0.11) }}
      >
        {s.label}
      </span>
    </span>
  );
}

/** Renders "b:..." or "c:..." sticker codes. */
export function StickerView({ code, size = 120 }: { code: string; size?: number }) {
  const p = parseSticker(code);
  if (!p) return <span className="text-4xl">💌</span>;
  if (p.type === "b") return <BuiltinStickerArt s={p.s} size={size} />;
  if (p.type === "e") return <Emote name={p.name} size={Math.round(size * 0.62)} animate />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/love/sticker/${p.id}`} alt="Sticker" loading="lazy" width={size} height={size} className="rounded-[28%] object-cover" style={{ width: size, height: size }} />
  );
}
