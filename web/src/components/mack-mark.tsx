import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function MackMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("text-primary size-8", className)} style={style}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M9 22V10l7 8 7-8v12" fill="none" stroke="var(--primary-foreground)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
