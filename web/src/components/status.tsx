import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusDot({ up, className }: { up: boolean | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        up === undefined ? "bg-muted-foreground/40" : up ? "bg-ok shadow-[0_0_10px_var(--ok)]" : "bg-destructive",
        className,
      )}
    />
  );
}

const JOB_STATUS: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "En cola", className: "text-muted-foreground border-input" },
  running: { label: "Construyendo", className: "text-forge border-forge/40 bg-forge/10" },
  done: { label: "Listo", className: "text-ok border-ok/30 bg-ok/10" },
  incomplete: { label: "Incompleto", className: "text-warn border-warn/30 bg-warn/10" },
  failed: { label: "Falló", className: "text-destructive border-destructive/30 bg-destructive/10" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = JOB_STATUS[status];
  return (
    <Badge variant="outline" className={cn("rounded-full font-medium", className)}>
      {status === "running" && <span className="bg-forge mr-0.5 inline-block size-1.5 animate-pulse rounded-full" />}
      {label}
    </Badge>
  );
}

const DISPATCH_STATUS = {
  ok: { label: "Respondió", className: "text-ok" },
  out_of_domain: { label: "Fuera de su dominio", className: "text-warn" },
  error: { label: "Error", className: "text-destructive" },
} as const;

export function DispatchStatus({ status }: { status: keyof typeof DISPATCH_STATUS }) {
  const { label, className } = DISPATCH_STATUS[status];
  return <span className={cn("text-sm font-medium", className)}>{label}</span>;
}
