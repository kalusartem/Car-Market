import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  storeTheme,
  type ThemePref,
} from "../lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const ORDER: ThemePref[] = ["light", "dark", "system"];
const LABEL: Record<ThemePref, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getStoredTheme);

  const set = useCallback((next: ThemePref) => {
    setPref(next);
    storeTheme(next);
    applyTheme(next);
  }, []);

  // Follow OS changes while on "system", and theme changes made in other tabs.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        const next = getStoredTheme();
        setPref(next);
        applyTheme(next);
      }
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const Icon = pref === "light" ? SunIcon : pref === "dark" ? MoonIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={() => set(next)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-surface text-muted transition hover:bg-surface-2 hover:text-fg"
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[pref]} (click for ${LABEL[next]})`}
    >
      <Icon />
    </button>
  );
}
