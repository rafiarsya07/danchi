/**
 * Chichi, Danchi's little mascot: a round peach with a dandelion puff for hair.
 * Pure SVG, no images, so it stays crisp at any size and works in emails too
 * (see scripts/make-icons.tsx for the PNG versions).
 */

export type Mood = "happy" | "wave" | "sleep" | "think" | "cheer" | "remind" | "worried" | "love";

const INK = "#2E2240";
const PEACH = "#FFB38A";
const PEACH_DEEP = "#FF9E7A";
const LEAF = "#7BD3A8";
const BLUSH = "#FF7FA0";
const SUN = "#FFD95A";
const MOUTH = "#7A2E4A";

type Eyes = "open" | "happy" | "closed" | "up" | "heart";
type Mouth = "smile" | "open" | "o" | "wavy" | "small";
type Arms = "down" | "wave" | "up" | "bell";
type Extra = "zzz" | "sparkles" | "dots" | "sweat" | "hearts" | "brows";

const MOODS: Record<Mood, { eyes: Eyes; mouth: Mouth; arms: Arms; extras: Extra[] }> = {
  happy: { eyes: "open", mouth: "smile", arms: "down", extras: [] },
  wave: { eyes: "happy", mouth: "open", arms: "wave", extras: [] },
  sleep: { eyes: "closed", mouth: "small", arms: "down", extras: ["zzz"] },
  think: { eyes: "up", mouth: "small", arms: "down", extras: ["dots"] },
  cheer: { eyes: "happy", mouth: "open", arms: "up", extras: ["sparkles"] },
  remind: { eyes: "open", mouth: "o", arms: "bell", extras: [] },
  worried: { eyes: "open", mouth: "wavy", arms: "down", extras: ["brows", "sweat"] },
  love: { eyes: "heart", mouth: "smile", arms: "down", extras: ["hearts"] },
};

const BODY = "M60 42 C 52 34, 27 36, 26 64 C 25 88, 42 102, 60 102 C 78 102, 95 88, 94 64 C 93 36, 68 34, 60 42 Z";

function Arm({ x1, y1, x2, y2, className }: { x1: number; y1: number; x2: number; y2: number; className?: string }) {
  return (
    <g className={className}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={12} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PEACH} strokeWidth={7} strokeLinecap="round" />
    </g>
  );
}

function Heart({ x, y, s = 1, fill = "#FF6F91" }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 5 C -6 1, -8 -2, -8 -4.5 A 4 4 0 0 1 0 -6 A 4 4 0 0 1 8 -4.5 C 8 -2, 6 1, 0 5 Z"
      fill={fill}
      stroke={INK}
      strokeWidth={2.2 / s}
      strokeLinejoin="round"
    />
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -8 Q 1.4 -1.4 8 0 Q 1.4 1.4 0 8 Q -1.4 1.4 -8 0 Q -1.4 -1.4 0 -8 Z"
      fill={SUN}
      stroke={INK}
      strokeWidth={2 / s}
      strokeLinejoin="round"
    />
  );
}

function Seed({ x, y, r = 0, className }: { x: number; y: number; r?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`} className={className}>
      <path d="M0 0 V 8" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M0 0 L -4 -3 M0 0 L -1.5 -4.5 M0 0 L 1.5 -4.5 M0 0 L 4 -3" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    </g>
  );
}

function Puff() {
  const bumps = Array.from({ length: 11 }, (_, k) => {
    const a = (k / 11) * Math.PI * 2;
    return { cx: 60 + Math.cos(a) * 10.5, cy: 20 + Math.sin(a) * 10.5 };
  });
  return (
    <g>
      <path d="M60 30 V 42" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M60 39 C 64 31, 74 29, 79 32 C 75 39, 66 41, 60 39 Z" fill={LEAF} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      {bumps.map((b, i) => (
        <circle key={i} cx={b.cx.toFixed(2)} cy={b.cy.toFixed(2)} r={5.2} fill="#fff" stroke={INK} strokeWidth={2.4} />
      ))}
      <circle cx={60} cy={20} r={11} fill="#fff" />
      <circle cx={56} cy={17} r={1.3} fill="#E3D8F2" />
      <circle cx={63} cy={15.5} r={1.1} fill="#E3D8F2" />
      <circle cx={64} cy={22.5} r={1.3} fill="#E3D8F2" />
      <circle cx={57} cy={23.5} r={1} fill="#E3D8F2" />
      <circle cx={60} cy={20} r={2.2} fill={SUN} />
    </g>
  );
}

function EyesFor({ kind }: { kind: Eyes }) {
  const pos = [47, 73];
  if (kind === "happy") {
    return (
      <g stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
        {pos.map((x) => (
          <path key={x} d={`M${x - 5.5} 72 Q ${x} 64.5 ${x + 5.5} 72`} />
        ))}
      </g>
    );
  }
  if (kind === "closed") {
    return (
      <g stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none">
        {pos.map((x) => (
          <path key={x} d={`M${x - 5.5} 69 Q ${x} 75 ${x + 5.5} 69`} />
        ))}
      </g>
    );
  }
  if (kind === "heart") {
    return (
      <g>
        {pos.map((x) => (
          <Heart key={x} x={x} y={70} s={0.85} />
        ))}
      </g>
    );
  }
  const dy = kind === "up" ? -2.5 : 0;
  const dx = kind === "up" ? 1.5 : 0;
  return (
    <g>
      {pos.map((x) => (
        <g key={x}>
          <ellipse cx={x + dx} cy={70 + dy} rx={4.8} ry={5.8} fill={INK} />
          <circle cx={x + dx - 1.5} cy={67.6 + dy} r={1.8} fill="#fff" />
          <circle cx={x + dx + 1.7} cy={72.6 + dy} r={0.9} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function MouthFor({ kind }: { kind: Mouth }) {
  const stroke = { stroke: INK, strokeWidth: 2.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "open":
      return <path d="M53.5 77.5 Q 60 78.5 66.5 77.5 Q 65.5 87 60 87 Q 54.5 87 53.5 77.5 Z" fill={MOUTH} {...stroke} />;
    case "o":
      return <ellipse cx={60} cy={81} rx={3.4} ry={4} fill={MOUTH} {...stroke} />;
    case "wavy":
      return <path d="M52.5 81 q 2.5 -3 5 0 q 2.5 3 5 0 q 2.5 -3 5 0" fill="none" {...stroke} />;
    case "small":
      return <path d="M56.5 79.5 Q 60 82.5 63.5 79.5" fill="none" {...stroke} />;
    default:
      return <path d="M54 78 Q 60 85 66 78" fill="none" {...stroke} />;
  }
}

export function Mascot({
  mood = "happy",
  size = 120,
  className,
  animate = true,
  title,
}: {
  mood?: Mood;
  size?: number;
  className?: string;
  animate?: boolean;
  /** Give it a title when the mascot carries meaning; otherwise it's decorative. */
  title?: string;
}) {
  const m = MOODS[mood];
  const a = animate;

  const armsBehind =
    m.arms === "down" ? (
      <>
        <Arm x1={33} y1={78} x2={23} y2={88} />
        <Arm x1={87} y1={78} x2={97} y2={88} />
      </>
    ) : m.arms === "wave" ? (
      <>
        <Arm x1={33} y1={78} x2={23} y2={88} />
        <Arm x1={86} y1={70} x2={101} y2={50} className={a ? "mascot-wave" : undefined} />
      </>
    ) : m.arms === "up" ? (
      <>
        <Arm x1={34} y1={68} x2={19} y2={48} />
        <Arm x1={86} y1={68} x2={101} y2={48} />
      </>
    ) : m.arms === "bell" ? (
      <>
        <Arm x1={33} y1={78} x2={23} y2={88} />
        <Arm x1={86} y1={70} x2={99} y2={54} />
      </>
    ) : null;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {a && (
        <>
          <Seed x={16} y={30} r={-20} className="mascot-seed" />
          <Seed x={104} y={22} r={18} className="mascot-seed mascot-seed-2" />
        </>
      )}
      <ellipse cx={60} cy={110} rx={30} ry={4.5} fill={INK} opacity={0.12} />
      <g className={a ? "mascot-bob" : undefined}>
        {armsBehind}
        <ellipse cx={47} cy={102} rx={8.5} ry={5} fill={PEACH_DEEP} stroke={INK} strokeWidth={2.6} />
        <ellipse cx={73} cy={102} rx={8.5} ry={5} fill={PEACH_DEEP} stroke={INK} strokeWidth={2.6} />
        <path d={BODY} fill={PEACH} stroke={INK} strokeWidth={2.8} strokeLinejoin="round" />
        <path d="M60 45 C 56 54, 56 61, 58.5 67" stroke="#EE8A62" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.7} />
        <ellipse cx={39} cy={55} rx={7} ry={4.2} transform="rotate(-35 39 55)" fill="#fff" opacity={0.55} />
        <Puff />
        <ellipse cx={36.5} cy={80} rx={6.5} ry={3.8} fill={BLUSH} opacity={0.55} />
        <ellipse cx={83.5} cy={80} rx={6.5} ry={3.8} fill={BLUSH} opacity={0.55} />
        {m.extras.includes("brows") && (
          <g stroke={INK} strokeWidth={2.6} strokeLinecap="round">
            <path d="M40.5 61.5 L 51 57.5" />
            <path d="M79.5 61.5 L 69 57.5" />
          </g>
        )}
        <EyesFor kind={m.eyes} />
        <MouthFor kind={m.mouth} />

        {m.arms === "bell" && (
          <g className={a ? "mascot-ring" : undefined}>
            <path d="M103 36 c -6 0 -9 4.5 -9 9.5 v5 l -3 4 h 24 l -3 -4 v -5 c 0 -5 -3 -9.5 -9 -9.5 z" fill={SUN} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            <circle cx={103} cy={57} r={2.8} fill={PEACH_DEEP} stroke={INK} strokeWidth={2.2} />
            <circle cx={103} cy={35} r={2} fill={SUN} stroke={INK} strokeWidth={2} />
            <path d="M88 38 q -2 4 0 8 M118 38 q 2 4 0 8" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          </g>
        )}
        {m.arms === "wave" && (
          <path d="M106 40 q 4 4 3 9 M111 35 q 6 6 4 14" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        )}
      </g>

      {m.extras.includes("zzz") && (
        <g fill={INK} fontFamily="Fredoka Variable, Fredoka, sans-serif" fontWeight={700} className={a ? "mascot-zzz" : undefined}>
          <text x={88} y={40} fontSize={15}>z</text>
          <text x={99} y={27} fontSize={11}>z</text>
          <text x={107} y={17} fontSize={8}>z</text>
        </g>
      )}
      {m.extras.includes("dots") && (
        <g fill="#fff" stroke={INK} strokeWidth={2.2}>
          <circle cx={92} cy={38} r={3} />
          <circle cx={100} cy={28} r={4} />
          <circle cx={110} cy={16} r={5.5} />
        </g>
      )}
      {m.extras.includes("sparkles") && (
        <g className={a ? "mascot-twinkle" : undefined}>
          <Sparkle x={14} y={34} s={0.9} />
          <Sparkle x={108} y={30} s={0.75} />
          <Sparkle x={104} y={78} s={0.55} />
          <Sparkle x={12} y={74} s={0.5} />
        </g>
      )}
      {m.extras.includes("sweat") && (
        <path d="M89 49 q 5 7 0 10.5 q -5 -3.5 0 -10.5 z" fill="#9FD3FF" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      )}
      {m.extras.includes("hearts") && (
        <g className={a ? "mascot-twinkle" : undefined}>
          <Heart x={100} y={40} s={1} />
          <Heart x={18} y={46} s={0.7} fill="#FFA9C9" />
        </g>
      )}
    </svg>
  );
}

/** Round mascot badge: the logo, app icon and avatar. */
export function MascotBadge({ size = 48, mood = "happy", bg = "bg-peach-soft" }: { size?: number; mood?: Mood; bg?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full border-[2.5px] border-ink ${bg}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Mascot mood={mood} size={Math.round(size * 1.05)} animate={false} className="-mb-[6%]" />
    </span>
  );
}
