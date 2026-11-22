import { type CSSProperties, useId } from "react";
import { cn } from "@/lib/utils";

export function MackMark({ className, style }: { className?: string; style?: CSSProperties }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)} style={style}>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--signal)" />
        </linearGradient>
      </defs>
      <path d="M8 23V9l8 9 8-9v14" fill="none" stroke={`url(#${id})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
