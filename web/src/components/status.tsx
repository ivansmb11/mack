import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusDot({ up, className }: { up: boolean | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        up === undefined ? "bg-gray-600" : up ? "bg-ok" : "bg-destructive",
        className,
      )}
    />
  );
}

const JOB_STATUS: Record<JobStatus, { label: string; variant: "gray" | "blue" | "green" | "amber" | "red" }> = {
  queued: { label: "En cola", variant: "gray" },
  running: { label: "Construyendo", variant: "blue" },
  done: { label: "Listo", variant: "green" },
  incomplete: { label: "Incompleto", variant: "amber" },
  failed: { label: "Falló", variant: "red" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, variant } = JOB_STATUS[status];
  return (
    <Badge variant={variant}>
      {status === "running" && <span className="bg-blue-700 inline-block size-1.5 animate-pulse rounded-full" />}
      {label}
    </Badge>
  );
}

const DISPATCH_STATUS = {
  ok: { label: "Respondió", className: "text-green-900" },
  out_of_domain: { label: "Fuera de su dominio", className: "text-muted-foreground" },
  error: { label: "Error", className: "text-red-900" },
} as const;

export function DispatchStatus({ status }: { status: keyof typeof DISPATCH_STATUS }) {
  const { label, className } = DISPATCH_STATUS[status];
  return <span className={cn("text-sm font-medium", className)}>{label}</span>;
}
