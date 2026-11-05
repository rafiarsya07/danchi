/**
 * Gentle cycle estimates from her own logs. Averages, not medicine: Danchi
 * says "around" and never gives fertility advice.
 */
import { addDaysISO, todayISO } from "./format";

export type CycleRow = { startOn: string; endOn: string | null };
export type Phase = "period" | "follicular" | "ovulation" | "luteal" | "late" | "unknown";

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function cycleStats(rows: CycleRow[], today = todayISO()) {
  const logs = [...rows].sort((a, b) => b.startOn.localeCompare(a.startOn));
  const lengths: number[] = [];
  for (let i = 0; i < logs.length - 1 && lengths.length < 6; i++) {
    const d = dayDiff(logs[i + 1].startOn, logs[i].startOn);
    if (d >= 18 && d <= 45) lengths.push(d);
  }
  const periods = logs
    .filter((l) => l.endOn)
    .slice(0, 6)
    .map((l) => dayDiff(l.startOn, l.endOn!) + 1)
    .filter((d) => d >= 1 && d <= 10);
  const avgCycle = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 28;
  const avgPeriod = periods.length ? Math.round(periods.reduce((a, b) => a + b, 0) / periods.length) : 5;
  const last = logs[0] ?? null;
  if (!last) return { avgCycle, avgPeriod, last: null, day: null, nextStart: null, daysToNext: null, phase: "unknown" as Phase, onPeriod: false, known: lengths.length };

  const day = dayDiff(last.startOn, today) + 1;
  const nextStart = addDaysISO(last.startOn, avgCycle);
  const daysToNext = dayDiff(today, nextStart);
  const onPeriod = last.endOn ? today >= last.startOn && today <= last.endOn : day >= 1 && day <= avgPeriod;
  let phase: Phase;
  if (onPeriod) phase = "period";
  else if (daysToNext < -2) phase = "late";
  else if (day <= avgCycle - 17) phase = "follicular";
  else if (day <= avgCycle - 12) phase = "ovulation";
  else phase = "luteal";
  return { avgCycle, avgPeriod, last, day, nextStart, daysToNext, phase, onPeriod, known: lengths.length };
}

export const PHASE_INFO: Record<Phase, { label: string; emoji: string; tip: string; bg: string }> = {
  period: { label: "Period days", emoji: "🌸", tip: "Warm drinks, a heat pad, and zero guilt about resting. You're doing great.", bg: "bg-pink" },
  follicular: { label: "Fresh energy", emoji: "🌱", tip: "Energy usually climbs now. Nice time for big tasks and trying new things.", bg: "bg-mint" },
  ovulation: { label: "Glow days", emoji: "✨", tip: "Many people feel most social and confident around now.", bg: "bg-sun" },
  luteal: { label: "Cosy days", emoji: "🍫", tip: "Cravings and low moods are normal before a period. Be soft with yourself.", bg: "bg-lilac" },
  late: { label: "A little late", emoji: "🕰️", tip: "Cycles shift with stress, sleep and travel. If you're worried, a doctor can help.", bg: "bg-sky" },
  unknown: { label: "Getting to know you", emoji: "🌼", tip: "Log when your period starts and Chichi will learn your rhythm.", bg: "bg-peach-soft" },
};

export const SYMPTOMS = ["Cramps", "Headache", "Tired", "Moody", "Cravings", "Bloated", "Back pain", "Acne", "Tender"] as const;
