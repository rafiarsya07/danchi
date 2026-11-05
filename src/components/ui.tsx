import Link from "next/link";
import { CuteIcon, type CuteIconName } from "@/components/cute-icon";
import { Icon } from "@/components/icon";
import { Mascot, type Mood } from "@/components/mascot";
import { helpFor, type Help } from "@/lib/help";

export function Ring({
  value,
  max,
  size = 92,
  track = "var(--color-sun-soft)",
  fill = "#FF9A6C",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  track?: string;
  fill?: string;
  children?: React.ReactNode;
}) {
  const C = 2 * Math.PI * 40;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" fill="var(--color-white)" stroke={track} strokeWidth="13" />
        {ratio > 0 && (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={fill}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${(C * ratio).toFixed(1)} ${C.toFixed(1)}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
    </div>
  );
}

/** Page header: back button (phone), big cute icon, title, extras on the right, and a "what is this" helper. */
export function PageTitle({
  title,
  icon,
  subtitle,
  back = true,
  help,
  children,
}: {
  title: string;
  icon?: CuteIconName;
  subtitle?: string;
  back?: boolean;
  /** Help key (defaults to the icon). false hides the helper. */
  help?: string | false;
  children?: React.ReactNode;
}) {
  const h = help === false ? null : helpFor(help ?? icon);
  return (
    <div className="mb-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        {back && (
          <Link
            href="/"
            aria-label="Back to home"
            className="sticker-sm press flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white md:hidden"
          >
            <Icon name="back" stroke={2.6} />
          </Link>
        )}
        {icon && <CuteIcon name={icon} size={40} className="wiggle hidden shrink-0 sm:block md:size-[46px]" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="font-display truncate text-[26px] font-semibold leading-tight md:text-[32px]">{title}</h1>
          {subtitle && <p className="truncate text-[13px] font-semibold text-ink-soft">{subtitle}</p>}
        </div>
        {children}
      </div>
      {h && <HelpStrip h={h} />}
    </div>
  );
}

/** A quiet "How does this work?" link that opens into the explanation. */
export function HelpStrip({ h, open = false }: { h: Help; open?: boolean }) {
  return (
    <details open={open} className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-1 text-[13px] font-bold text-ink-soft hover:text-ink">
        <CuteIcon name="bulb" size={18} />
        <span className="underline decoration-solid underline-offset-4 group-open:hidden">How does this work?</span>
        <span className="hidden group-open:inline">Got it, close</span>
      </summary>
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-[var(--color-line)] bg-white/80 p-3">
        <p className="text-[13px] font-bold leading-snug">{h.what}</p>
        <ol className="flex flex-col gap-1.5">
          {h.how.map((step, i) => (
            <li key={step} className="flex items-start gap-2 text-[13px] font-semibold">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sun-soft text-[11px] font-bold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {h.example && <p className="rounded-xl bg-sun-soft px-2.5 py-1.5 text-xs font-bold">Example: {h.example}</p>}
      </div>
    </details>
  );
}

/** A friendly empty state with Chichi. */
export function Empty({
  mood = "happy",
  title,
  text,
  children,
}: {
  mood?: Mood;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[28px] border-[2.5px] border-ink/35 bg-white/60 px-6 pb-7 pt-4 text-center">
      <Mascot mood={mood} size={110} />
      <p className="font-display text-xl font-bold">{title}</p>
      {text && <p className="max-w-xs text-[15px] font-bold text-ink-soft">{text}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function Badge({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-extrabold ${className}`}>
      {children}
    </span>
  );
}

/** Section heading with a small cute icon. */
export function SectionTitle({ icon, children, right }: { icon?: CuteIconName; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
      {icon && <CuteIcon name={icon} size={26} />}
      <span className="min-w-0 flex-1">{children}</span>
      {right}
    </h2>
  );
}

/** Pill tabs driven by a ?tab= search param (no JS needed). */
export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { key: string; label: string; icon: CuteIconName; count?: number }[] }) {
  return (
    <nav aria-label="Sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {tabs.map((t, i) => {
        const on = t.key === current;
        return (
          <Link
            key={t.key}
            href={i === 0 ? base : `${base}?tab=${t.key}`}
            aria-current={on ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[13px] font-bold transition-colors ${
              on ? "bg-ink text-cream" : "border border-[var(--color-line)] bg-white text-ink-soft hover:text-ink"
            }`}
          >
            <CuteIcon name={t.icon} size={24} />
            {t.label}
            {t.count ? <span className={`rounded-full px-1.5 text-[11px] ${on ? "bg-white/20" : "bg-sun-soft text-ink"}`}>{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** A white sticker card with an optional heading. */
export function Panel({
  title,
  icon,
  tone = "bg-white",
  right,
  children,
  className = "",
}: {
  title?: string;
  icon?: CuteIconName;
  tone?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`sticker flex flex-col gap-3 rounded-3xl ${tone} p-4 ${className}`}>
      {title && (
        <h2 className="font-display flex items-center gap-2 text-[17px] font-semibold">
          {icon && <CuteIcon name={icon} size={26} />}
          <span className="min-w-0 flex-1">{title}</span>
          {right}
        </h2>
      )}
      {children}
    </section>
  );
}

/** Labelled input wrapper for forms. */
export function Label({ text, children, className = "" }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 text-xs font-extrabold ${className}`}>
      {text}
      {children}
    </label>
  );
}

/** Colour chips as radio buttons (works without JS). */
export function ColorPick({ name = "color", value = "sky" }: { name?: string; value?: string }) {
  const colors = ["peach", "sun", "mint", "sky", "lilac", "pink"];
  const bg: Record<string, string> = { peach: "bg-peach", sun: "bg-sun", mint: "bg-mint", sky: "bg-sky", lilac: "bg-lilac", pink: "bg-pink" };
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
      {colors.map((c) => (
        <label key={c} className="cursor-pointer">
          <input type="radio" name={name} value={c} defaultChecked={c === value} className="peer sr-only-safe" />
          <span className={`block size-9 rounded-xl border-[2.5px] border-ink ${bg[c]} peer-checked:shadow-[0_3px_0_#2E2240] peer-checked:ring-4 peer-checked:ring-ink/15 peer-focus-visible:outline-3`} />
          <span className="sr-only-safe">{c}</span>
        </label>
      ))}
    </div>
  );
}

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={`sticker-sm press h-11 rounded-2xl bg-white px-5 text-[15px] font-bold disabled:opacity-60 ${className}`}>
      {children}
    </button>
  );
}
