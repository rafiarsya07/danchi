import type { Mood } from "@/components/mascot";
import { EMOTES, type EmoteName } from "@/components/emote";

/** Which emote sits in the corner of each built in sticker. */
export const STICKER_EMOTE: Record<string, EmoteName> = {
  loveyou: "love",
  miss: "please",
  hug: "hug",
  kiss: "kiss",
  morning: "happy",
  night: "sleepy",
  hungry: "yum",
  proud: "proud",
  yay: "party",
  sorry: "sorry",
  grr: "angry",
  thinking: "think",
  omw: "wink",
  study: "think",
  hehe: "laugh",
  busy: "shock",
  eat: "yum",
  sleepy: "sleepy",
};

/** Chichi's sticker pack. Drawn live (SVG), so they're tiny and always crisp. */
export type BuiltinSticker = { id: string; label: string; mood: Mood; emoji: string; bg: string };

export const STICKERS: BuiltinSticker[] = [
  { id: "loveyou", label: "Love you", mood: "love", emoji: "💗", bg: "#FFE3EE" },
  { id: "miss", label: "Miss you", mood: "worried", emoji: "🥺", bg: "#EDE5FF" },
  { id: "hug", label: "Hug!", mood: "love", emoji: "🫂", bg: "#FFE9DC" },
  { id: "kiss", label: "Mwah", mood: "love", emoji: "💋", bg: "#FFE3EE" },
  { id: "morning", label: "Morning!", mood: "wave", emoji: "☀️", bg: "#FFF3C4" },
  { id: "night", label: "Good night", mood: "sleep", emoji: "🌙", bg: "#E3E9FF" },
  { id: "hungry", label: "Hungry", mood: "think", emoji: "🍜", bg: "#FFF0DE" },
  { id: "proud", label: "Proud of you", mood: "cheer", emoji: "⭐", bg: "#FFF3C4" },
  { id: "yay", label: "Yay!", mood: "cheer", emoji: "🎉", bg: "#E3F7EE" },
  { id: "sorry", label: "Sorry", mood: "worried", emoji: "🙏", bg: "#EEF6FF" },
  { id: "grr", label: "Hmph!", mood: "worried", emoji: "💢", bg: "#FFE5E2" },
  { id: "thinking", label: "Thinking of you", mood: "think", emoji: "💭", bg: "#F3EEFF" },
  { id: "omw", label: "On my way", mood: "wave", emoji: "🚶‍♀️", bg: "#E5F3FF" },
  { id: "study", label: "Study time", mood: "think", emoji: "📚", bg: "#EEF6FF" },
  { id: "hehe", label: "Hehe", mood: "happy", emoji: "😆", bg: "#FFF3C4" },
  { id: "busy", label: "Busy, later?", mood: "remind", emoji: "⏳", bg: "#F1EFEA" },
  { id: "eat", label: "Have you eaten?", mood: "remind", emoji: "🍚", bg: "#FFF0DE" },
  { id: "sleepy", label: "Sleepy", mood: "sleep", emoji: "😴", bg: "#E3E9FF" },
];

export const stickerById = (id: string) => STICKERS.find((s) => s.id === id) ?? null;

/** Message text for a sticker: "b:hug" (built in) or "c:<uuid>" (custom). */
export function parseSticker(text: string): { type: "b"; s: BuiltinSticker } | { type: "c"; id: string } | { type: "e"; name: EmoteName } | null {
  if (text.startsWith("e:") && text.slice(2) in EMOTES) return { type: "e", name: text.slice(2) as EmoteName };
  if (text.startsWith("b:")) {
    const s = stickerById(text.slice(2));
    return s ? { type: "b", s } : null;
  }
  if (/^c:[0-9a-f-]{36}$/i.test(text)) return { type: "c", id: text.slice(2) };
  return null;
}
