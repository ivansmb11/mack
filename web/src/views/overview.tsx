import { Boxes, Hammer, MessageCircle, Network } from "lucide-react";
import { MackMark } from "@/components/mack-mark";
import { EmptyState } from "@/components/page-header";
import { JobStatusBadge, StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlowArc, GlowRing, Halo, type OrbitNode, OrbitArc, RadialFan } from "@/components/visuals";
import { useAgents, useHealth, useJobs, useLedger } from "@/hooks/queries";
import type { Route } from "@/hooks/use-hash-route";
import { formatAgo, formatTokens, formatUsd, repoName } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

const ORBIT_TONE: Record<JobStatus, OrbitNode["tone"]> = {
  queued: "idle",
  running: "running",
  done: "done",
  incomplete: "failed",
  failed: "failed",
};

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Card({ icon: Icon, title, body, visual, action }: { icon: typeof Boxes; title: string; body: string; visual: React.ReactNode; action: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-5 p-6">
      <div>
        <Icon className="text-muted-foreground mb-3 size-4" />
        <h2>{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{body}</p>
      </div>
      <div className="mt-auto pb-6">{visual}</div>
      {action}
    </section>
  );
}

export function OverviewView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const agents = useAgents();
  const health = useHealth();
  const jobs = useJobs();
  const ledger = useLedger();

  const up = new Map(health.data?.map((h) => [h.agent, h.up]));
  const dsas = agents.data?.filter((a) => a.kind === "dsa") ?? [];
  const mackUp = up.get("mack");
  const onlineDsas = dsas.filter((a) => up.get(a.name)).length;
  const recentJobs = (jobs.data ?? []).slice(0, 6);
  const building = jobs.data?.filter((j) => j.status === "running").length ?? 0;

  const status =
    (mackUp === false ? "Mack no responde" : `Mack está en línea con ${plural(onlineDsas, "bot disponible", "bots disponibles")}`) +
    (building > 0 ? ` y el Factory está construyendo ${plural(building, "trabajo", "trabajos")}.` : ". El Factory está libre.");

  return (
    <div className="space-y-10">
      <header className="relative pt-36 pb-14 text-center">
        <GlowArc className="absolute -top-4 left-1/2 w-[min(600px,96%)] -translate-x-1/2" />
        <h1 className="relative text-[2rem] md:text-[2.5rem]">{greeting()}, Iván</h1>
        <p className="text-muted-foreground relative mx-auto mt-2 max-w-[32ch]">{agents.isLoading ? "Revisando el estado de tus agentes…" : status}</p>
      </header>

      <div className="crosshairs bg-border grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
        <Card
          icon={MessageCircle}
          title="Mack"
          body={mackUp === false ? "No responde en el gateway de Hermes. Revisa hermes gateway status." : "Tu punto de entrada. Le hablas aquí, por Telegram o por /v1."}
          visual={
            <Halo>
              <GlowRing size={76}>
                <MackMark className="size-7" />
              </GlowRing>
            </Halo>
          }
          action={
            <Button onClick={() => onNavigate({ view: "bot", name: "mack" })} className="w-full">
              Hablar con Mack
            </Button>
          }
        />
        <Card
          icon={Network}
          title="Matrix"
          body={dsas.length ? `${plural(dsas.length, "bot", "bots")} en órbita, ${onlineDsas} respondiendo.` : "Todavía no hay bots. Crea el primero con el + de la barra lateral."}
          visual={
            agents.isLoading ? (
              <Skeleton className="h-[172px] w-full" />
            ) : (
              <RadialFan
                nodes={dsas.map((a) => ({ id: a.name, label: a.name, active: up.get(a.name) }))}
                hub={
                  <GlowRing size={44}>
                    <Boxes className="size-4" />
                  </GlowRing>
                }
              />
            )
          }
          action={
            <Button variant="secondary" onClick={() => onNavigate({ view: "matrix" })} className="w-full">
              Abrir Matrix
            </Button>
          }
        />
        <Card
          icon={Hammer}
          title="Factory"
          body={building ? `Construyendo ${plural(building, "trabajo", "trabajos")} en sandboxes de Sandcastle.` : "Sin trabajos en curso. Mándale un ticket con un repo."}
          visual={
            <OrbitArc
              nodes={recentJobs.map((j) => ({ id: j.id, label: repoName(j.repo), tone: ORBIT_TONE[j.status] }))}
              hub={
                <GlowRing size={44} tone="forge">
                  <Hammer className="text-forge size-4" />
                </GlowRing>
              }
            />
          }
          action={
            <Button variant="secondary" onClick={() => onNavigate({ view: "factory" })} className="w-full">
              Abrir el Factory
            </Button>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="bg-card crosshairs rounded-lg border p-5">
          <h2 className="mb-3">Trabajos recientes</h2>
          {recentJobs.length === 0 ? (
            <EmptyState>Cuando Mack mande código a construir, aparecerá aquí.</EmptyState>
          ) : (
            <ul className="divide-y">
              {recentJobs.map((job) => (
                <li key={job.id}>
                  <button onClick={() => onNavigate({ view: "factory" })} className="hover:bg-accent -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1">{job.task}</span>
                      <span className="text-muted-foreground text-xs">
                        {repoName(job.repo)}, {formatAgo(job.createdAt)}
                      </span>
                    </span>
                    <JobStatusBadge status={job.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card crosshairs rounded-lg border p-5">
          <h2 className="mb-3">Este mes</h2>
          {ledger.data ? (
            <div className="space-y-4">
              <p className="text-glow text-4xl font-semibold tracking-tight tabular-nums">{formatUsd(ledger.data.totalUsd)}</p>
              <p className="text-muted-foreground text-sm">
                {formatUsd(ledger.data.subscriptionsUsd)} en suscripciones y {formatUsd(ledger.data.meteredUsd)} medido por tokens.
              </p>
              <ul className="space-y-1.5 text-sm">
                {ledger.data.perAgent.slice(0, 4).map((a) => (
                  <li key={a.agent} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <StatusDot up={up.get(a.agent)} />
                      {a.agent}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{formatTokens(a.tokens)} tokens</span>
                  </li>
                ))}
              </ul>
              <Button variant="link" className="text-signal h-auto p-0" onClick={() => onNavigate({ view: "ledger" })}>
                Ver el Ledger
              </Button>
            </div>
          ) : (
            <Skeleton className="h-36 w-full" />
          )}
        </section>
      </div>
    </div>
  );
}
