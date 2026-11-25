import { ArrowLeft, GitBranch, Hammer, Loader2, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EmptyState } from "@/components/page-header";
import { JobTimeline } from "@/components/job-timeline";
import { JobStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useJobs, useSubmitJob } from "@/hooks/queries";
import { formatAgo, repoName, shortSha } from "@/lib/format";
import type { Job, JobWorkflow } from "@/lib/types";
import { cn } from "@/lib/utils";

const WORKFLOWS: Record<JobWorkflow, { label: string; detail: string }> = {
  "implement-review": { label: "Implementar y revisar", detail: "TDD y luego un segundo pase con code-review que corrige lo que encuentre." },
  implement: { label: "Solo implementar", detail: "TDD sin pase de revisión. Para cambios chicos." },
};

function NewJobDialog({ open, onOpenChange, onQueued }: { open: boolean; onOpenChange: (o: boolean) => void; onQueued: (id: string) => void }) {
  const submit = useSubmitJob();
  const [repo, setRepo] = useState("");
  const [task, setTask] = useState("");
  const [workflow, setWorkflow] = useState<JobWorkflow>("implement-review");
  const [setupCommand, setSetupCommand] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate(
      { repo: repo.trim(), task: task.trim(), workflow, ...(setupCommand.trim() && { setupCommand: setupCommand.trim() }) },
      {
        onSuccess: (job) => {
          setTask("");
          onOpenChange(false);
          onQueued(job.id);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Nuevo trabajo</DialogTitle>
            <DialogDescription>Un ticket claro por trabajo. Si todavía es vago, pídele a Mack que el bot dev lo aterrice primero.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="repo">Repo</Label>
            <Input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="~/repos/mi-app" className="font-mono text-[13px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket">Ticket</Label>
            <Textarea id="ticket" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Agrega GET /ping que regrese { ok: true }, con test de integración." className="min-h-32" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workflow">Flujo</Label>
              <Select value={workflow} onValueChange={(v) => setWorkflow(v as JobWorkflow)}>
                <SelectTrigger id="workflow" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WORKFLOWS).map(([value, w]) => (
                    <SelectItem key={value} value={value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup">Preparación del sandbox</Label>
              <Input id="setup" value={setupCommand} onChange={(e) => setSetupCommand(e.target.value)} placeholder="npm ci" className="font-mono text-[13px]" />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{WORKFLOWS[workflow].detail}</p>
          <DialogFooter>
            <Button type="submit" disabled={!repo.trim() || task.trim().length < 10 || submit.isPending}>
              {submit.isPending ? <Loader2 className="animate-spin" /> : <Hammer />}
              Encolar trabajo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function JobRow({ job, active, onSelect }: { job: Job; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors",
        "hover:bg-accent/60 focus-visible:shadow-focus focus-visible:outline-none focus-visible:ring-inset",
        active && "bg-accent hover:bg-accent",
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-xs">{repoName(job.repo)}</span>
        <JobStatusBadge status={job.status} />
      </span>
      <span className="line-clamp-2">{job.task}</span>
      <span className="text-muted-foreground text-xs">
        {formatAgo(job.createdAt)}
        {job.commits.length > 0 && ` · ${job.commits.length} ${job.commits.length === 1 ? "commit" : "commits"}`}
      </span>
    </button>
  );
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("mt-0.5 truncate", mono && "font-mono text-[13px]")}>{children}</dd>
    </div>
  );
}

function JobDetail({ job, onBack }: { job: Job; onBack: () => void }) {
  return (
    <article className="space-y-6 p-5 md:p-6">
      <Button variant="ghost" size="sm" className="-ml-2 md:hidden" onClick={onBack}>
        <ArrowLeft />
        Trabajos
      </Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-muted-foreground font-mono text-xs">{job.id}</span>
        </div>
        <h2 className="text-lg leading-6">{repoName(job.repo)}</h2>
        <p className="text-muted-foreground font-mono text-xs break-all">{job.repo}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 lg:grid-cols-4">
        <Field label="Rama" mono>
          <span className="text-blue-900 inline-flex items-center gap-1">
            <GitBranch className="size-3.5 shrink-0" />
            {job.branch}
          </span>
        </Field>
        <Field label="Sale de" mono>
          {job.baseBranch}
        </Field>
        <Field label="Flujo">{WORKFLOWS[job.workflow].label}</Field>
        <Field label="Modelo" mono>
          {job.model}
        </Field>
      </dl>

      <section className="space-y-2">
        <h3>Ticket</h3>
        <p className="bg-muted/60 rounded-md p-3 whitespace-pre-wrap">{job.task}</p>
      </section>

      <JobTimeline key={job.id} jobId={job.id} live={job.status === "running"} />

      {job.commits.length > 0 && (
        <section className="space-y-2">
          <h3>Commits</h3>
          <ul className="flex flex-wrap gap-2">
            {job.commits.map((sha) => (
              <li key={sha} className="bg-muted rounded px-2 py-0.5 font-mono text-[13px]">
                {shortSha(sha)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Revísalos con <code className="font-mono">git log {job.baseBranch}..{job.branch}</code> en el repo. El merge lo decides tú.
          </p>
        </section>
      )}

      {job.error && (
        <section className="space-y-2">
          <h3 className="text-destructive">Error</h3>
          <pre className="border-destructive/30 bg-destructive/5 overflow-x-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">{job.error}</pre>
        </section>
      )}

      {job.output && (
        <section className="space-y-2">
          <h3>Salida del agente</h3>
          <pre className="bg-muted/60 max-h-[28rem] overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">{job.output}</pre>
        </section>
      )}
    </article>
  );
}

export function FactoryView() {
  const jobs = useJobs();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const list = jobs.data ?? [];
  const selectedJob = list.find((j) => j.id === selected) ?? null;
  const shownJob = selectedJob ?? list[0] ?? null;
  const running = list.filter((j) => j.status === "running").length;
  const queued = list.filter((j) => j.status === "queued").length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className={cn("bg-card flex min-h-0 w-full flex-col border-r md:w-96 md:shrink-0", selectedJob && "hidden md:flex")}>
        <header className="space-y-1 border-b px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h1>Factory</h1>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus />
              Nuevo trabajo
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {running} construyendo · {queued} en cola. Cada sandbox carga las skills de Matt Pocock y configura el repo con setup-matt-pocock-skills. Nunca hace push.
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {jobs.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : list.length === 0 ? (
            <div className="p-4">
              <EmptyState>Todavía no hay trabajos. Encola el primero con un repo dentro de ~/repos.</EmptyState>
            </div>
          ) : (
            list.map((job) => <JobRow key={job.id} job={job} active={job.id === shownJob?.id} onSelect={() => setSelected(job.id)} />)
          )}
        </div>
      </section>

      <section className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", !selectedJob && "hidden md:block")}>
        {shownJob ? (
          <JobDetail job={shownJob} onBack={() => setSelected(null)} />
        ) : (
          <div className="text-muted-foreground grid h-full place-items-center p-6 text-sm">Elige un trabajo para ver su rama, su proceso paso a paso y sus commits.</div>
        )}
      </section>

      <NewJobDialog open={creating} onOpenChange={setCreating} onQueued={setSelected} />
    </div>
  );
}
