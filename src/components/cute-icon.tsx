/**
 * Danchi's hand drawn, full colour icon set. Chunky ink outlines, soft
 * fills and little faces, so every section is easy to spot at a glance.
 * Small UI glyphs (plus, check, close...) stay in icon.tsx.
 */

const INK = "#2E2240";
const C = {
  peach: "#FFB38A",
  peachDeep: "#FF9E7A",
  peachSoft: "#FFE1CF",
  sun: "#FFD95A",
  sunSoft: "#FFF1B8",
  mint: "#9EE6C4",
  leaf: "#7BD3A8",
  mintSoft: "#D6F5E6",
  sky: "#9FD3FF",
  skySoft: "#DDF0FF",
  lilac: "#C9B6FF",
  pink: "#FFA9C9",
  pinkDeep: "#FF7A9C",
  coral: "#FF8A7A",
  green: "#2EB67D",
  blush: "#FF7FA0",
  white: "#FFFFFF",
};

function Face({ x = 24, y = 28, gap = 5, smile = true, worried = false }: { x?: number; y?: number; gap?: number; smile?: boolean; worried?: boolean }) {
  return (
    <g>
      <circle cx={x - gap} cy={y} r={1.9} fill={INK} stroke="none" />
      <circle cx={x + gap} cy={y} r={1.9} fill={INK} stroke="none" />
      <ellipse cx={x - gap - 3.6} cy={y + 3.6} rx={2.4} ry={1.4} fill={C.blush} opacity={0.65} stroke="none" />
      <ellipse cx={x + gap + 3.6} cy={y + 3.6} rx={2.4} ry={1.4} fill={C.blush} opacity={0.65} stroke="none" />
      {worried ? (
        <path d={`M${x - 3} ${y + 5} q1.5 -1.6 3 0 q1.5 1.6 3 0`} fill="none" strokeWidth={2} />
      ) : smile ? (
        <path d={`M${x - 2.6} ${y + 3.6} q2.6 2.6 5.2 0`} fill="none" strokeWidth={2} />
      ) : null}
    </g>
  );
}

function HeartPath({ x, y, s = 1, fill = C.pink }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 4.5 C -5 1, -6.5 -1.5, -6.5 -3.5 A 3.2 3.2 0 0 1 0 -4.6 A 3.2 3.2 0 0 1 6.5 -3.5 C 6.5 -1.5, 5 1, 0 4.5 Z"
      fill={fill}
      strokeWidth={2.2 / s}
    />
  );
}

const ICONS = {
  home: () => (
    <>
      <rect x={9} y={22} width={30} height={19} rx={3.5} fill={C.peachSoft} />
      <path d="M20 41 V33.5 a4 4 0 0 1 8 0 V41" fill={C.peach} />
      <path d="M4.8 22.4 L24 6.8 L43.2 22.4 a1.9 1.9 0 0 1 -1.2 3.4 H6 a1.9 1.9 0 0 1 -1.2 -3.4 Z" fill={C.coral} />
      <HeartPath x={24} y={18.2} s={0.62} fill={C.white} />
    </>
  ),
  tasks: () => (
    <>
      <rect x={8.5} y={8} width={31} height={35} rx={5} fill={C.sun} />
      <rect x={13} y={13.5} width={22} height={25} rx={2.5} fill={C.white} />
      <rect x={17} y={5} width={14} height={7.5} rx={3} fill={C.lilac} />
      <path d="M16.5 21 l2.6 2.6 4.6 -5" stroke={C.green} strokeWidth={2.8} fill="none" />
      <path d="M26.5 21.5 h5" fill="none" strokeWidth={2.2} />
      <path d="M16.5 30 l2.6 2.6 4.6 -5" stroke={C.green} strokeWidth={2.8} fill="none" />
      <path d="M26.5 30.5 h5" fill="none" strokeWidth={2.2} />
    </>
  ),
  stuff: () => (
    <>
      <path d="M7.5 17 L12.5 9 H35.5 L40.5 17 Z" fill="#FFDDB0" />
      <path d="M21 9 h6 l0.8 8 h-7.6 Z" fill={C.sunSoft} strokeWidth={2} />
      <rect x={7.5} y={17} width={33} height={24} rx={3} fill="#FFC48A" />
      <Face y={27.5} />
    </>
  ),
  shop: () => (
    <>
      <path d="M17 18 v-3.5 a7 7 0 0 1 14 0 V18" fill="none" />
      <path d="M8.5 17.5 h31 l-2 21.2 a3 3 0 0 1 -3 2.8 H13.5 a3 3 0 0 1 -3 -2.8 Z" fill={C.peach} />
      <Face y={28} />
    </>
  ),
  money: () => (
    <>
      <path d="M14.5 19 l1.5 -7 l6 4.5" fill={C.pink} />
      <rect x={13} y={33} width={5.5} height={8} rx={2.2} fill={C.pink} />
      <rect x={28.5} y={33} width={5.5} height={8} rx={2.2} fill={C.pink} />
      <path d="M8.5 26 q-4 -0.5 -3.5 -4.5" fill="none" strokeWidth={2.2} />
      <ellipse cx={24} cy={27} rx={16} ry={12} fill={C.pink} />
      <ellipse cx={39} cy={28.5} rx={4.2} ry={3.8} fill="#FF8FB5" />
      <circle cx={37.8} cy={28.5} r={0.8} fill={INK} stroke="none" />
      <circle cx={40.2} cy={28.5} r={0.8} fill={INK} stroke="none" />
      <circle cx={31} cy={23} r={1.9} fill={INK} stroke="none" />
      <ellipse cx={31.5} cy={27.6} rx={2.2} ry={1.3} fill={C.blush} opacity={0.7} stroke="none" />
      <path d="M19.5 17.2 h8" strokeWidth={2.4} />
      <circle cx={23.5} cy={9} r={5.2} fill={C.sun} />
      <path d="M23.5 6.6 v4.8" strokeWidth={1.9} />
    </>
  ),
  search: () => (
    <>
      <path d="M31.5 31.5 L40.5 40.5" strokeWidth={9} />
      <path d="M31.5 31.5 L40.5 40.5" stroke={C.peach} strokeWidth={4} />
      <circle cx={21} cy={21} r={13} fill={C.skySoft} />
      <path d="M13.8 19 a8 8 0 0 1 5.4 -5.6" stroke={C.white} strokeWidth={3} fill="none" />
    </>
  ),
  kitchen: () => (
    <>
      <path d="M17.5 8 q-2 -2 0 -4.5 M30.5 8 q-2 -2 0 -4.5" fill="none" strokeWidth={2.2} />
      <rect x={3.5} y={25} width={6} height={4.5} rx={2} fill={C.sky} />
      <rect x={38.5} y={25} width={6} height={4.5} rx={2} fill={C.sky} />
      <path d="M9 21 h30 v13 a7 7 0 0 1 -7 7 H16 a7 7 0 0 1 -7 -7 Z" fill={C.sky} />
      <path d="M8 21 a16 8.5 0 0 1 32 0 Z" fill={C.skySoft} />
      <circle cx={24} cy={11.5} r={2.6} fill={C.sun} />
      <Face y={29.5} />
    </>
  ),
  study: () => (
    <>
      <rect x={7} y={31} width={33} height={9.5} rx={2.2} fill={C.sky} />
      <rect x={10} y={22} width={30} height={9} rx={2.2} fill={C.pink} />
      <rect x={8} y={13} width={28} height={9} rx={2.2} fill={C.sun} />
      <path d="M12.5 31 v9.5 M15 22 v9 M13 13 v9" strokeWidth={2} />
      <path d="M31 13 v11.5 l-2.4 -2 l-2.4 2 V13" fill={C.coral} strokeWidth={2} />
    </>
  ),
  projects: () => (
    <>
      <path d="M6 13 a3 3 0 0 1 3 -3 h9 l4 4 h17 a3 3 0 0 1 3 3 v20 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#FFC94A" />
      <rect x={11} y={15} width={26} height={14} rx={2} fill={C.white} />
      <path d="M6 22.5 h36 v14.5 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill={C.sun} />
      <HeartPath x={24} y={31} s={0.7} fill={C.pink} />
    </>
  ),
  notes: () => (
    <>
      <rect x={10} y={6} width={28} height={36} rx={4} fill={C.lilac} />
      {[12.5, 19.5, 26.5, 33.5].map((y) => (
        <circle key={y} cx={10} cy={y} r={2.3} fill={C.white} strokeWidth={2} />
      ))}
      <rect x={16.5} y={12} width={16} height={7.5} rx={2} fill={C.white} strokeWidth={2} />
      <HeartPath x={24.5} y={31} s={0.8} fill={C.pink} />
    </>
  ),
  habits: () => (
    <>
      <path d="M24 25 V14.5" fill="none" />
      <path d="M24 17 c-1 -6 -7 -9 -12.5 -8 c0 6 6.5 9.2 12.5 8 Z" fill={C.leaf} />
      <path d="M24 14 c1 -5.2 6.3 -8.2 11.5 -7.2 c0 5.2 -5.5 8.3 -11.5 7.2 Z" fill={C.mint} />
      <path d="M13 28.5 h22 l-3 13 H16 Z" fill={C.peach} />
      <rect x={10.5} y={24} width={27} height={6.5} rx={2.2} fill={C.peachDeep} />
      <Face y={34} gap={4} />
    </>
  ),
  calendar: () => (
    <>
      <rect x={7} y={10} width={34} height={31} rx={5} fill={C.white} />
      <path d="M7 15 a5 5 0 0 1 5 -5 h24 a5 5 0 0 1 5 5 v4.5 H7 Z" fill={C.coral} />
      <path d="M16 6 v8 M32 6 v8" strokeWidth={3} />
      <HeartPath x={24} y={30.5} s={0.95} fill={C.pink} />
    </>
  ),
  clock: () => (
    <>
      <circle cx={12.5} cy={11} r={5} fill={C.sun} />
      <circle cx={35.5} cy={11} r={5} fill={C.sun} />
      <path d="M14.5 39.5 l-3 4 M33.5 39.5 l3 4" />
      <circle cx={24} cy={26} r={15} fill={C.mint} />
      <circle cx={24} cy={26} r={10.5} fill={C.white} />
      <path d="M24 26 V19.5 M24 26 l4.5 3" strokeWidth={2.4} fill="none" />
      <circle cx={24} cy={26} r={1.4} fill={INK} stroke="none" />
    </>
  ),
  low: () => (
    <>
      <rect x={14} y={6.5} width={20} height={6.5} rx={2.2} fill={C.pink} />
      <rect x={11.5} y={12} width={25} height={30} rx={6.5} fill={C.skySoft} />
      <path d="M12.8 33 h22.4 v3 a5 5 0 0 1 -5 5 H17.8 a5 5 0 0 1 -5 -5 Z" fill={C.peach} strokeWidth={0} />
      <rect x={11.5} y={12} width={25} height={30} rx={6.5} fill="none" />
      <Face y={22} gap={4.5} worried />
    </>
  ),
  bell: () => (
    <>
      <path d="M5.5 15 q-2.2 4.5 0 9 M42.5 15 q2.2 4.5 0 9" fill="none" strokeWidth={2.4} />
      <circle cx={24} cy={38.5} r={4} fill={C.peachDeep} />
      <circle cx={24} cy={6.5} r={2.6} fill={C.sun} />
      <path d="M24 8.5 c-8 0 -12 6 -12 13 v7 l-4 6 h32 l-4 -6 v-7 c0 -7 -4 -13 -12 -13 Z" fill={C.sun} />
      <path d="M16.8 18 q0.8 -4 4 -5.2" stroke={C.white} strokeWidth={2.6} fill="none" />
      <Face y={23} gap={4.2} />
    </>
  ),
  ask: () => (
    <>
      <path d="M7.5 12 a5 5 0 0 1 5 -5 h23 a5 5 0 0 1 5 5 v15 a5 5 0 0 1 -5 5 H20 l-7.5 7 v-7 a5 5 0 0 1 -5 -5 Z" fill={C.lilac} />
      <path d="M24 10.5 Q25.6 17.4 32.5 19 Q25.6 20.6 24 27.5 Q22.4 20.6 15.5 19 Q22.4 17.4 24 10.5 Z" fill={C.sun} strokeWidth={2.2} />
      <path d="M41 36 Q41.7 39 44.5 39.6 Q41.7 40.2 41 43 Q40.3 40.2 37.5 39.6 Q40.3 39 41 36 Z" fill={C.pink} strokeWidth={1.8} />
    </>
  ),
  settings: () => (
    <>
      {Array.from({ length: 8 }, (_, k) => (
        <rect key={k} x={20.5} y={4} width={7} height={9} rx={2.2} fill={C.lilac} transform={`rotate(${k * 45} 24 24)`} />
      ))}
      <circle cx={24} cy={24} r={14} fill={C.lilac} />
      <circle cx={24} cy={24} r={5.5} fill={C.white} />
    </>
  ),
  beauty: () => (
    <>
      <path d="M19 19.5 V11 q0 -4.5 4.5 -6.8 l3 -1.3 q2.5 -0.8 2.5 2.3 V19.5 Z" fill={C.pinkDeep} />
      <rect x={17.5} y={19} width={13} height={8} rx={1.6} fill={C.sun} />
      <rect x={14.5} y={26} width={19} height={16.5} rx={3.5} fill={C.lilac} />
      <path d="M18.5 30 v8" stroke={C.white} strokeWidth={2.4} fill="none" />
    </>
  ),
  food: () => (
    <>
      <path d="M24 14 c0 -4 1 -6.2 3.2 -8.3" fill="none" />
      <path d="M26.5 9.5 c3 -4 8 -4.2 10.5 -2 c-2 4 -7 5 -10.5 2 Z" fill={C.leaf} />
      <path d="M24 14.5 c-4 -3 -15.5 -3 -16.3 9 c-0.8 10 7 18.6 12 18 c2 -0.2 2.5 -1 4.3 -1 c1.8 0 2.3 0.8 4.3 1 c5 0.6 12.8 -8 12 -18 c-0.8 -12 -12.3 -12 -16.3 -9 Z" fill={C.coral} />
      <path d="M13.5 22 q0.8 -3.8 4 -5" stroke={C.white} strokeWidth={2.6} fill="none" />
      <Face y={27} gap={4.5} />
    </>
  ),
  clothes: () => (
    <>
      <path d="M17 5.5 h14 l1.5 6 l-3 4.5 l10 22 a2 2 0 0 1 -1.8 2.9 H10.3 a2 2 0 0 1 -1.8 -2.9 l10 -22 l-3 -4.5 Z" fill={C.sky} />
      <path d="M18.4 16.5 h11.2" fill="none" strokeWidth={2.2} />
      <path d="M24 16.5 l-4.5 -3.2 v6.4 Z M24 16.5 l4.5 -3.2 v6.4 Z" fill={C.pink} strokeWidth={2} />
      {[
        [19, 27],
        [27.5, 25.5],
        [23.5, 33],
        [16.5, 35],
        [31, 33.5],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill={C.white} stroke="none" />
      ))}
    </>
  ),
  house: () => (
    <>
      <circle cx={41} cy={8.5} r={1.6} fill={C.sky} strokeWidth={1.6} />
      <circle cx={43.5} cy={14} r={1.3} fill={C.sky} strokeWidth={1.4} />
      <path d="M15 14.5 V9 a3 3 0 0 1 3 -3 h12.5 l6.5 4 v4.5 Z" fill={C.peach} />
      <rect x={18} y={14} width={10} height={7} rx={1.2} fill={C.white} />
      <rect x={13.5} y={20} width={19} height={22.5} rx={4.5} fill={C.mint} />
      <rect x={16.5} y={26} width={13} height={10} rx={2.2} fill={C.white} strokeWidth={2} />
      <path d="M23 28.4 Q23.8 30.3 25.7 31 Q23.8 31.7 23 33.6 Q22.2 31.7 20.3 31 Q22.2 30.3 23 28.4 Z" fill={C.sun} strokeWidth={1.4} />
    </>
  ),
  other: () => (
    <>
      <path d="M24 14 c-4 -8 -12.5 -6 -9.2 -1 c1.3 2 5.2 2 9.2 1 Z M24 14 c4 -8 12.5 -6 9.2 -1 c-1.3 2 -5.2 2 -9.2 1 Z" fill={C.pink} />
      <rect x={9} y={20.5} width={30} height={21} rx={3.2} fill={C.sky} />
      <rect x={7} y={14} width={34} height={8} rx={2.5} fill={C.skySoft} />
      <path d="M21 14 h6 v27.5 h-6 Z" fill={C.pink} />
    </>
  ),
  ride: () => (
    <>
      <path d="M6 29 q0 -4 4 -5 l4.3 -9.2 a4 4 0 0 1 3.7 -2.6 h12 a4 4 0 0 1 3.7 2.6 L38 24 q4 1 4 5 v6.5 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 Z" fill={C.sky} />
      <path d="M17.2 23.5 l2.6 -7 h3.6 v7 Z M27.2 23.5 v-7 h3.6 l2.6 7 Z" fill={C.white} strokeWidth={2} />
      <circle cx={15} cy={37.5} r={4.6} fill="#5C4E70" />
      <circle cx={33} cy={37.5} r={4.6} fill="#5C4E70" />
      <circle cx={15} cy={37.5} r={1.4} fill={C.white} stroke="none" />
      <circle cx={33} cy={37.5} r={1.4} fill={C.white} stroke="none" />
      <circle cx={39.5} cy={29.5} r={1.8} fill={C.sun} strokeWidth={1.6} />
    </>
  ),
  fun: () => (
    <>
      <path d="M24 6.5 L29 18.1 L41.3 19.3 L32.1 27.6 L34.8 39.8 L24 33.5 L13.2 39.8 L15.9 27.6 L6.7 19.3 L19 18.1 Z" fill={C.sun} />
      <Face y={24} gap={3.6} />
    </>
  ),
  bills: () => (
    <>
      <path d="M12 6 h24 v35 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 Z" fill={C.white} />
      <path d="M17 14 h14 M17 20 h14 M17 26 h7" fill="none" strokeWidth={2.2} />
      <circle cx={30} cy={30} r={4.6} fill={C.lilac} strokeWidth={2.2} />
    </>
  ),
  coins: () => (
    <>
      <rect x={8} y={33} width={23} height={7.5} rx={3.7} fill={C.sun} />
      <rect x={10.5} y={25.5} width={23} height={7.5} rx={3.7} fill={C.sun} />
      <rect x={8} y={18} width={23} height={7.5} rx={3.7} fill={C.sun} />
      <circle cx={35} cy={16} r={8.2} fill="#FFE58A" />
      <path d="M35 12 v8" strokeWidth={2.2} />
    </>
  ),
  inbox: () => (
    <>
      <rect x={6} y={11} width={36} height={27} rx={5} fill={C.pink} />
      <path d="M7 14 l17 12 l17 -12" fill="none" />
      <HeartPath x={35} y={33} s={0.6} fill={C.white} />
    </>
  ),
  lock: () => (
    <>
      <path d="M16 21 v-5 a8 8 0 0 1 16 0 v5" fill="none" strokeWidth={3} />
      <rect x={10} y={20} width={28} height={21} rx={5} fill={C.sun} />
      <circle cx={24} cy={29} r={2.6} fill={INK} stroke="none" />
      <path d="M24 30 v4.5" strokeWidth={2.6} />
    </>
  ),
  exam: () => (
    <>
      <rect x={9} y={6} width={26} height={35} rx={3.5} fill={C.white} />
      <path d="M14 14 h12 M14 20 h16 M14 26 h9" fill="none" strokeWidth={2.2} />
      <circle cx={31} cy={32} r={8.5} fill={C.coral} />
      <path d="M27.3 34.5 l2.4 -6 l2.4 6 M28.2 32.6 h3" fill="none" stroke={C.white} strokeWidth={1.8} />
      <path d="M36 9 l5 -2 l-2 5 l-11 11 l-3 1 l1 -3 Z" fill={C.sun} strokeWidth={2} />
    </>
  ),
  cards: () => (
    <>
      <rect x={14} y={6} width={26} height={30} rx={4} fill={C.lilac} transform="rotate(10 27 21)" />
      <rect x={8} y={11} width={26} height={30} rx={4} fill={C.white} transform="rotate(-6 21 26)" />
      <path d="M17 27 Q21 23 25 27" fill="none" strokeWidth={2.2} transform="rotate(-6 21 26)" />
      <circle cx={17} cy={21} r={1.7} fill={INK} stroke="none" />
      <circle cx={25} cy={20} r={1.7} fill={INK} stroke="none" />
    </>
  ),
  journal: () => (
    <>
      <rect x={11} y={6} width={28} height={36} rx={4} fill={C.pink} />
      <rect x={11} y={6} width={7} height={36} rx={3} fill={C.pinkDeep} />
      <HeartPath x={28.5} y={21} s={0.95} fill={C.white} />
      <path d="M22 31 h12" fill="none" strokeWidth={2.2} />
      <path d="M33 6 v9 l2.5 -2 l2.5 2 V6" fill={C.sun} strokeWidth={2} />
    </>
  ),
  wish: () => (
    <>
      <path d="M24 13 c-4 -7 -11.5 -5.5 -8.5 -0.5 c1.3 2 5 1.8 8.5 0.5 Z M24 13 c4 -7 11.5 -5.5 8.5 -0.5 c-1.3 2 -5 1.8 -8.5 0.5 Z" fill={C.sun} />
      <rect x={9} y={19} width={30} height={22} rx={3.2} fill={C.pink} />
      <rect x={7} y={13} width={34} height={8} rx={2.5} fill={C.pinkDeep} />
      <path d="M21 13 h6 v28 h-6 Z" fill={C.sun} />
      <path d="M38 30 Q39 33 42 34 Q39 35 38 38 Q37 35 34 34 Q37 33 38 30 Z" fill={C.white} strokeWidth={1.6} />
    </>
  ),
  shield: () => (
    <>
      <path d="M24 5 L39 10.5 V22 c0 9.5 -6.5 16.5 -15 20.5 C15.5 38.5 9 31.5 9 22 V10.5 Z" fill={C.mint} />
      <path d="M24 9.5 L35 13.5 V22 c0 7 -4.6 12.5 -11 15.8 Z" fill={C.leaf} stroke="none" opacity={0.55} />
      <HeartPath x={24} y={23} s={1.05} fill={C.pink} />
    </>
  ),
  letter: () => (
    <>
      <rect x={6} y={12} width={36} height={26} rx={4} fill={C.peachSoft} />
      <path d="M7 14 L24 27 L41 14" fill="none" />
      <path d="M7 37 L19 25 M41 37 L29 25" fill="none" strokeWidth={2} />
      <HeartPath x={24} y={9} s={1.1} fill={C.pinkDeep} />
    </>
  ),
  cycle: () => (
    <>
      <circle cx={24} cy={24} r={17} fill={C.pink} />
      <circle cx={24} cy={24} r={10.5} fill={C.white} />
      <path d="M24 13.5 C27.5 18.5 29 21.5 29 24 a5 5 0 0 1 -10 0 C19 21.5 20.5 18.5 24 13.5 Z" fill={C.pinkDeep} strokeWidth={2.2} />
      <path d="M36 9 q4 1 5 5" fill="none" strokeWidth={2.2} />
      <path d="M39.5 11 l1.8 3.4 l-3.6 0.4" fill="none" strokeWidth={2} />
    </>
  ),
  papers: () => (
    <>
      <path d="M5 13 a3 3 0 0 1 3 -3 h9 l3.5 4 H40 a3 3 0 0 1 3 3 v20 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 Z" fill={C.sun} />
      <rect x={12} y={6} width={22} height={24} rx={2.5} fill={C.white} transform="rotate(-6 23 18)" />
      <path d="M16 14 h10 M16 19 h13" fill="none" strokeWidth={2} transform="rotate(-6 23 18)" />
      <path d="M5 20 H43 V37 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 Z" fill={C.sun} />
      <Face x={24} y={28} gap={4.5} />
    </>
  ),
  mood: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.sun} />
      <Face x={24} y={23} gap={6} />
      <HeartPath x={37} y={10} s={0.9} fill={C.pink} />
    </>
  ),
  clip: () => (
    <>
      <rect x={10} y={8} width={26} height={33} rx={3.5} fill={C.white} />
      <path d="M15 17 h12 M15 23 h16 M15 29 h10" fill="none" strokeWidth={2.2} />
      <path d="M33 5 v20 a5 5 0 0 1 -10 0 V12 a3 3 0 0 1 6 0 v12" fill="none" stroke={C.coral} strokeWidth={3} />
    </>
  ),
  debt: () => (
    <>
      <circle cx={17} cy={27} r={11} fill={C.sun} />
      <path d="M17 21 v12 M13.5 24 h5.5 a2.2 2.2 0 0 1 0 4.4 h-4 a2.2 2.2 0 0 0 0 4.4 h5.5" fill="none" strokeWidth={2} transform="translate(0 -3) scale(1 0.92)" />
      <path d="M30 14 h12 M38 10 l4 4 l-4 4" fill="none" strokeWidth={2.5} />
      <path d="M42 30 h-12 M34 26 l-4 4 l4 4" fill="none" strokeWidth={2.5} />
    </>
  ),
  learn: () => (
    <>
      <path d="M24 9 L44 18 L24 27 L4 18 Z" fill={C.lilac} />
      <path d="M12 22 V31 c0 4 6 7 12 7 s12 -3 12 -7 V22 L24 27 Z" fill={C.sky} />
      <path d="M40 20 V31" fill="none" strokeWidth={2.4} />
      <path d="M40 31 l-2.5 5 h5 Z" fill={C.sun} strokeWidth={2} />
      <HeartPath x={24} y={17.5} s={0.6} fill={C.pink} />
    </>
  ),
  guide: () => (
    <>
      <path d="M22 41 V8" fill="none" strokeWidth={3} />
      <path d="M10 9 H33 l5 5 l-5 5 H10 Z" fill={C.sun} />
      <path d="M36 21 H14 l-5 5 l5 5 H36 Z" fill={C.mint} />
      <path d="M16 41 h12" fill="none" strokeWidth={3} />
    </>
  ),
  /* ---- mood faces ---- */
  m1: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.sky} />
      <path d="M17.5 23.5 q2 -1.6 4 0 M26.5 23.5 q2 -1.6 4 0" fill="none" strokeWidth={2.2} />
      <path d="M19.5 33.5 q4.5 -4 9 0" fill="none" strokeWidth={2.4} />
      <path d="M33 26 q-2 4 0 5.5 q2 -1.5 0 -5.5 Z" fill={C.white} strokeWidth={1.8} />
    </>
  ),
  m2: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.lilac} />
      <circle cx={19} cy={23} r={1.9} fill={INK} stroke="none" />
      <circle cx={29} cy={23} r={1.9} fill={INK} stroke="none" />
      <path d="M19.5 32 h9" fill="none" strokeWidth={2.4} />
    </>
  ),
  m3: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.sun} />
      <Face x={24} y={23} gap={5} />
    </>
  ),
  m4: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.peach} />
      <path d="M16.5 23.5 q2.5 -3 5 0 M26.5 23.5 q2.5 -3 5 0" fill="none" strokeWidth={2.2} />
      <path d="M18 29 q6 6.5 12 0 Z" fill={C.coral} strokeWidth={2.2} />
      <ellipse cx={14.5} cy={28} rx={2.4} ry={1.4} fill={C.blush} opacity={0.65} stroke="none" />
      <ellipse cx={33.5} cy={28} rx={2.4} ry={1.4} fill={C.blush} opacity={0.65} stroke="none" />
    </>
  ),
  m5: () => (
    <>
      <circle cx={24} cy={25} r={17} fill={C.pink} />
      <HeartPath x={18.5} y={23} s={0.62} fill={C.pinkDeep} />
      <HeartPath x={29.5} y={23} s={0.62} fill={C.pinkDeep} />
      <path d="M19 30 q5 5.5 10 0" fill="none" strokeWidth={2.4} />
      <path d="M38 8 l1.2 3 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 Z" fill={C.sun} strokeWidth={1.6} />
    </>
  ),
  /* ---- safety ---- */
  walk: () => (
    <>
      <path d="M7 33 c0 -7 4 -14 9 -14 c3 0 4 3 7 4 c4 1.5 9 2 13 4 c4 2 5 4 5 6 v3 H7 Z" fill={C.sky} />
      <path d="M7 36 h34 v3 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 Z" fill={C.white} />
      <path d="M18 23 l3 4 M23 24 l2.5 4" fill="none" strokeWidth={2} />
      <path d="M38 12 q3 -2 6 0 M36 7 q3 -2 6 0" fill="none" strokeWidth={2} stroke={C.coral} />
    </>
  ),
  sos: () => (
    <>
      <path d="M12 34 v-9 a12 12 0 0 1 24 0 v9 Z" fill={C.coral} />
      <path d="M18 26 a6 6 0 0 1 6 -6" fill="none" stroke={C.white} strokeWidth={2.4} />
      <rect x={8} y={34} width={32} height={7} rx={2.5} fill={C.sun} />
      <path d="M24 5 v4 M10 11 l3 3 M38 11 l-3 3 M4 22 h4 M40 22 h4" fill="none" strokeWidth={2.4} />
    </>
  ),
  compass: () => (
    <>
      <circle cx={24} cy={26} r={16} fill={C.mint} />
      <circle cx={24} cy={26} r={11.5} fill={C.white} />
      <path d="M24 17 l4 9 l-4 9 l-4 -9 Z" fill={C.coral} strokeWidth={2} />
      <path d="M24 26 l4 0 l-4 9 Z" fill={C.sky} stroke="none" />
      <rect x={21} y={6} width={6} height={5} rx={2} fill={C.sun} />
    </>
  ),
  bulb: () => (
    <>
      <path d="M24 6 a12 12 0 0 1 7 21.8 c-1.3 1 -2 2.4 -2 4 V34 H19 v-2.2 c0 -1.6 -0.7 -3 -2 -4 A12 12 0 0 1 24 6 Z" fill={C.sun} />
      <rect x={18.5} y={34} width={11} height={7} rx={2.5} fill={C.lilac} />
      <path d="M20 21 q4 -5 8 0" fill="none" strokeWidth={2} />
      <path d="M40 10 l3 -2 M41 18 h3.5 M7 10 l-3 -2 M7 18 h-3.5" fill="none" strokeWidth={2.2} />
    </>
  ),
  /* ---- papers & learning ---- */
  passport: () => (
    <>
      <rect x={10} y={5} width={28} height={38} rx={4} fill={C.coral} />
      <circle cx={24} cy={21} r={7} fill="none" stroke={C.white} strokeWidth={2.2} />
      <path d="M17 21 h14 M24 14 c-3 4 -3 10 0 14 c3 -4 3 -10 0 -14" fill="none" stroke={C.white} strokeWidth={1.8} />
      <path d="M17 35 h14" fill="none" stroke={C.white} strokeWidth={2.2} />
    </>
  ),
  idcard: () => (
    <>
      <rect x={4} y={11} width={40} height={27} rx={4} fill={C.skySoft} />
      <rect x={8} y={17} width={12} height={15} rx={2.5} fill={C.peach} />
      <circle cx={14} cy={23} r={2.6} fill={C.white} strokeWidth={1.6} />
      <path d="M24 20 h15 M24 26 h11 M24 31 h13" fill="none" strokeWidth={2.2} />
    </>
  ),
  plane: () => (
    <>
      <path d="M5 26 L42 9 c2 -1 4 1 3 3 L28 43 l-6 -13 Z" fill={C.sky} />
      <path d="M22 30 L42 9" fill="none" strokeWidth={2.2} />
      <path d="M8 36 q4 -2 7 1" fill="none" strokeWidth={2} />
    </>
  ),
  briefcase: () => (
    <>
      <path d="M18 14 v-3 a3 3 0 0 1 3 -3 h6 a3 3 0 0 1 3 3 v3" fill="none" strokeWidth={2.6} />
      <rect x={6} y={14} width={36} height={26} rx={5} fill={C.peach} />
      <path d="M6 25 h36" fill="none" strokeWidth={2.2} />
      <rect x={20} y={22} width={8} height={6} rx={1.5} fill={C.sun} />
    </>
  ),
  trophy: () => (
    <>
      <path d="M14 7 h20 v10 a10 10 0 0 1 -20 0 Z" fill={C.sun} />
      <path d="M14 10 h-5 a5 5 0 0 0 5 8 M34 10 h5 a5 5 0 0 1 -5 8" fill="none" strokeWidth={2.4} />
      <path d="M24 27 v6" fill="none" strokeWidth={2.6} />
      <rect x={15} y={33} width={18} height={8} rx={2.5} fill={C.coral} />
      <path d="M24 11 l1.3 2.7 l3 0.4 l-2.2 2 l0.6 3 l-2.7 -1.5 l-2.7 1.5 l0.6 -3 l-2.2 -2 l3 -0.4 Z" fill={C.white} strokeWidth={1.4} />
    </>
  ),
  pill: () => (
    <>
      <rect x={6} y={17} width={36} height={14} rx={7} fill={C.white} transform="rotate(-35 24 24)" />
      <rect x={6} y={17} width={18} height={14} rx={7} fill={C.pink} transform="rotate(-35 24 24)" />
    </>
  ),
  scroll: () => (
    <>
      <rect x={9} y={8} width={30} height={28} rx={3} fill={C.sunSoft} />
      <path d="M14 15 h20 M14 21 h16 M14 27 h12" fill="none" strokeWidth={2} />
      <circle cx={33} cy={34} r={6} fill={C.coral} />
      <path d="M30 39 l-2 6 l5 -2 l5 2 l-2 -6" fill={C.coral} strokeWidth={2} />
    </>
  ),
  book: () => (
    <>
      <path d="M6 10 c6 -2 12 -1 18 3 c6 -4 12 -5 18 -3 v28 c-6 -2 -12 -1 -18 3 c-6 -4 -12 -5 -18 -3 Z" fill={C.white} />
      <path d="M24 13 v28" fill="none" strokeWidth={2.4} />
      <path d="M6 10 c6 -2 12 -1 18 3 v28 c-6 -4 -12 -5 -18 -3 Z" fill={C.lilac} />
      <path d="M29 20 h8 M29 26 h7" fill="none" strokeWidth={2} />
    </>
  ),
  laptop: () => (
    <>
      <rect x={9} y={9} width={30} height={21} rx={3} fill={C.skySoft} />
      <path d="M4 34 h40 l-3 6 H7 Z" fill={C.lilac} />
      <path d="M18 18 l-3 3 l3 3 M30 18 l3 3 l-3 3 M26 16 l-4 10" fill="none" strokeWidth={2} />
    </>
  ),
  video: () => (
    <>
      <rect x={5} y={10} width={38} height={28} rx={6} fill={C.coral} />
      <path d="M20 17 l11 7 l-11 7 Z" fill={C.white} strokeWidth={2.2} />
    </>
  ),
  link: () => (
    <>
      <rect x={4} y={18} width={22} height={12} rx={6} fill={C.sky} transform="rotate(-40 15 24)" />
      <rect x={22} y={18} width={22} height={12} rx={6} fill={C.mint} transform="rotate(-40 33 24)" />
      <path d="M18 30 l12 -12" fill="none" strokeWidth={2.6} />
    </>
  ),
  star: () => (
    <path d="M24 5 l5.6 11.6 l12.7 1.8 l-9.2 8.9 l2.2 12.6 L24 34 l-11.3 5.9 l2.2 -12.6 l-9.2 -8.9 l12.7 -1.8 Z" fill={C.sun} />
  ),
  target: () => (
    <>
      <circle cx={22} cy={26} r={16} fill={C.white} />
      <circle cx={22} cy={26} r={11} fill={C.coral} />
      <circle cx={22} cy={26} r={6} fill={C.white} />
      <circle cx={22} cy={26} r={2} fill={INK} stroke="none" />
      <path d="M22 26 L40 8 M34 8 h6 v6" fill="none" strokeWidth={2.6} />
    </>
  ),
  pencil: () => (
    <>
      <path d="M8 40 l3 -10 L33 8 a3 3 0 0 1 4 0 l3 3 a3 3 0 0 1 0 4 L18 37 Z" fill={C.sun} />
      <path d="M8 40 l3 -10 l7 7 Z" fill={C.peachSoft} />
      <path d="M29 12 l7 7" fill="none" strokeWidth={2.2} />
    </>
  ),
  heart: () => <HeartPath x={24} y={25} s={2.6} fill={C.pink} />,
  question: () => (
    <>
      <rect x={6} y={6} width={36} height={32} rx={8} fill={C.lilac} />
      <path d="M14 38 l-4 6 l10 -6" fill={C.lilac} />
      <path d="M19 17 a5 5 0 1 1 7 4.5 c-1.5 0.7 -2 1.6 -2 3.5" fill="none" strokeWidth={2.8} />
      <path d="M24 31 v0.5" fill="none" strokeWidth={3.4} />
    </>
  ),
  /* ---- files ---- */
  pdf: () => (
    <>
      <path d="M11 4 h18 l9 9 v29 a2 2 0 0 1 -2 2 H11 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 Z" fill={C.white} />
      <path d="M29 4 v9 h9" fill="none" />
      <rect x={6} y={24} width={26} height={12} rx={3} fill={C.coral} />
      <path d="M11 33 v-6 h2.5 a1.8 1.8 0 0 1 0 3.6 H11 M18 27 v6 h1.5 a3 3 0 0 0 0 -6 Z M26 33 v-6 h4 M26 30 h3" fill="none" stroke={C.white} strokeWidth={1.6} />
    </>
  ),
  image: () => (
    <>
      <rect x={5} y={8} width={38} height={32} rx={5} fill={C.skySoft} />
      <circle cx={16} cy={18} r={4} fill={C.sun} />
      <path d="M5 34 l11 -10 l8 7 l6 -5 l13 10 v1 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 Z" fill={C.mint} />
    </>
  ),
  sheet: () => (
    <>
      <rect x={8} y={5} width={32} height={38} rx={4} fill={C.mintSoft} />
      <path d="M8 16 h32 M8 25 h32 M8 34 h32 M19 5 v38 M30 5 v38" fill="none" strokeWidth={2} />
    </>
  ),
  slides: () => (
    <>
      <rect x={5} y={7} width={38} height={27} rx={4} fill={C.peachSoft} />
      <path d="M24 34 v6 M17 42 h14" fill="none" strokeWidth={2.4} />
      <rect x={11} y={14} width={12} height={13} rx={2} fill={C.peach} />
      <path d="M27 16 h10 M27 21 h8 M27 26 h9" fill="none" strokeWidth={2} />
    </>
  ),
  music: () => (
    <>
      <path d="M8 26 a16 16 0 0 1 32 0" fill="none" strokeWidth={3} />
      <rect x={4} y={24} width={10} height={16} rx={5} fill={C.pink} />
      <rect x={34} y={24} width={10} height={16} rx={5} fill={C.pink} />
      <path d="M21 16 v12 M21 16 l8 -2 v12" fill="none" strokeWidth={2.2} />
      <circle cx={19} cy={29} r={3} fill={C.sun} strokeWidth={1.8} />
      <circle cx={27} cy={27} r={3} fill={C.sun} strokeWidth={1.8} />
    </>
  ),
  /* ---- games ---- */
  game: () => (
    <>
      <path d="M12 16 h24 a9 9 0 0 1 9 9 v3 a8 8 0 0 1 -14 5 l-2 -2 h-10 l-2 2 a8 8 0 0 1 -14 -5 v-3 a9 9 0 0 1 9 -9 Z" fill={C.lilac} />
      <path d="M13 22 v8 M9 26 h8" fill="none" strokeWidth={2.6} />
      <circle cx={33} cy={23.5} r={2.2} fill={C.pink} strokeWidth={1.6} />
      <circle cx={37.5} cy={28} r={2.2} fill={C.sun} strokeWidth={1.6} />
      <path d="M21 12 c0 -4 6 -4 6 0" fill="none" strokeWidth={2} />
    </>
  ),
  c4: () => (
    <>
      <rect x={6} y={10} width={36} height={30} rx={6} fill={C.sky} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle key={`${r}${c}`} cx={13 + c * 7.3} cy={17 + r * 8} r={2.9} fill={r === 2 && c < 3 ? (c % 2 ? C.sun : C.coral) : r === 1 && c === 1 ? C.coral : C.white} strokeWidth={1.6} />
        )),
      )}
      <path d="M9 40 v4 M39 40 v4" fill="none" />
    </>
  ),
  ladder: () => (
    <>
      <path d="M14 6 v38 M30 6 v38 M14 13 h16 M14 22 h16 M14 31 h16 M14 40 h16" fill="none" stroke={C.peachDeep} strokeWidth={3.4} />
      <path d="M14 6 v38 M30 6 v38" fill="none" strokeWidth={1.4} />
      <path d="M33 12 c8 2 8 10 1 12 c-7 2 -7 10 1 12" fill="none" stroke={C.leaf} strokeWidth={4.4} />
      <circle cx={34.5} cy={11.5} r={2.6} fill={C.leaf} strokeWidth={1.6} />
    </>
  ),
  word: () => (
    <>
      <rect x={4} y={14} width={13} height={14} rx={3} fill={C.sun} />
      <rect x={18} y={14} width={13} height={14} rx={3} fill={C.pink} />
      <rect x={32} y={14} width={13} height={14} rx={3} fill={C.mint} />
      <path d="M7.5 25 l3 -8 3 8 M8.6 22.5 h3.8 M21.5 17 v8 h5 M35 17 h6 l-6 8 h6" fill="none" strokeWidth={1.9} />
      <path d="M8 35 h8 M20 35 h8 M34 35 h8" fill="none" strokeWidth={2.6} />
    </>
  ),
  gomoku: () => (
    <>
      <rect x={5} y={5} width={38} height={38} rx={6} fill="#F6E2BE" />
      <path d="M15 5 v38 M24 5 v38 M33 5 v38 M5 15 h38 M5 24 h38 M5 33 h38" fill="none" strokeWidth={1.2} stroke="#B98B4E" />
      <circle cx={15} cy={15} r={4.2} fill="#2E2240" strokeWidth={1.4} />
      <circle cx={24} cy={24} r={4.2} fill="#2E2240" strokeWidth={1.4} />
      <circle cx={33} cy={33} r={4.2} fill="#2E2240" strokeWidth={1.4} />
      <circle cx={33} cy={15} r={4.2} fill={C.white} strokeWidth={1.4} />
      <circle cx={15} cy={33} r={4.2} fill={C.white} strokeWidth={1.4} />
    </>
  ),
  ttt: () => (
    <>
      <rect x={5} y={5} width={38} height={38} rx={8} fill={C.white} />
      <path d="M18 9 v30 M30 9 v30 M9 18 h30 M9 30 h30" fill="none" strokeWidth={2} />
      <path d="M9.5 9.5 l5 5 m0 -5 l-5 5 M33.5 33.5 l5 5 m0 -5 l-5 5" fill="none" stroke={C.coral} strokeWidth={2.6} />
      <circle cx={24} cy={24} r={3.2} fill="none" stroke="#5B7BE0" strokeWidth={2.6} />
    </>
  ),
  rps: () => (
    <>
      <path d="M10 26 c0 -6 4 -9 8 -9 h9 a3 3 0 0 1 0 6 h-4 h9 a3 3 0 0 1 0 6 h-2 a3 3 0 0 1 0 6 h-4 a3 3 0 0 1 0 6 h-8 c-5 0 -8 -4 -8 -9 Z" fill={C.peach} />
      <path d="M23 23 h4 M27 29 h3 M26 35 h2" fill="none" strokeWidth={1.8} />
      <path d="M34 8 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1 Z" fill={C.sun} strokeWidth={1.4} />
    </>
  ),
  tot: () => (
    <>
      <rect x={4} y={10} width={18} height={26} rx={5} fill={C.pink} />
      <rect x={26} y={10} width={18} height={26} rx={5} fill={C.sky} />
      <path d="M10 20 h6 M32 20 h6 M10 26 h4 M32 26 h4" fill="none" strokeWidth={2} />
      <circle cx={24} cy={38} r={6} fill={C.sun} />
      <path d="M22 36.5 a2 2 0 1 1 3 1.7 c-0.8 .4 -1 1 -1 1.8" fill="none" strokeWidth={1.6} />
    </>
  ),
  memory: () => (
    <>
      <rect x={6} y={10} width={17} height={24} rx={4} fill={C.lilac} transform="rotate(-8 14 22)" />
      <rect x={24} y={12} width={17} height={24} rx={4} fill={C.white} transform="rotate(8 32 24)" />
      <path d="M14 18 l1.5 3 3 .4 -2.2 2 .6 3 -2.9 -1.5 -2.8 1.5 .6 -3 -2.2 -2 3 -.4 Z" fill={C.sun} strokeWidth={1.2} transform="rotate(-8 14 22)" />
      <circle cx={32.5} cy={23} r={4} fill={C.pink} strokeWidth={1.6} />
    </>
  ),
  boxes: () => (
    <>
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={10 + c * 14} cy={10 + r * 14} r={2.2} fill={C.white} strokeWidth={1.6} />))}
      <rect x={12} y={12} width={10} height={10} rx={1} fill={C.coral} strokeWidth={0} />
      <rect x={26} y={26} width={10} height={10} rx={1} fill="#5B7BE0" strokeWidth={0} />
      <path d="M10 10 h14 v14 h-14 Z M24 24 h14 v14 M24 24 v14 h14" fill="none" strokeWidth={2.4} />
    </>
  ),
  dice: () => (
    <>
      <rect x={8} y={8} width={32} height={32} rx={8} fill={C.white} transform="rotate(-10 24 24)" />
      <g transform="rotate(-10 24 24)">
        <circle cx={16} cy={16} r={2.6} fill={C.coral} strokeWidth={0} />
        <circle cx={24} cy={24} r={2.6} fill={C.coral} strokeWidth={0} />
        <circle cx={32} cy={32} r={2.6} fill={C.coral} strokeWidth={0} />
      </g>
    </>
  ),
  qmark: () => (
    <>
      <circle cx={24} cy={24} r={18} fill={C.lilac} />
      <path d="M18.5 19 a5.5 5.5 0 1 1 8 5 c-1.8 .9 -2.5 2 -2.5 4" fill="none" strokeWidth={3} />
      <circle cx={24} cy={34.5} r={1.8} fill="#2E2240" strokeWidth={0} />
    </>
  ),
  /* ---- cozy corner ---- */
  cozy: () => (
    <>
      <path d="M12 8 c-2 3 2 4 0 7 M19 6 c-2 3 2 4 0 7 M26 8 c-2 3 2 4 0 7" fill="none" strokeWidth={2.2} />
      <path d="M7 19 h26 v13 a10 10 0 0 1 -10 10 h-6 a10 10 0 0 1 -10 -10 Z" fill={C.peach} />
      <path d="M33 22 h3 a5 5 0 0 1 0 10 h-3" fill="none" />
      <Face x={20} y={30} gap={4.5} />
    </>
  ),
  jar: () => (
    <>
      <rect x={15} y={4} width={18} height={6} rx={2} fill={C.peachDeep} />
      <path d="M14 10 h20 v3 c4 2 6 6 6 11 v14 a6 6 0 0 1 -6 6 H14 a6 6 0 0 1 -6 -6 V24 c0 -5 2 -9 6 -11 Z" fill={C.skySoft} />
      <path d="M17 31 l1.6 3.4 3.6 .4 -2.7 2.4 .8 3.6 -3.3 -1.9 -3.2 1.9 .8 -3.6 -2.7 -2.4 3.6 -.4 Z" fill={C.sun} strokeWidth={1.6} />
      <path d="M30 24 l1.4 2.9 3.1 .3 -2.3 2.1 .7 3.1 -2.9 -1.6 -2.8 1.6 .7 -3.1 -2.3 -2.1 3.1 -.3 Z" fill={C.pink} strokeWidth={1.6} />
      <path d="M29 36 l1.2 2.5 2.7 .3 -2 1.8 .6 2.7 -2.5 -1.4 -2.4 1.4 .6 -2.7 -2 -1.8 2.7 -.3 Z" fill={C.mint} strokeWidth={1.6} />
    </>
  ),
  focus: () => (
    <>
      <path d="M20 5 h8 M24 5 v5" fill="none" />
      <circle cx={24} cy={27} r={17} fill={C.coral} />
      <path d="M24 27 V16 A11 11 0 0 1 34.5 24 Z" fill={C.white} strokeWidth={2} />
      <path d="M17 10 c2 -3 5 -3 6 0" fill={C.leaf} strokeWidth={2} />
      <Face x={24} y={33} gap={5} />
    </>
  ),
  calm: () => (
    <>
      <path d="M10 30 a9 9 0 0 1 4 -17 a11 11 0 0 1 21 2 a8 8 0 0 1 3 15 Z" fill={C.skySoft} />
      <Face x={24} y={24} gap={5} />
      <path d="M12 38 c3 -2 6 2 9 0 s6 2 9 0 s6 2 9 0" fill="none" stroke={C.green} strokeWidth={2.4} />
    </>
  ),
  party: () => (
    <>
      <path d="M8 42 l9 -26 l17 17 Z" fill={C.sun} />
      <path d="M12 31 l9 4 M15 23 l11 9" fill="none" stroke={C.pinkDeep} strokeWidth={2.4} />
      <circle cx={32} cy={10} r={2.6} fill={C.pink} />
      <circle cx={40} cy={20} r={2.6} fill={C.mint} />
      <path d="M25 6 l1 4 M42 30 l-4 -1 M37 5 l-2 4" fill="none" />
    </>
  ),
  coinIn: () => (
    <>
      <circle cx={20} cy={26} r={13} fill={C.sun} />
      <path d="M20 19 v14 M16 22 h6 a2.5 2.5 0 0 1 0 5 h-4 a2.5 2.5 0 0 0 0 5 h6" fill="none" strokeWidth={2} />
      <path d="M44 8 l-9 9 M35 11 v6 h6" fill="none" strokeWidth={2.6} stroke={C.green} />
    </>
  ),
  coinOut: () => (
    <>
      <circle cx={20} cy={26} r={13} fill={C.sun} />
      <path d="M20 19 v14 M16 22 h6 a2.5 2.5 0 0 1 0 5 h-4 a2.5 2.5 0 0 0 0 5 h6" fill="none" strokeWidth={2} />
      <path d="M35 17 l9 -9 M38 8 h6 v6" fill="none" strokeWidth={2.6} stroke={C.coral} />
    </>
  ),
} as const;

export type CuteIconName = keyof typeof ICONS;

export function CuteIcon({ name, size = 40, className }: { name: CuteIconName; size?: number; className?: string }) {
  const Draw = ICONS[name];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" className={className}>
      <g stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Draw />
      </g>
    </svg>
  );
}
