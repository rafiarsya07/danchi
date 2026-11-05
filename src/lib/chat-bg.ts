/** Chat wallpapers. Soft gradients, no patterns. "f:<id>" is their own photo. */
export const CHAT_BGS = [
  { id: "cream", label: "Cream", css: "linear-gradient(180deg, #FFF8F1 0%, #FFF3EA 100%)" },
  { id: "peach", label: "Peach", css: "linear-gradient(165deg, #FFE7D6 0%, #FFE0EC 100%)" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(170deg, #FFD9C2 0%, #FBD3E9 55%, #E2D6FF 100%)" },
  { id: "sky", label: "Sky", css: "linear-gradient(180deg, #DDEEFF 0%, #F4F9FF 100%)" },
  { id: "mint", label: "Mint", css: "linear-gradient(170deg, #DDF6EA 0%, #F3FBF7 100%)" },
  { id: "lilac", label: "Lilac", css: "linear-gradient(170deg, #ECE4FF 0%, #FFF0F7 100%)" },
  { id: "rose", label: "Rose", css: "linear-gradient(170deg, #FFD3E2 0%, #FFEFF4 100%)" },
  { id: "lemon", label: "Lemon", css: "linear-gradient(170deg, #FFF1B8 0%, #FFF9E6 100%)" },
  { id: "night", label: "Night", css: "linear-gradient(180deg, #2B2340 0%, #3D2F55 100%)" },
] as const;

export type ChatBgId = (typeof CHAT_BGS)[number]["id"];

export function chatBgStyle(code: string | null | undefined): { background: string; dark: boolean } {
  if (code?.startsWith("f:") && /^f:[0-9a-f-]{36}$/i.test(code)) {
    return {
      background: `linear-gradient(rgba(255,255,255,0.18), rgba(255,255,255,0.18)), url(/api/love/bg/${code.slice(2)}) center / cover no-repeat`,
      dark: false,
    };
  }
  const id = code?.startsWith("p:") ? code.slice(2) : "cream";
  const p = CHAT_BGS.find((b) => b.id === id) ?? CHAT_BGS[0];
  return { background: p.css, dark: p.id === "night" };
}
