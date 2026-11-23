import { CircleDot, Loader2, MessageSquareText, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobSteps } from "@/hooks/queries";
import { formatClock } from "@/lib/format";
import type { JobStep, JobStepKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES: Record<string, string> = { setup: "Sandbox", implement: "Implementar", review: "Revisar", teardown: "Cierre" };

const KIND_ICON: Record<JobStepKind, typeof CircleDot> = { status: CircleDot, tool: SquareTerminal, text: MessageSquareText };

const STICK_TO_BOTTOM_PX = 48;

function StepRow({ step, index }: { step: JobStep; index: number }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[step.kind];
  return (
    <li className="grid grid-cols-[2.25rem_1rem_1fr] items-start gap-x-2 py-1.5">
      <span className="text-muted-foreground pt-px text-right font-mono text-[11px] tabular-nums">{index + 1}</span>
      <Icon className={cn("mt-0.5 size-3.5", step.kind === "status" ? "text-primary" : "text-muted-foreground")} />
      <button
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-accent/60 focus-visible:ring-ring min-w-0 rounded px-1 -mx-1 text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="text-muted-foreground mr-2 font-mono text-[11px]">{formatClock(step.at)}</span>
        <span
          className={cn(
            "break-words",
            step.kind === "tool" && "font-mono text-xs",
            step.kind === "status" && "font-medium",
            !open && "line-clamp-2",
          )}
        >
          {step.text}
        </span>
      </button>
    </li>
  );
}

export function JobTimeline({ jobId, live }: { jobId: string; live: boolean }) {
  const steps = useJobSteps(jobId, live);
  const list = steps.data ?? [];
  const scroller = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  const groups = list.reduce<{ phase: string; steps: { step: JobStep; index: number }[] }[]>((acc, step, index) => {
    const last = acc.at(-1);
    if (last?.phase === step.phase) last.steps.push({ step, index });
    else acc.push({ phase: step.phase, steps: [{ step, index }] });
    return acc;
  }, []);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3>Proceso</h3>
        <span className="text-muted-foreground text-xs">
          {list.length} {list.length === 1 ? "paso" : "pasos"}
          {live && " · en vivo"}
        </span>
      </div>
      {steps.isLoading ? (
        <Skeleton className="h-24" />
      ) : list.length === 0 ? (
        <p className="text-muted-foreground bg-muted/60 rounded-md p-3 text-sm">
          {live ? "Esperando el primer paso del sandbox…" : "Este trabajo no registró pasos (corrió antes de que existiera la línea de tiempo)."}
        </p>
      ) : (
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
          }}
          className="max-h-[32rem] overflow-y-auto rounded-md border px-3 py-2"
        >
          {groups.map((group, i) => (
            <div key={`${group.phase}-${i}`} className="not-first:mt-2 not-first:border-t not-first:pt-2">
              <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide uppercase">{PHASES[group.phase] ?? group.phase}</p>
              <ol>
                {group.steps.map(({ step, index }) => (
                  <StepRow key={step.id} step={step} index={index} />
                ))}
              </ol>
            </div>
          ))}
          {live && (
            <p className="text-muted-foreground flex items-center gap-2 py-1.5 pl-[3.25rem] text-xs">
              <Loader2 className="size-3 animate-spin" />
              Trabajando…
            </p>
          )}
        </div>
      )}
    </section>
  );
}
