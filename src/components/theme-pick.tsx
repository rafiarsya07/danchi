"use client";

import { useEffect, useState } from "react";

const KEY = "danchi-theme";
type Theme = "light" | "dark" | "auto";

function apply(t: Theme) {
  const dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Light, Moon (dark) or follow the phone. Saved on this device. */
export function ThemePick() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme((localStorage.getItem(KEY) as Theme) || "light");
    } catch {}
  }, []);
  const pick = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    apply(t);
  };
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
      {(
        [
          ["light", "☀️", "Peach day"],
          ["dark", "🌙", "Moon"],
          ["auto", "📱", "Like my phone"],
        ] as const
      ).map(([k, e, t]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={theme === k}
          onClick={() => pick(k)}
          className={`flex h-16 flex-col items-center justify-center rounded-2xl border-2 border-ink text-sm font-extrabold ${theme === k ? "bg-sun shadow-[0_3px_0_#2E2240]" : "bg-white"}`}
        >
          <span className="text-xl leading-none">{e}</span>
          {t}
        </button>
      ))}
    </div>
  );
}
