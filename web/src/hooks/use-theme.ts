import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "mack.theme";
const listeners = new Set<() => void>();

const current = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(KEY, theme);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

/** The initial class is set by an inline script in index.html; this hook only reads and flips it. */
export function useTheme(): [Theme, (t: Theme) => void] {
  return [useSyncExternalStore(subscribe, current), setTheme];
}
