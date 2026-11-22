const tokens = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-MX");
const usd = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
const relative = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

export const formatTokens = (n: number) => tokens.format(n);
export const formatInteger = (n: number) => integer.format(n);
export const formatUsd = (n: number) => usd.format(n);

export function formatAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return "hace un momento";
}

export const repoName = (path: string) => path.split("/").filter(Boolean).pop() ?? path;
export const shortSha = (sha: string) => sha.slice(0, 7);

const clock = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "short" });
const shortDate = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/** Chat-list style: time today, "ayer", weekday this week, date beyond. */
export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return clock.format(date);
  if (days === 1) return "ayer";
  if (days < 7) return weekday.format(date);
  return shortDate.format(date);
}

export const formatClock = (iso: string) => clock.format(new Date(iso));

/** One line of plain text for list previews. */
export const previewText = (markdown: string) => markdown.replace(/[*_`#>|]+/g, "").replace(/\s+/g, " ").trim();
