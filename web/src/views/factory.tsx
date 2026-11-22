import { GitBranch, Hammer, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EmptyState, PageHeader, Panel } from "@/components/page-header";
import { JobStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useJobs, useSubmitJob } from "@/hooks/queries";
import { formatAgo, repoName, shortSha } from "@/lib/format";
import type { Job, JobWorkflow } from "@/lib/types";

const WORKFLOWS: Record<JobWorkflow, { label: string; detail: string }> = {
  "implement-review": { label: "Implementar y revisar", detail: "TDD y luego un segundo pase con code-review que corrige lo que encuentre." },
  implement: { label: "Solo implementar", detail: "TDD sin pase de revisión. Para cambios chicos." },
};

function JobDetail({ job, onClose }: { job: Job | null; onClose: () => void }) {
  return (
    <Sheet open={job !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
        {job && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status} />
                <span className="text-muted-foreground font-mono text-xs">{job.id}</span>
              </div>
              <SheetTitle className="text-lg">{repoName(job.repo)}</SheetTitle>
              <SheetDescription className="font-mono text-xs break-all">{job.repo}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-6">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Rama</dt>
                <dd className="text-forge font-mono text-[13px]">{job.branch}</dd>
                <dt className="text-muted-foreground">Sale de</dt>
                <dd className="font-mono text-[13px]">{job.baseBranch}</dd>
                <dt className="text-muted-foreground">Flujo</dt>
                <dd>{WORKFLOWS[job.workflow].label}</dd>
                <dt className="text-muted-foreground">Modelo</dt>
                <dd className="font-mono text-[13px]">{job.model}</dd>
                <dt className="text-muted-foreground">Encolado</dt>
                <dd>{formatAgo(job.createdAt)}</dd>
              </dl>

              <section>
                <h3 className="mb-2">Ticket</h3>
                <p className="bg-background rounded-md border p-3 text-sm whitespace-pre-wrap">{job.task}</p>
              </section>

              {job.commits.length > 0 && (
                <section>
                  <h3 className="mb-2">Commits</h3>
                  <ul className="space-y-1">
                    {job.commits.map((sha) => (
                      <li key={sha} className="font-mono text-[13px]">
                        {shortSha(sha)}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Revísalos con <code className="font-mono">git log {job.baseBranch}..{job.branch}</code> en el repo. El merge lo decides tú.
                  </p>
                </section>
              )}

              {job.error && (
                <section>
                  <h3 className="text-destructive mb-2">Error</h3>
                  <pre className="bg-background text-destructive overflow-x-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">{job.error}</pre>
                </section>
              )}

              {job.output && (
                <section>
                  <h3 className="mb-2">Salida del agente</h3>
                  <pre className="bg-background max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">{job.output}</pre>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function FactoryView() {
  const jobs = useJobs();
  const submit = useSubmitJob();
  const [selected, setSelected] = useState<string | null>(null);
  const [repo, setRepo] = useState("");
  const [task, setTask] = useState("");
  const [workflow, setWorkflow] = useState<JobWorkflow>("implement-review");
  const [setupCommand, setSetupCommand] = useState("");

  const selectedJob = jobs.data?.find((j) => j.id === selected) ?? null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit.mutate(
      { repo: repo.trim(), task: task.trim(), workflow, ...(setupCommand.trim() && { setupCommand: setupCommand.trim() }) },
      { onSuccess: () => setTask("") },
    );
  }

  return (
    <div>
      <PageHeader
        title="Factory"
        description="Agentes de Claude Code trabajando solos en sandboxes de Sandcastle, cada uno en su propia rama. Nunca hacen push."
      />

      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Panel title="Nuevo trabajo" description="Un ticket claro por trabajo. Si es vago, pídele a Mack que el DSA dev lo aterrice primero.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="repo">Repo</Label>
              <Input id="repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="~/repos/mi-app" className="font-mono text-[13px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket">Ticket</Label>
              <Textarea
                id="ticket"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Agrega GET /ping que regrese { ok: true }, con test de integración."
                className="min-h-36"
              />
            </div>
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
              <p className="text-muted-foreground text-xs">{WORKFLOWS[workflow].detail}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup">Preparación del sandbox</Label>
              <Input id="setup" value={setupCommand} onChange={(e) => setSetupCommand(e.target.value)} placeholder="npm ci" className="font-mono text-[13px]" />
            </div>
            <Button type="submit" className="w-full" disabled={!repo.trim() || task.trim().length < 10 || submit.isPending}>
              {submit.isPending ? <Loader2 className="animate-spin" /> : <Hammer />}
              Encolar trabajo
            </Button>
          </form>
        </Panel>

        <div className="bg-card crosshairs min-w-0 rounded-lg border">
          {jobs.isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !jobs.data?.length ? (
            <div className="p-5">
              <EmptyState>Todavía no hay trabajos. Encola el primero con un repo dentro de ~/repos.</EmptyState>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Ticket</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-5 text-right">Commits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.data.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => setSelected(job.id)}>
                    <TableCell className="max-w-0 w-full pl-5">
                      <button className="block w-full truncate text-left focus-visible:underline focus-visible:outline-none" onClick={() => setSelected(job.id)}>
                        {job.task}
                      </button>
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        {repoName(job.repo)}, {formatAgo(job.createdAt)}
                        <GitBranch className="ml-1 size-3 shrink-0" />
                        <span className="truncate font-mono">{job.branch}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{job.commits.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <JobDetail job={selectedJob} onClose={() => setSelected(null)} />
    </div>
  );
}
