import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="max-w-[64ch]">
        <h1>{title}</h1>
        <p className="text-muted-foreground mt-1.5">{description}</p>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, children, actions, className }: { title?: string; description?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card crosshairs rounded-lg border p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm">{children}</div>;
}
