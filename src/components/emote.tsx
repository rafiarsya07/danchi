/**
 * Chichi emotes: hand drawn little peach faces used instead of generic emoji
 * (chat emoticons, reactions, buttons). Pure SVG, crisp at any size.
 */

const INK = "#2E2240";
const PEACH = "#FFB38A";
const PEACH_DEEP = "#FF9E7A";
const BLUSH = "#FF7FA0";
const LEAF = "#7BD3A8";
const RED = "#FF5C7A";
const BLUE = "#7CC4FF";

type Eyes = "dot" | "arc" | "heart" | "wink" | "big" | "line" | "angry" | "star" | "shock" | "down" | "glasses";
type Mouth = "smile" | "open" | "frown" | "kiss" | "wobble" | "o" | "flat" | "tongue" | "smirk" | "grin";
type Extra = "heart" | "hearts" | "zzz" | "tears" | "tear" | "sweat" | "steam" | "sparkle" | "hat" | "q" | "arms" | "blushbig" | "flower";

export const EMOTES = {
  happy: { label: "Happy", eyes: "dot", mouth: "smile", extra: [] },
  laugh: { label: "Haha", eyes: "arc", mouth: "open", extra: ["tears"] },
  love: { label: "Love", eyes: "heart", mouth: "grin", extra: ["heart"] },
  kiss: { label: "Mwah", eyes: "wink", mouth: "kiss", extra: ["heart"] },
  please: { label: "Pleading", eyes: "big", mouth: "wobble", extra: [] },
  cry: { label: "Cry", eyes: "down", mouth: "frown", extra: ["tears"] },
  sad: { label: "Sad", eyes: "dot", mouth: "frown", extra: ["tear"] },
  angry: { label: "Grr", eyes: "angry", mouth: "frown", extra: ["steam"] },
  shy: { label: "Shy", eyes: "arc", mouth: "smile", extra: ["blushbig", "sparkle"] },
  sleepy: { label: "Sleepy", eyes: "line", mouth: "o", extra: ["zzz"] },
  wink: { label: "Wink", eyes: "wink", mouth: "smile", extra: ["sparkle"] },
  shock: { label: "Whoa", eyes: "shock", mouth: "o", extra: ["sweat"] },
  cool: { label: "Cool", eyes: "glasses", mouth: "smirk", extra: [] },
  yum: { label: "Yum", eyes: "arc", mouth: "tongue", extra: [] },
  party: { label: "Yay", eyes: "star", mouth: "open", extra: ["hat"] },
  think: { label: "Hmm", eyes: "dot", mouth: "flat", extra: ["q"] },
  hug: { label: "Hug", eyes: "arc", mouth: "smile", extra: ["arms", "heart"] },
  sorry: { label: "Sorry", eyes: "big", mouth: "wobble", extra: ["sweat"] },
  proud: { label: "Proud", eyes: "star", mouth: "grin", extra: ["sparkle"] },
  blossom: { label: "Sweet", eyes: "arc", mouth: "smile", extra: ["flower"] },
} as const satisfies Record<string, { label: string; eyes: Eyes; mouth: Mouth; extra: readonly Extra[] }>;

export type EmoteName = keyof typeof EMOTES;
export const EMOTE_NAMES = Object.keys(EMOTES) as EmoteName[];

/** Old emoji reactions shown as emotes. */
export const REACTION_EMOTE: Record<string, EmoteName> = {
  "❤️": "love",
  "🥹": "please",
  "😂": "laugh",
  "🫶": "hug",
  "😍": "love",
  "😢": "cry",
};

function Heart({ x, y, s = 1, fill = RED }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 3 C-4 -1 -2 -5 0 -2.6 C2 -5 4 -1 0 3 Z"
      fill={fill}
      stroke={INK}
      strokeWidth={1.2 / s}
      strokeLinejoin="round"
    />
  );
}

function Star({ x, y, r = 3.2, fill = "#FFD24D" }: { x: number; y: number; r?: number; fill?: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />;
}

function EyesArt({ k }: { k: Eyes }) {
  const L = 17.5;
  const R = 30.5;
  const Y = 25;
  switch (k) {
    case "dot":
      return (
        <>
          <circle cx={L} cy={Y} r={2.4} fill={INK} />
          <circle cx={R} cy={Y} r={2.4} fill={INK} />
          <circle cx={L + 0.8} cy={Y - 0.9} r={0.8} fill="#fff" />
          <circle cx={R + 0.8} cy={Y - 0.9} r={0.8} fill="#fff" />
        </>
      );
    case "arc":
      return <path d={`M${L - 3} ${Y + 1} q3 -4 6 0 M${R - 3} ${Y + 1} q3 -4 6 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "down":
      return <path d={`M${L - 3} ${Y - 1} q3 3 6 0 M${R - 3} ${Y - 1} q3 3 6 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "line":
      return <path d={`M${L - 3} ${Y} h6 M${R - 3} ${Y} h6`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "heart":
      return (
        <>
          <Heart x={L} y={Y} s={1.15} />
          <Heart x={R} y={Y} s={1.15} />
        </>
      );
    case "star":
      return (
        <>
          <Star x={L} y={Y} r={3.6} />
          <Star x={R} y={Y} r={3.6} />
        </>
      );
    case "wink":
      return (
        <>
          <path d={`M${L - 3} ${Y + 1} q3 -4 6 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={R} cy={Y} r={2.4} fill={INK} />
          <circle cx={R + 0.8} cy={Y - 0.9} r={0.8} fill="#fff" />
        </>
      );
    case "big":
      return (
        <>
          {[L, R].map((x) => (
            <g key={x}>
              <circle cx={x} cy={Y} r={4} fill={INK} />
              <circle cx={x + 1.3} cy={Y - 1.4} r={1.5} fill="#fff" />
              <circle cx={x - 1.4} cy={Y + 1.5} r={0.7} fill="#fff" />
            </g>
          ))}
        </>
      );
    case "shock":
      return (
        <>
          <circle cx={L} cy={Y} r={3.4} fill="#fff" stroke={INK} strokeWidth={1.6} />
          <circle cx={R} cy={Y} r={3.4} fill="#fff" stroke={INK} strokeWidth={1.6} />
          <circle cx={L} cy={Y} r={1.3} fill={INK} />
          <circle cx={R} cy={Y} r={1.3} fill={INK} />
        </>
      );
    case "angry":
      return (
        <>
          <path d={`M${L - 4} ${Y - 5} l6 2.5 M${R + 4} ${Y - 5} l-6 2.5`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={L} cy={Y + 0.5} r={2.3} fill={INK} />
          <circle cx={R} cy={Y + 0.5} r={2.3} fill={INK} />
        </>
      );
    case "glasses":
      return (
        <>
          <path d={`M${L - 6} ${Y - 3} h12 l-1.5 5.5 a3 3 0 0 1 -3 2 h-3.5 a3 3 0 0 1 -3 -2 Z M${R - 6} ${Y - 3} h12 l-1.5 5.5 a3 3 0 0 1 -3 2 h-3.5 a3 3 0 0 1 -3 -2 Z`} fill={INK} />
          <path d={`M${L + 6} ${Y - 2} h${R - L - 12}`} stroke={INK} strokeWidth={2} />
          <path d={`M${L - 3.5} ${Y - 1.5} l2 0`} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
        </>
      );
  }
}

function MouthArt({ k }: { k: Mouth }) {
  const Y = 32;
  switch (k) {
    case "smile":
      return <path d={`M20 ${Y} q4 4 8 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "grin":
      return <path d={`M18.5 ${Y - 1} q5.5 7 11 0 Z`} fill={INK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
    case "open":
      return (
        <>
          <path d={`M18 ${Y - 1.5} q6 9 12 0 Z`} fill={INK} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
          <path d={`M21.5 ${Y + 2.6} q2.5 -2.2 5 0 q-2.5 1.4 -5 0 Z`} fill={BLUSH} />
        </>
      );
    case "tongue":
      return (
        <>
          <path d={`M20 ${Y} q4 4 8 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <path d={`M24.5 ${Y + 2} q0 4 2.8 4 q2.6 0 2.4 -4.4`} fill={BLUSH} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        </>
      );
    case "frown":
      return <path d={`M20 ${Y + 2} q4 -4 8 0`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "kiss":
      return <path d={`M23 ${Y - 2.5} q3 1 0 2.5 q3 1 0 2.5`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
    case "wobble":
      return <path d={`M19.5 ${Y + 1} q1.5 -2 3 0 t3 0 t3 0`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />;
    case "o":
      return <ellipse cx={24} cy={Y + 0.5} rx={2.4} ry={2.8} fill={INK} />;
    case "flat":
      return <path d={`M20.5 ${Y + 0.5} h7`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case "smirk":
      return <path d={`M20 ${Y + 1} q5 2 8.5 -2`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
  }
}

function ExtraArt({ k }: { k: Extra }) {
  switch (k) {
    case "heart":
      return <Heart x={39} y={11} s={1.5} />;
    case "hearts":
      return (
        <>
          <Heart x={39} y={11} s={1.4} />
          <Heart x={9} y={13} s={1} fill={BLUSH} />
        </>
      );
    case "zzz":
      return (
        <text x={33} y={13} fontSize={10} fontWeight={800} fill={INK} fontFamily="sans-serif">
          z<tspan fontSize={7} dy={-3}>z</tspan>
        </text>
      );
    case "tears":
      return (
        <>
          <path d="M12.5 28 q-2 5 0 7 q2 -2 0 -7 Z" fill={BLUE} stroke={INK} strokeWidth={1.1} />
          <path d="M35.5 28 q-2 5 0 7 q2 -2 0 -7 Z" fill={BLUE} stroke={INK} strokeWidth={1.1} />
        </>
      );
    case "tear":
      return <path d="M14 28 q-2.2 5 0 7 q2.2 -2 0 -7 Z" fill={BLUE} stroke={INK} strokeWidth={1.1} />;
    case "sweat":
      return <path d="M38 12 q-3 5 0 7.5 q3 -2.5 0 -7.5 Z" fill={BLUE} stroke={INK} strokeWidth={1.1} />;
    case "steam":
      return <path d="M36 10 l3 -3 m-1 5 l4 -1 M10 10 l-3 -3 m1 5 l-4 -1" stroke={RED} strokeWidth={2} strokeLinecap="round" />;
    case "sparkle":
      return <path d="M39 9 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 Z" fill="#FFD24D" stroke={INK} strokeWidth={1} strokeLinejoin="round" />;
    case "hat":
      return (
        <>
          <path d="M17 9 L24 -2 L31 9 Z" fill={BLUE} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" transform="translate(0 2)" />
          <circle cx={24} cy={0} r={2} fill="#FFD24D" stroke={INK} strokeWidth={1.1} />
          <path d="M20 8 l2 -3 M27 8 l-1.5 -3" stroke="#FFD24D" strokeWidth={1.6} strokeLinecap="round" />
        </>
      );
    case "q":
      return (
        <text x={35} y={14} fontSize={13} fontWeight={900} fill="#7C5CFF" stroke={INK} strokeWidth={0.6} fontFamily="sans-serif">
          ?
        </text>
      );
    case "arms":
      return (
        <>
          <ellipse cx={8.5} cy={38} rx={4.6} ry={3.4} transform="rotate(-35 8.5 38)" fill={PEACH} stroke={INK} strokeWidth={2} />
          <ellipse cx={39.5} cy={38} rx={4.6} ry={3.4} transform="rotate(35 39.5 38)" fill={PEACH} stroke={INK} strokeWidth={2} />
        </>
      );
    case "blushbig":
      return (
        <>
          <ellipse cx={13} cy={30} rx={4.2} ry={2.6} fill={BLUSH} opacity={0.8} />
          <ellipse cx={35} cy={30} rx={4.2} ry={2.6} fill={BLUSH} opacity={0.8} />
        </>
      );
    case "flower":
      return (
        <g transform="translate(37 10)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={0} cy={-3.2} rx={2.1} ry={3} fill="#fff" stroke={INK} strokeWidth={0.9} transform={`rotate(${a})`} />
          ))}
          <circle r={2} fill="#FFD24D" stroke={INK} strokeWidth={0.9} />
        </g>
      );
  }
}

export function Emote({ name, size = 28, className, animate = false }: { name: EmoteName; size?: number; className?: string; animate?: boolean }) {
  const e = EMOTES[name] ?? EMOTES.happy;
  return (
    <svg width={size} height={size} viewBox="-2 -4 52 54" aria-label={e.label} role="img" className={`${className ?? ""} ${animate ? "emote-bounce" : ""}`}>
      {/* peach body */}
      <path d="M24 9 C35 9 43 16 43 27 C43 38 35 45 24 45 C13 45 5 38 5 27 C5 16 13 9 24 9 Z" fill={PEACH} stroke={INK} strokeWidth={2.4} />
      <path d="M24 10 C22 16 22 22 24 27" fill="none" stroke={PEACH_DEEP} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      <path d="M24 9 C25 5 29 3 33 4 C31 8 27 9 24 9 Z" fill={LEAF} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      {!(e.extra as readonly Extra[]).includes("blushbig") && (
        <>
          <ellipse cx={12.5} cy={30.5} rx={3} ry={1.9} fill={BLUSH} opacity={0.55} />
          <ellipse cx={35.5} cy={30.5} rx={3} ry={1.9} fill={BLUSH} opacity={0.55} />
        </>
      )}
      <EyesArt k={e.eyes} />
      <MouthArt k={e.mouth} />
      {e.extra.map((x) => (
        <ExtraArt key={x} k={x} />
      ))}
    </svg>
  );
}

/** A reaction (stored as an emoji) drawn as an emote when we have one. */
export function ReactionMark({ r, size = 20 }: { r: string; size?: number }) {
  const n = REACTION_EMOTE[r];
  return n ? <Emote name={n} size={size} /> : <span style={{ fontSize: size * 0.8 }}>{r}</span>;
}
