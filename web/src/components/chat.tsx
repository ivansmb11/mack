import { cn } from "@/lib/utils";

export function TypingBubble({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("bg-secondary inline-flex h-10 w-fit items-center gap-1 rounded-xl rounded-bl-sm px-4", className)}>
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="animate-typing size-1.5 rounded-full bg-gray-900" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
